import type { Direction } from './ir.ts'
import { type RawSchema, shape } from './schema.ts'
import type { NodeRole, NodeStructure } from './structure.ts'

export type NodeContract = {
  group: string
  schema: RawSchema
  structure: NodeStructure
}
export type NodeManifest = { nodes: Record<string, NodeContract> }
export type PresetTree = { [name: string]: number | PresetTree }
export type DocumentLimits = {
  sourceBytes: number
  payloadBytes: number
  nodes: number
  depth: number
}
export type ArtifactLimits = {
  inputBytes: number
  outputBytes: number
  memoryBytes: number
  document: DocumentLimits
}
export type Provenance = { sourceFingerprint: string }
export type WasmType = 'i32'
export type OperationResult =
  'configuration' | 'document' | 'extraction' | 'text' | 'processing'
export type Signature = { params: WasmType[]; results: WasmType[] }
export type Operation = {
  export: string
  input: 'text' | 'json'
  params: WasmType[]
  result: OperationResult
  configuration: boolean
}
export type Abi = {
  version: number
  operations: Record<string, Operation>
  exports: Record<string, Signature>
  error: RawSchema
}
export type ArtifactMetadata = {
  contractId: string
  provenance: Provenance
  limits: ArtifactLimits
  presets: PresetTree
}
export type ArtifactManifest = ArtifactMetadata &
  NodeManifest & {
    abi: Abi
    processing: Record<string, RawSchema>
    directions: Record<string, Direction>
  }

function invalid(path: string): never {
  throw new TypeError('Invalid contract manifest: ' + path)
}
function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path)
  return value as Record<string, unknown>
}
function string(value: unknown, path: string): string {
  if (typeof value !== 'string') invalid(path)
  return value
}
function integer(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    invalid(path)
  return value
}
function positive(value: unknown, path: string): number {
  const result = integer(value, path)
  if (result === 0) invalid(path)
  return result
}
function wasmTypes(value: unknown, path: string): WasmType[] {
  return strings(value, path).map((type, index) => {
    if (type !== 'i32') invalid(`${path}[${index}]`)
    return type
  })
}
function operationResult(value: unknown, path: string): OperationResult {
  if (
    value !== 'configuration' &&
    value !== 'document' &&
    value !== 'extraction' &&
    value !== 'text' &&
    value !== 'processing'
  )
    invalid(path)
  return value
}
function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') invalid(path)
  return value
}
function strings(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) invalid(path)
  return value.map((entry, index) => string(entry, `${path}[${index}]`))
}
function entries<T>(
  value: unknown,
  path: string,
  parse: (value: unknown, path: string) => T
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record(value, path)).map(([key, entry]) => [
      key,
      parse(entry, `${path}.${key}`)
    ])
  )
}
function schema(value: unknown, path: string): RawSchema {
  const result = record(value, path)
  try {
    shape(result)
  } catch (cause) {
    throw new TypeError('Invalid contract schema: ' + path, { cause })
  }
  return result
}
const nodeRoles = ['block', 'inline', 'structural', 'opaque'] as const
function role(value: unknown, path: string): NodeRole {
  if (!nodeRoles.some(role => role === value)) invalid(path)
  return value as NodeRole
}
function structure(value: unknown, path: string): NodeStructure {
  const input = record(value, path),
    children = record(input.children, path + '.children')
  const kind = children.kind
  let result: NodeStructure['children']
  switch (kind) {
    case 'leaf':
    case 'any':
      result = { kind }
      break
    case 'roles':
      result = {
        kind,
        roles: strings(children.roles, path).map(value => role(value, path)),
        nonempty: boolean(children.nonempty, path)
      }
      break
    case 'types':
      result = {
        kind,
        types: strings(children.types, path),
        nonempty: boolean(children.nonempty, path)
      }
      break
    case 'sequence':
      result = {
        kind,
        prefix: strings(children.prefix, path + '.prefix'),
        rest: string(children.rest, path + '.rest'),
        ...(children.arityField === undefined
          ? {}
          : { arityField: string(children.arityField, path + '.arityField') })
      }
      break
    default:
      invalid(path + '.children.kind')
  }
  return { role: role(input.role, path + '.role'), children: result }
}

export function parseNodeManifest(value: unknown): NodeManifest {
  const input = record(value, '$')
  return {
    nodes: entries(input.nodes, '$.nodes', (value, path) => {
      const node = record(value, path)
      return {
        group: string(node.group, path + '.group'),
        schema: schema(node.schema, path + '.schema'),
        structure: structure(node.structure, path + '.structure')
      }
    })
  }
}

function presets(value: unknown, path: string): PresetTree {
  return entries(value, path, (entry, path): number | PresetTree =>
    typeof entry === 'number' ? integer(entry, path) : presets(entry, path)
  )
}

export function parseArtifactMetadata(value: unknown): ArtifactMetadata {
  const input = record(value, '$'),
    limits = record(input.limits, '$.limits')
  const provenance = record(input.provenance, '$.provenance')
  return {
    contractId: string(input.contractId, '$.contractId'),
    provenance: {
      sourceFingerprint: string(
        provenance.sourceFingerprint,
        '$.provenance.sourceFingerprint'
      )
    },
    presets: presets(input.presets, '$.presets'),
    limits: {
      inputBytes: positive(limits.inputBytes, '$.limits.inputBytes'),
      outputBytes: positive(limits.outputBytes, '$.limits.outputBytes'),
      memoryBytes: positive(limits.memoryBytes, '$.limits.memoryBytes'),
      document: parseDocumentLimits(limits.document, '$.limits.document')
    }
  }
}

export function parseArtifactManifest(value: unknown): ArtifactManifest {
  const input = record(value, '$'),
    abi = record(input.abi, '$.abi')
  const result: ArtifactManifest = {
    ...parseArtifactMetadata(input),
    ...parseNodeManifest(input),
    abi: {
      version: positive(abi.version, '$.abi.version'),
      error: schema(abi.error, '$.abi.error'),
      operations: entries(abi.operations, '$.abi.operations', (value, path) => {
        const operation = record(value, path)
        if (operation.input !== 'text' && operation.input !== 'json')
          invalid(path + '.input')
        return {
          export: string(operation.export, path + '.export'),
          input: operation.input,
          params: wasmTypes(operation.params, path + '.params'),
          result: operationResult(operation.result, path + '.result'),
          configuration: boolean(
            operation.configuration,
            path + '.configuration'
          )
        }
      }),
      exports: entries(abi.exports, '$.abi.exports', (value, path) => {
        const signature = record(value, path)
        return {
          params: wasmTypes(signature.params, path + '.params'),
          results: wasmTypes(signature.results, path + '.results')
        }
      })
    },
    processing: entries(input.processing, '$.processing', schema),
    directions: entries(input.directions, '$.directions', (value, path) => {
      if (value !== 'request' && value !== 'response') invalid(path)
      return value
    })
  }
  for (const [name, operation] of Object.entries(result.abi.operations)) {
    const signature = result.abi.exports[operation.export]
    if (
      !signature ||
      JSON.stringify(signature.params) !== JSON.stringify(operation.params) ||
      signature.results.length !== 1 ||
      signature.results[0] !== 'i32'
    )
      invalid(`$.abi.operations.${name}.export`)
    if (operation.configuration !== (operation.result === 'configuration'))
      invalid(`$.abi.operations.${name}.configuration`)
  }
  for (const name of new Set([
    ...Object.keys(result.processing),
    ...Object.keys(result.directions)
  ])) {
    if (
      !Object.hasOwn(result.processing, name) ||
      !Object.hasOwn(result.directions, name)
    )
      invalid(`$.directions.${name}`)
  }
  if (result.limits.memoryBytes % 65536 !== 0) invalid('$.limits.memoryBytes')
  return result
}

export function parseDocumentLimits(
  value: unknown,
  path = '$.limits'
): DocumentLimits {
  const input = record(value, path)
  return {
    sourceBytes: positive(input.sourceBytes, path + '.sourceBytes'),
    payloadBytes: positive(input.payloadBytes, path + '.payloadBytes'),
    nodes: positive(input.nodes, path + '.nodes'),
    depth: positive(input.depth, path + '.depth')
  }
}
export function parseCoreManifest(value: unknown): { limits: DocumentLimits } {
  return { limits: parseDocumentLimits(record(value, '$').limits) }
}
