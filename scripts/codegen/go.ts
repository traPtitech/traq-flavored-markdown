import type { ObjectShape, RawSchema, Shape, UnionShape } from './schema.ts'
import { quoted as q, shape, typeName } from './schema.ts'

const fieldName = (name: string) =>
  name === 'id'
    ? 'ID'
    : name.replace(/(^|_)([a-z])/g, (_: string, p: string, c: string) =>
        c.toUpperCase()
      )

function goType(s: Shape): string {
  if (s.kind === 'string') return 'string'
  if (s.kind === 'enum') return s.name ?? 'string'
  if (s.kind === 'literal') return 'string'
  if (s.kind === 'union') return s.name ?? 'json.RawMessage'
  if (s.kind === 'boolean') return 'bool'
  if (s.kind === 'integer') return s.format
  if (s.kind === 'nullable') return '*' + goType(s.inner)
  if (s.kind === 'array') return '[]' + goType(s.items)
  if (s.kind === 'object') return s.name ?? `struct {${fields(s)}}`
  throw new Error('Unsupported Go field: ' + (s as Shape).kind)
}

const fields = (s: ObjectShape) =>
  s.fields
    .map(f => `${fieldName(f.name)} ${goType(f.shape)} \`json:${q(f.name)}\``)
    .join('\n')

function check(s: Shape): string {
  if (s.kind === 'string') return 'contractString'
  if (s.kind === 'boolean') return 'contractBoolean'
  if (s.kind === 'integer')
    return `func(raw json.RawMessage) error { return contractInteger(raw, ${s.min}, ${s.max}) }`
  if (s.kind === 'enum')
    return `func(raw json.RawMessage) error { return contractEnum(raw, ${s.values.map(value => q(value)).join(', ')}) }`
  if (s.kind === 'literal')
    return `func(raw json.RawMessage) error { return contractEnum(raw, ${q(s.value)}) }`
  if (s.kind === 'union')
    return `func(raw json.RawMessage) error { return contractUnion(raw, ${s.variants.map(check).join(', ')}) }`
  if (s.kind === 'nullable')
    return `func(raw json.RawMessage) error { return contractNullable(raw, ${check(s.inner)}) }`
  if (s.kind === 'array')
    return `func(raw json.RawMessage) error { return contractArray(raw, ${check(s.items)}) }`
  if (s.kind === 'object') {
    const fields = (required: boolean) =>
      'map[string]contractCheck{' +
      s.fields
        .filter(f => f.required === required)
        .map(f => `${q(f.name)}: ${check(f.shape)}`)
        .join(', ') +
      '}'
    return `func(raw json.RawMessage) error { return contractObject(raw, ${fields(true)}, ${fields(false)}) }`
  }
  throw new Error('Unsupported Go validator: ' + (s as Shape).kind)
}

function objectDeclaration(name: string, s: ObjectShape) {
  return (
    `type ${name} struct {\n${fields(s)}\n}\n` +
    `func (value *${name}) UnmarshalJSON(raw []byte) error {\n` +
    `if err := (${check(s)})(raw); err != nil { return err }\n` +
    `type wire ${name}\nvar decoded wire\n` +
    `if err := json.Unmarshal(raw, &decoded); err != nil { return err }\n` +
    `*value = ${name}(decoded)\nreturn nil\n}\n`
  )
}

function enumName(value: string) {
  const name = value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join('')
  return name || 'Empty'
}

function enumDeclaration(name: string, values: string[]) {
  const constants = values.map(value => name + enumName(value))
  if (new Set(constants).size !== constants.length)
    throw new Error('Conflicting Go enum members: ' + name)
  return (
    `type ${name} string\n` +
    'const (\n' +
    values
      .map((value, index) => `${constants[index]} ${name} = ${q(value)}`)
      .join('\n') +
    '\n)\n' +
    `func (value *${name}) UnmarshalJSON(raw []byte) error {\n` +
    `if err := contractEnum(raw, ${values.map(value => q(value)).join(', ')}); err != nil { return err }\n` +
    `var decoded string\nif err := json.Unmarshal(raw, &decoded); err != nil { return err }\n` +
    `*value = ${name}(decoded)\nreturn nil\n}\n` +
    `func (value ${name}) MarshalJSON() ([]byte, error) {\n` +
    'raw, err := json.Marshal(string(value))\n' +
    'if err != nil { return nil, err }\n' +
    `if err := contractEnum(raw, ${values.map(value => q(value)).join(', ')}); err != nil { return nil, err }\n` +
    'return raw, nil\n}\n'
  )
}

function unionDeclaration(name: string, s: UnionShape) {
  const variants = s.variants.map(variant => {
    if (variant.kind !== 'object')
      throw new Error('Go unions require tagged object variants: ' + name)
    const tag = variant.fields.find(field => field.name === 'type')
    if (!tag?.required || tag.shape.kind !== 'literal')
      throw new Error('Go unions require a string type tag: ' + name)
    return {
      tag: tag.shape.value,
      member: enumName(tag.shape.value),
      payload: { ...variant, fields: variant.fields.filter(f => f !== tag) }
    }
  })
  if (new Set(variants.map(variant => variant.member)).size !== variants.length)
    throw new Error('Conflicting Go union variants: ' + name)
  return (
    `type ${name} struct {\n` +
    variants.map(v => `${v.member} *${name}${v.member}`).join('\n') +
    '\n}\n' +
    variants
      .map(v => `type ${name}${v.member} struct {\n${fields(v.payload)}\n}\n`)
      .join('\n') +
    `func (value *${name}) UnmarshalJSON(raw []byte) error {\n` +
    `if err := (${check(s)})(raw); err != nil { return err }\n` +
    'var tag struct { Type string `json:"type"` }\n' +
    'if err := json.Unmarshal(raw, &tag); err != nil { return err }\n' +
    'switch tag.Type {\n' +
    variants
      .map(
        v =>
          `case ${q(v.tag)}:\n` +
          `var decoded ${name}${v.member}\n` +
          'if err := json.Unmarshal(raw, &decoded); err != nil { return err }\n' +
          `*value = ${name}{${v.member}: &decoded}\nreturn nil`
      )
      .join('\n') +
    '\n}\nreturn fmt.Errorf("unknown union tag %q", tag.Type)\n}\n' +
    `func (value ${name}) MarshalJSON() ([]byte, error) {\n` +
    'count := 0\n' +
    variants.map(v => `if value.${v.member} != nil { count++ }`).join('\n') +
    '\nif count != 1 { return nil, fmt.Errorf("union requires exactly one variant") }\n' +
    'var raw []byte\nvar err error\n' +
    variants
      .map(
        v =>
          `if value.${v.member} != nil {\n` +
          'raw, err = json.Marshal(struct {\n' +
          'Type string `json:"type"`\n' +
          `*${name}${v.member}\n` +
          `}{Type: ${q(v.tag)}, ${name}${v.member}: value.${v.member}})\n` +
          '}\n'
      )
      .join('') +
    'if err != nil { return nil, err }\n' +
    `if err := (${check(s)})(raw); err != nil { return nil, err }\n` +
    'return raw, nil\n}\n'
  )
}

// This runtime is emitted once per Go package file. Each schema is lowered by
// check() before any destination struct is decoded, including nested values.
export const goValidationRuntime = `
type contractCheck func(json.RawMessage) error

func contractIsNull(raw json.RawMessage) bool {
 return bytes.Equal(bytes.TrimSpace(raw), []byte("null"))
}

func contractObject(raw json.RawMessage, required, optional map[string]contractCheck) error {
 var object map[string]json.RawMessage
 if err := json.Unmarshal(raw, &object); err != nil { return err }
 if object == nil { return fmt.Errorf("expected object") }
 for key, check := range required {
  value, present := object[key]
  if !present { return fmt.Errorf("missing required field %q", key) }
  if err := check(value); err != nil { return fmt.Errorf("field %q: %w", key, err) }
 }
 for key, value := range object {
  if _, present := required[key]; present { continue }
  check, present := optional[key]
  if !present { return fmt.Errorf("unknown field %q", key) }
  if err := check(value); err != nil { return fmt.Errorf("field %q: %w", key, err) }
 }
 return nil
}

func contractArray(raw json.RawMessage, item contractCheck) error {
 var array []json.RawMessage
 if err := json.Unmarshal(raw, &array); err != nil { return err }
 if array == nil { return fmt.Errorf("expected array") }
 for index, value := range array {
  if err := item(value); err != nil { return fmt.Errorf("item %d: %w", index, err) }
 }
 return nil
}

func contractNullable(raw json.RawMessage, inner contractCheck) error {
 if contractIsNull(raw) { return nil }
 return inner(raw)
}

func contractString(raw json.RawMessage) error {
 if contractIsNull(raw) { return fmt.Errorf("expected string") }
 var value string
 return json.Unmarshal(raw, &value)
}

func contractBoolean(raw json.RawMessage) error {
 if contractIsNull(raw) { return fmt.Errorf("expected boolean") }
 var value bool
 return json.Unmarshal(raw, &value)
}

func contractInteger(raw json.RawMessage, min, max uint64) error {
 if contractIsNull(raw) { return fmt.Errorf("expected integer") }
 var value uint64
 if err := json.Unmarshal(raw, &value); err != nil { return err }
 if value < min || value > max { return fmt.Errorf("integer out of range") }
 return nil
}

func contractEnum(raw json.RawMessage, choices ...string) error {
 if err := contractString(raw); err != nil { return err }
 var value string
 if err := json.Unmarshal(raw, &value); err != nil { return err }
 for _, choice := range choices { if value == choice { return nil } }
 return fmt.Errorf("invalid enum value %q", value)
}

func contractUnion(raw json.RawMessage, variants ...contractCheck) error {
 matches := 0
 for _, check := range variants { if check(raw) == nil { matches++ } }
 if matches != 1 { return fmt.Errorf("expected exactly one union variant") }
 return nil
}
`

export function goContract(schema: RawSchema, root = schema) {
  const contract = shape(schema, root)
  const name = typeName(schema)
  if (contract.kind === 'enum') return enumDeclaration(name, contract.values)
  if (contract.kind === 'union') return unionDeclaration(name, contract)
  if (contract.kind !== 'object')
    throw new Error('Contract must be object, enum or tagged union')
  return objectDeclaration(name, contract)
}

export function goPayload(wireName: string, schema: RawSchema) {
  const name = typeName(schema)
  const contract = shape(schema)
  if (contract.kind !== 'object') throw new Error('Payload must be object')
  return (
    `const ${name}Name = ${q(wireName)}\n` +
    objectDeclaration(name, contract) +
    `func (*${name}) NodePayload() {}\n`
  )
}

export function goNodes(entries: [string, RawSchema][], packageName = 'nodes') {
  const names = entries.map(([, schema]) => typeName(schema))
  if (new Set(names).size !== names.length)
    throw new Error('Duplicate generated payload type')
  const definitions = new Map<string, string>()
  for (const [, schema] of entries)
    for (const [name, definition] of Object.entries(schema.$defs ?? {})) {
      const source = goContract({ ...definition, title: name }, schema)
      const previous = definitions.get(name)
      if (previous !== undefined && previous !== source)
        throw new Error('Conflicting generated type: ' + name)
      definitions.set(name, source)
    }
  return (
    '// Code generated from Rust contracts. DO NOT EDIT.\npackage ' +
    packageName +
    '\nimport (\n"bytes"\n"encoding/json"\n"fmt"\n"github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"\n)\n' +
    goValidationRuntime +
    [...definitions.values()].join('\n') +
    entries.map(([key, schema]) => goPayload(key, schema)).join('\n') +
    'func NewPayload(kind string) ast.Payload {\nswitch kind {\n' +
    entries
      .map(
        ([, s]) => 'case ' + typeName(s) + 'Name: return &' + typeName(s) + '{}'
      )
      .join('\n') +
    '\n};return nil\n}\n'
  )
}
