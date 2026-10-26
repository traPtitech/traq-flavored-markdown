import {
  emitGoDeclarations,
  goFile
} from '../../../../tools/contracts/emitters/go.ts'
import { emitContractValidators } from '../../../../tools/contracts/emitters/typescript-validators.ts'
import { emitTypeScriptDeclarations } from '../../../../tools/contracts/emitters/typescript.ts'
import {
  type Direction,
  normalizeContracts
} from '../../../../tools/contracts/model/ir.ts'
import type { RawSchema } from '../../../../tools/contracts/model/schema.ts'

export function processingFiles(
  schemas: Record<string, RawSchema>,
  directions: Readonly<Record<string, Direction>> = {}
) {
  const contracts = normalizeContracts(Object.values(schemas), directions)
  return new Map([
    [
      'typescript/src/generated/processing.ts',
      '// Generated from Rust processing contracts. Do not edit.\n' +
        [...emitTypeScriptDeclarations(contracts).values()].join('\n') +
        '\n' +
        emitContractValidators(
          contracts,
          '@traq-flavored-markdown/core/validation'
        ) +
        contracts.roots
          .map(
            name =>
              `export const is${name} = (value: unknown): value is ${name} => validate${name}(value)`
          )
          .join('\n') +
        '\n'
    ],
    [
      'go/generated_processing.go',
      goFile('markdown', emitGoDeclarations(contracts))
    ]
  ])
}
