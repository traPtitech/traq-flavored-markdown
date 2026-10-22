import { emitGoDefinition, goFile } from '../../../../scripts/codegen/go.ts'
import { normalizeContracts } from '../../../../scripts/codegen/ir.ts'
import type { ArtifactManifest } from '../../../../scripts/codegen/manifest.ts'
import { emitContractValidators } from '../../../../scripts/codegen/typescript-validators.ts'
import { emitTypeScriptDeclarations } from '../../../../scripts/codegen/typescript.ts'

export type {
  Abi,
  Operation,
  ArtifactManifest
} from '../../../../scripts/codegen/manifest.ts'

export function abiFiles(manifest: ArtifactManifest) {
  const error = { ...manifest.abi.error, title: 'WireError' }
  const contracts = normalizeContracts([error], { WireError: 'response' })
  const codes = contracts.definitions.get('ErrorCode')?.shape
  if (codes?.kind !== 'enum')
    throw new Error('ABI must define ErrorCode as a string enum')
  const files = new Map<string, string>()
  files.set(
    'typescript/generated/abi.ts',
    [
      '// Generated from the Rust ABI contract. Do not edit.',
      [...emitTypeScriptDeclarations(contracts).values()].join('\n'),
      emitContractValidators(
        contracts,
        '@traq-flavored-markdown/core/validation'
      ),
      'export const isWireError = (value: unknown): value is WireError => validateWireError(value)',
      `export const operations = Object.freeze(${JSON.stringify(manifest.abi.operations)} as const)`,
      `export const abiExports = Object.freeze(${JSON.stringify(manifest.abi.exports)} as const)`,
      ''
    ].join('\n')
  )
  files.set(
    'typescript/generated/artifact.ts',
    [
      '// Generated from the Rust ABI contract. Do not edit.',
      `export const contractId = ${JSON.stringify(manifest.contractId)}`,
      `export const sourceFingerprint = ${JSON.stringify(manifest.provenance.sourceFingerprint)}`,
      `export const inputBytes = ${manifest.limits.inputBytes}`,
      `export const outputBytes = ${manifest.limits.outputBytes}`,
      `export const documentLimits = Object.freeze(${JSON.stringify(manifest.limits.document)} as const)`,
      ''
    ].join('\n')
  )
  const strings = (values: string[]) =>
    `[]string{${values.map(value => JSON.stringify(value)).join(',')}}`
  files.set(
    'go/generated_artifact.go',
    [
      '// Code generated from the Rust ABI contract. DO NOT EDIT.',
      'package markdown',
      'import "github.com/traPtitech/traq-flavored-markdown/packages/core/go/binding"',
      'import "github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"',
      `const contractID = ${JSON.stringify(manifest.contractId)}`,
      `const sourceFingerprint = ${JSON.stringify(manifest.provenance.sourceFingerprint)}`,
      `const inputBytes = ${manifest.limits.inputBytes}`,
      `const outputBytes = ${manifest.limits.outputBytes}`,
      `const memoryPages = ${manifest.limits.memoryBytes / 65536}`,
      `var documentLimits = ast.Limits{SourceBytes:${manifest.limits.document.sourceBytes},PayloadBytes:${manifest.limits.document.payloadBytes},Nodes:${manifest.limits.document.nodes},Depth:${manifest.limits.document.depth}}`,
      ...Object.entries(manifest.abi.operations).map(
        ([name, operation]) =>
          `var operation${name[0].toUpperCase() + name.slice(1)} = binding.Operation{Export:${JSON.stringify(operation.export)}, Input:${JSON.stringify(operation.input)}, Params:${strings(operation.params)}, Result:${JSON.stringify(operation.result)}, Configuration:${operation.configuration}}`
      ),
      'var abiExports = map[string]binding.Signature{',
      ...Object.entries(manifest.abi.exports).map(
        ([name, signature]) =>
          `${JSON.stringify(name)}: {Params:${strings(signature.params)}, Results:${strings(signature.results)}},`
      ),
      '}',
      ''
    ].join('\n')
  )
  files.set(
    'go/generated_errors.go',
    goFile(
      'markdown',
      [...contracts.definitions.values()].map(emitGoDefinition).join('\n') +
        `
func decodeWireError(raw json.RawMessage) (*binding.Error, error) {
  var value WireError
  if err := json.Unmarshal(raw, &value); err != nil { return nil, err }
  result := &binding.Error{Code:string(value.Code), Message:value.Message}
  if value.Offset != nil { result.Offset = *value.Offset }
  if value.Resource != nil && *value.Resource != nil { result.Resource = **value.Resource }
  if value.Path != nil && *value.Path != nil { result.Path = **value.Path }
  if value.Phase != nil && *value.Phase != nil { result.Phase = string(**value.Phase) }
  if value.Rule != nil && *value.Rule != nil { result.Rule = **value.Rule }
  if value.PayloadType != nil && *value.PayloadType != nil { result.PayloadType = **value.PayloadType }
  if value.Span != nil && *value.Span != nil { result.Span = &ast.Span{Start:(*value.Span).Start, End:(*value.Span).End} }
  return result, nil
}
`
    )
  )
  return files
}
