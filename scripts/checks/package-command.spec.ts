import path from 'node:path'

import { expect, test } from 'bun:test'

import { withTempDirectory } from '../testing/temp-directory.ts'
import { capturePackageCommand } from './package-command.ts'

test('package commands preserve JSON stdout and drain both output pipes', async () => {
  const output = await capturePackageCommand(
    Bun.argv[0],
    [
      '-e',
      'console.error("warning".repeat(20_000)); console.log(JSON.stringify({ value: process.argv.at(-1) }))',
      'spaces & shell characters'
    ],
    import.meta.dir
  )

  expect(JSON.parse(output)).toEqual({ value: 'spaces & shell characters' })
})

test('failed package commands report the command, cwd and captured diagnostics', async () => {
  const result = capturePackageCommand(
    Bun.argv[0],
    [
      '-e',
      'console.log("stdout detail"); console.error("stderr detail"); process.exit(7)'
    ],
    import.meta.dir
  )

  await expect(result).rejects.toThrow('exited with code 7')
  const error = await result.catch((error: Error) => error)

  expect(error).toBeInstanceOf(Error)
  expect((error as Error).message).toContain(import.meta.dir)
  expect((error as Error).message).toMatch(/\nstdout detail\r?\n/)
  expect((error as Error).message).toMatch(/\nstderr detail\r?\n/)
})

test('stalled package commands time out and terminate their process', async () => {
  await withTempDirectory('package-command-', async directory => {
    const pidFile = path.join(directory, 'child.pid')

    await expect(
      capturePackageCommand(
        Bun.argv[0],
        [
          '-e',
          'await Bun.write(process.argv.at(-1), String(process.pid)); console.error("before timeout"); setInterval(() => {}, 1000)',
          pidFile
        ],
        directory,
        1000
      )
    ).rejects.toThrow('timed out after 1000ms')

    const pid = Number(await Bun.file(pidFile).text())

    expect(() => process.kill(pid, 0)).toThrow()
  })
})

test.skipIf(process.platform !== 'win32')(
  'timing out a Windows command also terminates the process behind its cmd shim',
  async () => {
    await withTempDirectory('package-command-', async directory => {
      const pidFile = path.join(directory, 'child process.pid')
      const script = path.join(directory, 'wait.ts')
      const shim = path.join(directory, 'wait.cmd')

      await Bun.write(
        script,
        'await Bun.write(process.argv.at(-1), String(process.pid)); setInterval(() => {}, 1000)'
      )

      await Bun.write(
        shim,
        `@echo off\r\n"${Bun.argv[0]}" "${script}" "%~1"\r\n`
      )

      await expect(
        capturePackageCommand(shim, [pidFile], directory, 1000)
      ).rejects.toThrow('timed out after 1000ms')

      const pid = Number(await Bun.file(pidFile).text())

      expect(() => process.kill(pid, 0)).toThrow()
    })
  }
)
