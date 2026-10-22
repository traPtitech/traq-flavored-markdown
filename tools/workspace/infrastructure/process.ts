export type ProcessOptions = {
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
  output?: 'capture' | 'inherit'
  log?: (message: string) => void
}

/** Drain both pipes, preserve stdout as data, and bound the complete process tree. */
export async function captureProcess(
  command: string,
  args: string[],
  cwd: string,
  {
    env,
    timeoutMs = 120_000,
    output: outputMode = 'capture',
    log
  }: ProcessOptions = {}
) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new Error('Process timeout must be a positive number')
  const label = JSON.stringify([command, ...args])
  log?.(`Starting ${label} in ${cwd}`)

  const started = performance.now()

  const child = Bun.spawn([command, ...args], {
    cwd,
    env,
    stdin: outputMode === 'inherit' ? 'inherit' : 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
    detached: process.platform !== 'win32',
    windowsHide: true
  })

  const readers = [child.stdout.getReader(), child.stderr.getReader()]
  const output = ['', '']

  const drain = async (index: number) => {
    const decoder = new TextDecoder()
    for (;;) {
      const { done, value } = await readers[index].read()
      if (done) break
      output[index] += decoder.decode(value, { stream: true })
      if (outputMode === 'inherit')
        await (index === 0 ? Bun.stdout : Bun.stderr).write(value)
    }
    output[index] += decoder.decode()
  }

  const completed = Promise.all([drain(0), drain(1), child.exited])

  const failure = (reason: string) =>
    new Error(`${label} ${reason} in ${cwd}\n${output.join('\n')}`)

  let stop = Promise.resolve()
  let timer: ReturnType<typeof setTimeout> | undefined

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      stop = (async () => {
        try {
          if (process.platform === 'win32')
            await Bun.spawn(
              ['taskkill', '/pid', String(child.pid), '/T', '/F'],
              {
                stdout: 'ignore',
                stderr: 'ignore',
                windowsHide: true,
                timeout: 5000,
                killSignal: 'SIGKILL'
              }
            ).exited
          else {
            try {
              process.kill(-child.pid, 'SIGKILL')
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
            }
          }
        } finally {
          if (child.exitCode === null) child.kill('SIGKILL')
          await Promise.allSettled([
            child.exited,
            ...readers.map(reader => reader.cancel())
          ])
        }
      })()
      reject(failure(`timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    const [, , exitCode] = await Promise.race([completed, deadline])
    if (exitCode !== 0) throw failure(`exited with code ${exitCode}`)

    log?.(
      `Finished ${label} in ${((performance.now() - started) / 1000).toFixed(2)}s`
    )

    return output[0]
  } finally {
    clearTimeout(timer)
    await stop
  }
}

export async function runProcess(
  command: string,
  args: string[],
  cwd: string,
  options: Omit<ProcessOptions, 'output'> = {}
) {
  await captureProcess(command, args, cwd, { ...options, output: 'inherit' })
}
