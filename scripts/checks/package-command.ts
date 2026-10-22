/** Capture machine-readable stdout while reporting progress and bounding each check. */
export async function capturePackageCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = 120_000
) {
  const label = JSON.stringify([command, ...args])
  console.log(`[check:package] Starting ${label} in ${cwd}`)

  const started = performance.now()

  const child = Bun.spawn([command, ...args], {
    cwd,
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
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

    console.log(
      `[check:package] Finished ${label} in ${((performance.now() - started) / 1000).toFixed(2)}s`
    )

    return output[0]
  } finally {
    clearTimeout(timer)
    await stop
  }
}
