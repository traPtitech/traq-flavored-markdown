import {
  type ContractDefinition,
  type ContractField,
  type ContractShape,
  normalizeContracts
} from './ir.ts'
import { type RawSchema, quoted as q } from './schema.ts'
import type { NodeStructure } from './structure.ts'

const typeName = (name: string) => name.replace(/Data$/, '')
const fieldName = (name: string) =>
  name === 'id'
    ? 'ID'
    : name.replace(
        /(^|_)([a-z])/g,
        (_: string, _prefix: string, letter: string) => letter.toUpperCase()
      )
const enumName = (value: string) =>
  (({
    '*': 'Asterisk',
    '-': 'Dash',
    '+': 'Plus',
    '.': 'Period',
    ')': 'Parenthesis'
  })[value] ??
    value
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map(part => part[0].toUpperCase() + part.slice(1))
      .join('')) ||
  'Empty'

function goType(shape: ContractShape): string {
  switch (shape.kind) {
    case 'reference':
      return typeName(shape.name)
    case 'string':
    case 'enum':
    case 'literal':
      return 'string'
    case 'boolean':
      return 'bool'
    case 'integer':
      return shape.format
    case 'number':
      return 'float64'
    case 'nullable':
      return '*' + goType(shape.inner)
    case 'array':
      return '[]' + goType(shape.items)
    case 'object':
      return `struct {\n${fields(shape.fields)}\n}`
    case 'union':
      throw new Error('Go unions must be named contracts')
  }
}

const optional = (field: ContractField) =>
  !field.required && !Object.hasOwn(field, 'default')
const fieldType = (field: ContractField) =>
  (optional(field) ? '*' : '') + goType(field.shape)
const canOmit = (field: ContractField) =>
  !field.required &&
  (!Object.hasOwn(field, 'default') ||
    field.default === null ||
    field.default === '' ||
    field.default === false ||
    field.default === 0 ||
    (Array.isArray(field.default) && field.default.length === 0))
const fields = (value: readonly ContractField[]) =>
  value
    .map(
      field =>
        `${fieldName(field.name)} ${fieldType(field)} \`json:${q(field.name + (canOmit(field) ? ',omitempty' : ''))}\``
    )
    .join('\n')

/** A decoder builds each value once; named references invoke their own decoder. */
function decoder(shape: ContractShape): string {
  const type = goType(shape)
  switch (shape.kind) {
    case 'integer':
    case 'number':
      return `func(raw json.RawMessage, value *${type}) error { if err := contract.Decode(raw, value); err != nil { return err }; if *value < ${shape.min} || *value > ${shape.max} { return fmt.Errorf("number outside schema range") }; return nil }`
    case 'nullable':
      return `func(raw json.RawMessage, value *${type}) error { return contract.Nullable(raw, value, ${decoder(shape.inner)}) }`
    case 'array':
      return `func(raw json.RawMessage, value *${type}) error { if err := contract.Array(raw, value, ${decoder(shape.items)}); err != nil { return err }; ${shape.minItems !== undefined ? `if len(*value) < ${shape.minItems} { return fmt.Errorf("array shorter than schema bound") };` : ''} ${shape.maxItems !== undefined ? `if len(*value) > ${shape.maxItems} { return fmt.Errorf("array longer than schema bound") };` : ''} return nil }`
    case 'enum':
    case 'literal': {
      const choices = shape.kind === 'literal' ? [shape.value] : shape.values
      return `func(raw json.RawMessage, value *string) error { if err := contract.Decode(raw, value); err != nil { return err }; return contract.Enum(*value, ${choices.map(value => q(value)).join(', ')}) }`
    }
    case 'object':
      return `func(raw json.RawMessage, value *${type}) error { object, err := contract.Object(raw); if err != nil { return err }; ${decodeFields(shape.fields, '*value', true)}; return nil }`
    default:
      return `contract.Decode[${type}]`
  }
}

function decodeFields(
  value: readonly ContractField[],
  destination: string,
  parenthesize = false,
  extraAllowed: string[] = []
) {
  const target = parenthesize ? `(${destination})` : destination
  const allowed = [...extraAllowed, ...value.map(field => field.name)].map(
    name => q(name)
  )
  return [
    `if err := contract.Fields(object${allowed.length ? ', ' + allowed.join(', ') : ''}); err != nil { return err }`,
    ...value.map(field => {
      const member = `${target}.${fieldName(field.name)}`
      const decode = optional(field)
        ? `var present ${goType(field.shape)}\nif err := (${decoder(field.shape)})(raw, &present); err != nil { return fmt.Errorf("field %q: %w", ${q(field.name)}, err) }\n${member} = &present`
        : `if err := (${decoder(field.shape)})(raw, &${member}); err != nil { return fmt.Errorf("field %q: %w", ${q(field.name)}, err) }`
      const missing = field.required
        ? `return fmt.Errorf("missing required field %q", ${q(field.name)})`
        : Object.hasOwn(field, 'default')
          ? `if err := (${decoder(field.shape)})(json.RawMessage(${q(JSON.stringify(field.default))}), &${member}); err != nil { return err }`
          : ''
      return `if raw, present := object[${q(field.name)}]; present {\n${decode}\n}${missing ? ` else {\n${missing}\n}` : ''}`
    })
  ].join('\n')
}

function objectDeclaration(
  name: string,
  value: Extract<ContractShape, { kind: 'object' }>
) {
  return (
    `type ${name} struct {\n${fields(value.fields)}\n}\n` +
    `func (value *${name}) UnmarshalJSON(raw []byte) error {\n` +
    `object, err := contract.Object(raw)\nif err != nil { return err }\n` +
    `type wire ${name}\nvar decoded wire\n${decodeFields(value.fields, 'decoded')}\n` +
    `*value = ${name}(decoded)\nreturn nil\n}\n`
  )
}

function enumDeclaration(name: string, values: string[]) {
  const constants = values.map(value => name + enumName(value))
  if (new Set(constants).size !== constants.length)
    throw new Error('Conflicting Go enum members: ' + name)
  const choices = values.map(value => q(value)).join(', ')
  return (
    `type ${name} string\nconst (\n` +
    values
      .map((value, index) => `${constants[index]} ${name} = ${q(value)}`)
      .join('\n') +
    '\n)\n' +
    `func (value *${name}) UnmarshalJSON(raw []byte) error {\nvar decoded string\nif err := contract.Decode(raw, &decoded); err != nil { return err }\nif err := contract.Enum(decoded, ${choices}); err != nil { return err }\n*value = ${name}(decoded)\nreturn nil\n}\n` +
    `func (value ${name}) MarshalJSON() ([]byte, error) {\nif err := contract.Enum(string(value), ${choices}); err != nil { return nil, err }\nreturn json.Marshal(string(value))\n}\n`
  )
}

function unionDeclaration(
  name: string,
  shape: Extract<ContractShape, { kind: 'union' }>
) {
  if (!shape.discriminator)
    throw new Error('Go unions require a string type tag: ' + name)
  const variants = shape.variants.map(variant => {
    if (variant.kind !== 'object')
      throw new Error('Go unions require tagged object variants: ' + name)
    const tag = variant.fields.find(field => field.name === shape.discriminator)
    if (!tag || tag.shape.kind !== 'literal')
      throw new Error('Go unions require a string type tag: ' + name)
    return {
      tag: tag.shape.value,
      member: enumName(tag.shape.value),
      fields: variant.fields.filter(field => field !== tag)
    }
  })
  if (new Set(variants.map(variant => variant.member)).size !== variants.length)
    throw new Error('Conflicting Go union variants: ' + name)
  return (
    `type ${name} struct {\n${variants.map(variant => `${variant.member} *${name}${variant.member}`).join('\n')}\n}\n` +
    variants
      .map(
        variant =>
          `type ${name}${variant.member} struct {\n${fields(variant.fields)}\n}\n`
      )
      .join('') +
    `func (value *${name}) UnmarshalJSON(raw []byte) error {\nobject, err := contract.Object(raw)\nif err != nil { return err }\nvar tag string\nif err := contract.Decode(object[${q(shape.discriminator)}], &tag); err != nil { return err }\nswitch tag {\n` +
    variants
      .map(
        variant =>
          `case ${q(variant.tag)}:\nvar decoded ${name}${variant.member}\n${decodeFields(variant.fields, 'decoded', false, [shape.discriminator!])}\n*value = ${name}{${variant.member}: &decoded}\nreturn nil`
      )
      .join('\n') +
    '\n}\nreturn fmt.Errorf("unknown union tag %q", tag)\n}\n' +
    `func (value ${name}) MarshalJSON() ([]byte, error) {\ncount := 0\n${variants.map(variant => `if value.${variant.member} != nil { count++ }`).join('\n')}\nif count != 1 { return nil, fmt.Errorf("union requires exactly one variant") }\nvar raw []byte\nvar err error\n` +
    variants
      .map(
        variant =>
          `if value.${variant.member} != nil { raw, err = json.Marshal(struct { Type string \`json:"type"\`; *${name}${variant.member} }{Type: ${q(variant.tag)}, ${name}${variant.member}: value.${variant.member}}) }`
      )
      .join('\n') +
    `\nif err != nil { return nil, err }\nvar checked ${name}\nif err := json.Unmarshal(raw, &checked); err != nil { return nil, err }\nreturn raw, nil\n}\n`
  )
}

export function goFile(packageName: string, source: string) {
  // Ignore generated string literals, including struct tags, when selecting imports.
  const code = source.replace(/"(?:\\.|[^"\\])*"|`[^`]*`/g, '')
  const imports = Object.entries({
    json: 'encoding/json',
    fmt: 'fmt',
    contract:
      'github.com/traPtitech/traq-flavored-markdown/packages/core/go/contract',
    ast: 'github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast',
    binding:
      'github.com/traPtitech/traq-flavored-markdown/packages/core/go/binding'
  }).filter(([name]) => new RegExp('\\b' + name + '\\.').test(code))
  return (
    '// Code generated from Rust contracts. DO NOT EDIT.\npackage ' +
    packageName +
    '\n' +
    (imports.length
      ? 'import (' + imports.map(([, path]) => q(path)).join('\n') + ')\n'
      : '') +
    source
  )
}

export function emitGoDefinition(definition: ContractDefinition) {
  const name = typeName(definition.name)
  const value = definition.shape
  if (value.kind === 'enum') return enumDeclaration(name, value.values)
  if (value.kind === 'union') return unionDeclaration(name, value)
  if (value.kind === 'object') return objectDeclaration(name, value)
  throw new Error('Contract must be object, enum or tagged union')
}

export function goContract(schema: RawSchema, root = schema) {
  const module = normalizeContracts([schema], {}, root)
  return emitGoDefinition(module.definitions.get(schema.title!)!)
}

export function goPayload(wireName: string, schema: RawSchema) {
  const module = normalizeContracts([schema])
  const definition = module.definitions.get(schema.title!)!
  if (definition.shape.kind !== 'object')
    throw new Error('Payload must be object')
  const name = typeName(definition.name)
  return (
    `const ${name}Name = ${q(wireName)}\n` +
    emitGoDefinition(definition) +
    `func (*${name}) NodePayload() {}\n`
  )
}

export function goNodes(
  entries: [string, RawSchema][],
  packageName = 'nodes',
  structures: Readonly<Record<string, NodeStructure | undefined>> = {}
) {
  const names = entries.map(([, schema]) => typeName(schema.title!))
  if (new Set(names).size !== names.length)
    throw new Error('Duplicate generated payload type')
  const module = normalizeContracts(entries.map(([, schema]) => schema))
  return goFile(
    packageName,
    [...module.definitions.values()].map(emitGoDefinition).join('\n') +
      entries
        .map(
          ([key, schema]) =>
            `const ${typeName(schema.title!)}Name = ${q(key)}\nfunc (*${typeName(schema.title!)}) NodePayload() {}\n` +
            (structures[key]
              ? goStructure(typeName(schema.title!), structures[key]!)
              : '')
        )
        .join('\n') +
      'func NewPayload(kind string) ast.Payload {\nswitch kind {\n' +
      entries
        .map(
          ([, schema]) =>
            `case ${typeName(schema.title!)}Name: return &${typeName(schema.title!)}{}`
        )
        .join('\n') +
      '\n};return nil\n}\n'
  )
}

function goStructure(name: string, structure: NodeStructure) {
  const strings = (values: readonly string[]) =>
    `[]string{${values.map(value => q(value)).join(',')}}`
  const children = structure.children
  const fields = [`Kind:${q(children.kind)}`]
  if ('roles' in children)
    fields.push(
      `Roles:${strings(children.roles)}`,
      `Nonempty:${children.nonempty}`
    )
  if ('types' in children)
    fields.push(
      `Types:${strings(children.types)}`,
      `Nonempty:${children.nonempty}`
    )
  if (children.kind === 'sequence')
    fields.push(
      `Prefix:${strings(children.prefix)}`,
      `Rest:${q(children.rest)}`,
      `HasArity:${children.arityField !== undefined}`
    )
  return (
    `func (*${name}) NodeStructure() ast.NodeStructure { return ast.NodeStructure{Role:${q(structure.role)},Children:ast.ChildStructure{${fields.join(',')}}} }\n` +
    (children.kind === 'sequence' && children.arityField !== undefined
      ? `func (value *${name}) ChildArity() int { return len(value.${fieldName(children.arityField)}) }\n`
      : '')
  )
}
