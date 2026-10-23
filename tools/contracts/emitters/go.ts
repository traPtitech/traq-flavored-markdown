import {
  type ContractDefinition,
  type ContractField,
  type ContractModule,
  type ContractShape,
  normalizeContracts
} from '../model/ir.ts'
import { type RawSchema, quoted as q } from '../model/schema.ts'
import type { NodeStructure } from '../model/structure.ts'

type Definitions = ContractModule['definitions']

const typeName = (name: string) => name
const fieldName = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .split('_')
    .map(part => {
      const initialism = (
        {
          id: 'ID',
          url: 'URL',
          urls: 'URLs',
          html: 'HTML',
          json: 'JSON',
          utf8: 'UTF8'
        } as Record<string, string>
      )[part.toLowerCase()]
      return initialism ?? part[0].toUpperCase() + part.slice(1)
    })
    .join('')
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

function goType(shape: ContractShape, definitions: Definitions): string {
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
      return '*' + goType(shape.inner, definitions)
    case 'array':
      return '[]' + goType(shape.items, definitions)
    case 'object':
      return `struct {\n${fields(shape.fields, definitions)}\n}`
    case 'union':
      throw new Error('Go unions must be named contracts')
  }
}

const optional = (field: ContractField) =>
  !field.required && !Object.hasOwn(field, 'default')
const fieldType = (field: ContractField, definitions: Definitions) =>
  (optional(field) ? '*' : '') + goType(field.shape, definitions)

function excludesEmptyString(
  shape: ContractShape,
  definitions: Definitions
): boolean {
  if (shape.kind === 'reference') {
    const definition = definitions.get(shape.name)
    if (!definition) throw new Error('Unresolved Go contract: ' + shape.name)
    return excludesEmptyString(definition.shape, definitions)
  }
  return shape.kind === 'enum'
    ? !shape.values.includes('')
    : shape.kind === 'literal' && shape.value !== ''
}

// A nonzero default must not hide a valid explicit zero value. String enums
// that exclude the Go zero value can safely reserve it for an omitted default.
const canOmit = (field: ContractField, definitions: Definitions) =>
  !field.required &&
  (!Object.hasOwn(field, 'default') ||
    field.default === null ||
    field.default === '' ||
    field.default === false ||
    field.default === 0 ||
    (Array.isArray(field.default) && field.default.length === 0) ||
    excludesEmptyString(field.shape, definitions))
const fields = (value: readonly ContractField[], definitions: Definitions) =>
  value
    .map(
      field =>
        `${fieldName(field.name)} ${fieldType(field, definitions)} \`json:${q(field.name + (canOmit(field, definitions) ? ',omitempty' : ''))}\``
    )
    .join('\n')

/** A decoder builds each value once; named references invoke their own decoder. */
function decoder(shape: ContractShape, definitions: Definitions): string {
  const type = goType(shape, definitions)
  switch (shape.kind) {
    case 'string':
      if (shape.minLength === undefined && shape.maxLength === undefined)
        return 'contract.Decode[string]'
      return `func(raw json.RawMessage, value *string) error { if err := contract.Decode(raw, value); err != nil { return err }; length := uint64(utf8.RuneCountInString(*value)); ${shape.minLength !== undefined ? `if length < ${shape.minLength} { return fmt.Errorf("string shorter than schema bound") };` : ''} ${shape.maxLength !== undefined ? `if length > ${shape.maxLength} { return fmt.Errorf("string longer than schema bound") };` : ''} return nil }`
    case 'integer':
    case 'number':
      return `func(raw json.RawMessage, value *${type}) error { if err := contract.Decode(raw, value); err != nil { return err }; if *value < ${shape.min} || *value > ${shape.max} { return fmt.Errorf("number outside schema range") }; return nil }`
    case 'nullable':
      return `func(raw json.RawMessage, value *${type}) error { return contract.Nullable(raw, value, ${decoder(shape.inner, definitions)}) }`
    case 'array':
      return `func(raw json.RawMessage, value *${type}) error { if err := contract.Array(raw, value, ${decoder(shape.items, definitions)}); err != nil { return err }; ${shape.minItems !== undefined ? `if len(*value) < ${shape.minItems} { return fmt.Errorf("array shorter than schema bound") };` : ''} ${shape.maxItems !== undefined ? `if len(*value) > ${shape.maxItems} { return fmt.Errorf("array longer than schema bound") };` : ''} return nil }`
    case 'enum':
    case 'literal': {
      const choices = shape.kind === 'literal' ? [shape.value] : shape.values
      return `func(raw json.RawMessage, value *string) error { if err := contract.Decode(raw, value); err != nil { return err }; return contract.Enum(*value, ${choices.map(value => q(value)).join(', ')}) }`
    }
    case 'object':
      return `func(raw json.RawMessage, value *${type}) error { object, err := contract.Object(raw); if err != nil { return err }; ${decodeFields(shape.fields, definitions, '*value', true)}; return nil }`
    default:
      return `contract.Decode[${type}]`
  }
}

function decodeFields(
  value: readonly ContractField[],
  definitions: Definitions,
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
        ? `var present ${goType(field.shape, definitions)}\nif err := (${decoder(field.shape, definitions)})(raw, &present); err != nil { return fmt.Errorf("field %q: %w", ${q(field.name)}, err) }\n${member} = &present`
        : `if err := (${decoder(field.shape, definitions)})(raw, &${member}); err != nil { return fmt.Errorf("field %q: %w", ${q(field.name)}, err) }`
      const missing = field.required
        ? `return fmt.Errorf("missing required field %q", ${q(field.name)})`
        : Object.hasOwn(field, 'default')
          ? `if err := (${decoder(field.shape, definitions)})(json.RawMessage(${q(JSON.stringify(field.default))}), &${member}); err != nil { return err }`
          : ''
      return `if raw, present := object[${q(field.name)}]; present {\n${decode}\n}${missing ? ` else {\n${missing}\n}` : ''}`
    })
  ].join('\n')
}

function objectDeclaration(
  name: string,
  value: Extract<ContractShape, { kind: 'object' }>,
  definitions: Definitions
) {
  return (
    `type ${name} struct {\n${fields(value.fields, definitions)}\n}\n` +
    `func (value *${name}) UnmarshalJSON(raw []byte) error {\n` +
    `object, err := contract.Object(raw)\nif err != nil { return err }\n` +
    `type wire ${name}\nvar decoded wire\n${decodeFields(value.fields, definitions, 'decoded')}\n` +
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
  shape: Extract<ContractShape, { kind: 'union' }>,
  definitions: Definitions
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
          `type ${name}${variant.member} struct {\n${fields(variant.fields, definitions)}\n}\n`
      )
      .join('') +
    `func (value *${name}) UnmarshalJSON(raw []byte) error {\nobject, err := contract.Object(raw)\nif err != nil { return err }\nvar tag string\nif err := contract.Decode(object[${q(shape.discriminator)}], &tag); err != nil { return err }\nswitch tag {\n` +
    variants
      .map(
        variant =>
          `case ${q(variant.tag)}:\nvar decoded ${name}${variant.member}\n${decodeFields(variant.fields, definitions, 'decoded', false, [shape.discriminator!])}\n*value = ${name}{${variant.member}: &decoded}\nreturn nil`
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
    utf8: 'unicode/utf8',
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

function emitGoDefinition(
  definition: ContractDefinition,
  definitions: Definitions
) {
  const name = typeName(definition.name)
  const value = definition.shape
  if (value.kind === 'enum') return enumDeclaration(name, value.values)
  if (value.kind === 'union') return unionDeclaration(name, value, definitions)
  if (value.kind === 'object')
    return objectDeclaration(name, value, definitions)
  throw new Error('Contract must be object, enum or tagged union')
}

export function emitGoDeclarations(module: ContractModule) {
  return [...module.definitions.values()]
    .map(definition => emitGoDefinition(definition, module.definitions))
    .join('\n')
}

export function goContract(schema: RawSchema, root = schema) {
  const module = normalizeContracts([schema], {}, root)
  return emitGoDefinition(
    module.definitions.get(schema.title!)!,
    module.definitions
  )
}

export function goPayload(wireName: string, schema: RawSchema) {
  const module = normalizeContracts([schema])
  const definition = module.definitions.get(schema.title!)!
  if (definition.shape.kind !== 'object')
    throw new Error('Payload must be object')
  const name = typeName(definition.name)
  return (
    `const ${name}Name = ${q(wireName)}\n` +
    emitGoDefinition(definition, module.definitions) +
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
    emitGoDeclarations(module) +
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
