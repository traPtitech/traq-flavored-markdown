import path from 'node:path'

import { repositoryRoot } from '../../../tools/workspace/paths.ts'
import { runComparison } from '../comparison/workflow.ts'
import { defaultWarmups } from '../shared/comparison.ts'
import { parseArgs } from './args.ts'

const { values: v } = parseArgs({
  options: {
    corpus: { type: 'string' },
    out: { type: 'string' },
    traq: {
      type: 'string',
      default: path.resolve(repositoryRoot, '../../traPtitech/traQ')
    },
    sui: {
      type: 'string',
      default: path.resolve(repositoryRoot, '../../traPtitech/traQ_S-UI')
    },
    'traq-ref': { type: 'string', default: 'origin/master' },
    'sui-ref': { type: 'string', default: 'origin/master' },
    origin: { type: 'string', default: 'https://q.trap.jp' },
    max: { type: 'number', default: 1000000, integer: true, min: 1 },
    warmups: { type: 'number', default: defaultWarmups, integer: true, min: 0 }
  }
})

if (!v.corpus) throw new Error('--corpus messages.jsonl is required')
console.log(
  JSON.stringify(
    await runComparison({
      corpus: v.corpus,
      output: v.out,
      suiDirectory: v.sui!,
      traqDirectory: v.traq!,
      suiRef: v['sui-ref']!,
      traqRef: v['traq-ref']!,
      origin: v.origin!,
      max: v.max!,
      warmups: v.warmups!
    })
  )
)
