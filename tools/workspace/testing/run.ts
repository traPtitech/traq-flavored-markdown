import { repositoryRoot } from '../paths.ts'
import { type SuiteName, discoverTests, suiteFor, suites } from './suites.ts'

const selected = Bun.argv.slice(2)
if (selected.some(name => !Object.hasOwn(suites, name)))
  throw new Error('Expected test suite: ' + Object.keys(suites).join(', '))
const files = discoverTests()
if (!files.length) throw new Error('No TypeScript tests discovered')
// Classify every discovered file, even when running only one suite. New tests
// cannot silently fall out of the selected resource graph.
const classified = files.map(file => ({ file, suite: suiteFor(file) }))
for (const suite of (selected.length
  ? selected
  : Object.keys(suites)) as SuiteName[]) {
  const tests = classified
    .filter(test => test.suite === suite)
    .map(({ file }) => './' + file.replaceAll('\\', '/'))
  if (!tests.length) continue
  console.log(`${suite}: ${suites[suite].resources}`)
  const process = Bun.spawn(
    [
      Bun.argv[0],
      'test',
      '--timeout',
      String(suites[suite].timeout),
      '--max-concurrency',
      '1',
      ...tests
    ],
    {
      cwd: repositoryRoot,
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit'
    }
  )
  if ((await process.exited) !== 0)
    throw new Error(`${suite} test suite failed`)
}
