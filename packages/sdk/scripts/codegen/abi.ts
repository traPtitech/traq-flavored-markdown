import { normalizeContracts } from '../../../../scripts/codegen/ir.ts'
import type { RawSchema } from '../../../../scripts/codegen/schema.ts'
import { emitContractValidators } from '../../../../scripts/codegen/typescript-validators.ts'
import { emitTypeScriptDeclarations } from '../../../../scripts/codegen/typescript.ts'

export type Operation = {
  export: string
  input: 'text' | 'json'
  params: string[]
  result: string
  configuration: boolean
}
export type Abi = {
  version: number
  operations: Record<string, Operation>
  exports: Record<string, { params: string[]; results: string[] }>
  error: RawSchema
}
export type ArtifactManifest = {
  contractId: string
  provenance: { sourceFingerprint: string }
  limits: {
    inputBytes: number
    outputBytes: number
    memoryBytes: number
    document: {
      sourceBytes: number
      payloadBytes: number
      nodes: number
      depth: number
    }
  }
  abi: Abi
}

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
      `var wireErrorCodes = map[string]bool{${codes.values.map(code => `${JSON.stringify(code)}: true`).join(',')}}`,
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
  return files
}
