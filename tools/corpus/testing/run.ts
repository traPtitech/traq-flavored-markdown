import { runProcess } from '../../workspace/infrastructure/process.ts'
import { corpusRoot } from '../../workspace/paths.ts'

const files = [
  ...new Bun.Glob('**/*.spec.{ts,tsx}').scanSync({
    cwd: corpusRoot,
    onlyFiles: true
  })
]
  .filter(
    file =>
      !file.includes('.browser.spec.') &&
      !file.split(/[\\/]/).some(part => ['node_modules', 'dist'].includes(part))
  )
  .sort()
await runProcess(
  Bun.argv[0],
  ['test', ...files.map(file => './' + file)],
  corpusRoot
)
