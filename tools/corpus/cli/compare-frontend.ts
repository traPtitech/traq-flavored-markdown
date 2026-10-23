import { runFrontend } from '../comparison/frontend-worker.ts'
import { parseComparisonPlan } from '../protocol/comparison.ts'
import { parseArgs } from './args.ts'
import { printJson } from './output.ts'

const { values } = parseArgs({ options: { plan: { type: 'string' } } })
if (!values.plan) throw new Error('--plan is required')
printJson(
  await runFrontend(
    parseComparisonPlan(await Bun.file(values.plan).json()),
    messages => {
      if (messages % 10000 === 0) printJson({ processed: messages })
    }
  )
)
