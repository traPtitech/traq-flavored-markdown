import path from 'node:path'

import { repositoryRoot } from '../../../scripts/paths.ts'
import { runComparison } from '../comparison/workflow.ts'
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
    max: { type: 'number', default: 1000000, integer: true, min: 1 }
  }
})

console.log(JSON.stringify(await runComparison({ ...v, max: String(v.max) })))
