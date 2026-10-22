import { emitGoDefinition, goFile } from '../../../../scripts/codegen/go.ts'
import {
  type Direction,
  normalizeContracts
} from '../../../../scripts/codegen/ir.ts'
import type { RawSchema } from '../../../../scripts/codegen/schema.ts'
import { emitContractValidators } from '../../../../scripts/codegen/typescript-validators.ts'
import { emitTypeScriptDeclarations } from '../../../../scripts/codegen/typescript.ts'

export function processingFiles(
  schemas: Record<string, RawSchema>,
  directions: Readonly<Record<string, Direction>> = {}
) {
  const contracts = normalizeContracts(Object.values(schemas), directions)
  return new Map([
    [
      'typescript/generated/processing.ts',
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
      goFile(
        'markdown',
        [...contracts.definitions.values()].map(emitGoDefinition).join('\n')
      )
    ]
  ])
}
