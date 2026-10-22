import {
  type RawSchema,
  type Shape,
  shape
} from '../../../scripts/codegen/schema.ts'

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, canonical(entry)])
    )
  return value
}

const ordered = (values: unknown[]) =>
  values.map(canonical).sort((a, b) => {
    const left = JSON.stringify(a),
      right = JSON.stringify(b)
    return left < right ? -1 : left > right ? 1 : 0
  })

/** Type names and documentation describe generated APIs, not their wire values. */
function wireShape(value: Shape): unknown {
  const { name: _name, ...contract } = value
  switch (contract.kind) {
    case 'nullable':
      return { kind: contract.kind, inner: wireShape(contract.inner) }
    case 'array':
      return { ...contract, items: wireShape(contract.items) }
    case 'object':
      return {
        kind: contract.kind,
        fields: ordered(
          contract.fields.map(field => ({
            name: field.name,
            required: field.required,
            ...(Object.hasOwn(field, 'default')
              ? { default: field.default }
              : {}),
            shape: wireShape(field.shape)
          }))
        )
      }
    case 'union':
      return {
        kind: contract.kind,
        variants: ordered(contract.variants.map(wireShape))
      }
    case 'enum':
      return { ...contract, values: [...contract.values].sort() }
    default:
      return contract
  }
}

const wireSchema = (schema: RawSchema) => wireShape(shape(schema))

export interface IdentityContract {
  abi: { error?: RawSchema; [key: string]: unknown }
  nodes: Record<string, { schema: RawSchema; structure?: unknown }>
  processing?: Record<string, RawSchema>
  parseError?: RawSchema
  presets?: unknown
  limits?: unknown
  directions?: unknown
}

/** Hash only validated wire semantics; provenance and bytes have separate identities. */
export function semanticContractId(manifest: IdentityContract) {
  const contract = {
    abi: {
      ...manifest.abi,
      ...(manifest.abi.error ? { error: wireSchema(manifest.abi.error) } : {})
    },
    nodes: Object.fromEntries(
      Object.entries(manifest.nodes).map(([kind, node]) => [
        kind,
        { schema: wireSchema(node.schema), structure: node.structure }
      ])
    ),
    processing:
      manifest.processing &&
      Object.fromEntries(
        Object.entries(manifest.processing).map(([name, schema]) => [
          name,
          wireSchema(schema)
        ])
      ),
    parseError: manifest.parseError && wireSchema(manifest.parseError),
    presets: manifest.presets,
    limits: manifest.limits,
    directions: manifest.directions
  }
  return new Bun.CryptoHasher('sha256')
    .update(JSON.stringify(canonical(contract)))
    .digest('hex')
}
