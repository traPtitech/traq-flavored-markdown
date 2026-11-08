import {
  emitGoDeclarations,
  goFile,
  goFragment,
  mergeGo
} from '../../../../tools/contracts/emitters/go.ts'
import {
  block,
  lines,
  sections,
  sourceFile
} from '../../../../tools/contracts/emitters/source.ts'
import { emitContractValidators } from '../../../../tools/contracts/emitters/typescript-validators.ts'
import { emitTypeScriptDeclarations } from '../../../../tools/contracts/emitters/typescript.ts'
import { normalizeContracts } from '../../../../tools/contracts/model/ir.ts'
import type { ArtifactManifest } from '../../../../tools/contracts/model/manifest.ts'

export type {
  Abi,
  Operation,
  ArtifactManifest
} from '../../../../tools/contracts/model/manifest.ts'

export function abiFiles(manifest: ArtifactManifest) {
  const error = { ...manifest.abi.error, title: 'WireError' }
  const contracts = normalizeContracts([error], { WireError: 'response' })
  const codes = contracts.definitions.get('ErrorCode')?.shape
  if (codes?.kind !== 'enum') {
    throw new Error('ABI must define ErrorCode as a string enum')
  }

  const files = new Map<string, string>()

  files.set(
    'typescript/src/generated/abi.ts',
    sourceFile(
      lines(
        '// Generated from the Rust ABI contract. Do not edit.',
        sections([...emitTypeScriptDeclarations(contracts).values()])
      ),
      emitContractValidators(
        contracts,
        '@traq-flavored-markdown/core/validation'
      ),
      'export const isWireError = (value: unknown): value is WireError => validateWireError(value)',
      `export const operations = Object.freeze(${JSON.stringify(manifest.abi.operations)} as const)`,
      `export const abiExports = Object.freeze(${JSON.stringify(manifest.abi.exports)} as const)`
    )
  )

  files.set(
    'typescript/src/generated/artifact.ts',
    sourceFile(
      lines(
        '// Generated from the Rust ABI contract. Do not edit.',
        `export const contractId = ${JSON.stringify(manifest.contractId)}`,
        `export const sourceFingerprint = ${JSON.stringify(manifest.provenance.sourceFingerprint)}`,
        `export const inputBytes = ${manifest.limits.inputBytes}`,
        `export const outputBytes = ${manifest.limits.outputBytes}`
      ),
      `export const documentLimits = Object.freeze(${JSON.stringify(manifest.limits.document)} as const)`
    )
  )

  const strings = (values: string[]) =>
    `[]string{${values.map(value => JSON.stringify(value)).join(',')}}`

  files.set(
    'go/generated_artifact.go',
    sourceFile(
      lines(
        '// Code generated from the Rust ABI contract. DO NOT EDIT.',
        'package markdown'
      ),
      lines(
        'import "github.com/traPtitech/traq-flavored-markdown/packages/core/go/binding"',
        'import "github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"'
      ),
      lines(
        `const contractID = ${JSON.stringify(manifest.contractId)}`,
        `const sourceFingerprint = ${JSON.stringify(manifest.provenance.sourceFingerprint)}`,
        `const inputBytes = ${manifest.limits.inputBytes}`,
        `const outputBytes = ${manifest.limits.outputBytes}`,
        `const memoryPages = ${manifest.limits.memoryBytes / 65536}`,
        `var documentLimits = ast.Limits{SourceBytes:${manifest.limits.document.sourceBytes},PayloadBytes:${manifest.limits.document.payloadBytes},Nodes:${manifest.limits.document.nodes},Depth:${manifest.limits.document.depth}}`,
        Object.entries(manifest.abi.operations).map(
          ([name, operation]) =>
            `var operation${name[0].toUpperCase() + name.slice(1)} = binding.Operation{Export:${JSON.stringify(operation.export)}, Input:${JSON.stringify(operation.input)}, Params:${strings(operation.params)}, Result:${JSON.stringify(operation.result)}, Configuration:${operation.configuration}}`
        )
      ),
      block(
        'var abiExports = map[string]binding.Signature{',
        Object.entries(manifest.abi.exports).map(
          ([name, signature]) =>
            `${JSON.stringify(name)}: {Params:${strings(signature.params)}, Results:${strings(signature.results)}},`
        )
      )
    )
  )

  files.set(
    'go/generated_errors.go',
    goFile(
      'markdown',
      mergeGo(
        emitGoDeclarations(contracts),
        goFragment(wireErrorDecoder(), ['json', 'binding', 'ast'])
      )
    )
  )

  return files
}

function wireErrorDecoder() {
  const optionalFields = [
    ['Offset', 'value.Offset != nil', '*value.Offset'],
    [
      'Resource',
      'value.Resource != nil && *value.Resource != nil',
      '**value.Resource'
    ],
    ['Path', 'value.Path != nil && *value.Path != nil', '**value.Path'],
    [
      'Phase',
      'value.Phase != nil && *value.Phase != nil',
      'string(**value.Phase)'
    ],
    ['Rule', 'value.Rule != nil && *value.Rule != nil', '**value.Rule'],
    [
      'PayloadType',
      'value.PayloadType != nil && *value.PayloadType != nil',
      '**value.PayloadType'
    ],
    [
      'Span',
      'value.Span != nil && *value.Span != nil',
      '&ast.Span{Start:(*value.Span).Start, End:(*value.Span).End}'
    ]
  ] as const

  return block(
    'func decodeWireError(raw json.RawMessage) (*binding.Error, error) {',
    sections(
      lines(
        'var value WireError',
        block(
          'if err := json.Unmarshal(raw, &value); err != nil {',
          'return nil, err'
        )
      ),
      'result := &binding.Error{Code:string(value.Code), Message:value.Message}',
      optionalFields.map(([name, condition, value]) =>
        block(`if ${condition} {`, `result.${name} = ${value}`)
      ),
      'return result, nil'
    )
  )
}
