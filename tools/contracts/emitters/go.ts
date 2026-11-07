import {
  type ContractDefinition,
  type ContractField,
  type ContractModule,
  type ContractShape,
  normalizeContracts
} from '../model/ir.ts'
import { type RawSchema, quoted as q } from '../model/schema.ts'
import type { NodeStructure } from '../model/structure.ts'
import { type Source, block, lines, sections, sourceFile } from './source.ts'

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
      return block('struct {', fields(shape.fields, definitions))

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
  lines(
    value.map(
      field =>
        `${fieldName(field.name)} ${fieldType(field, definitions)} \`json:${q(field.name + (canOmit(field, definitions) ? ',omitempty' : ''))}\``
    )
  )

const checked = (expression: string, failure = 'return err') =>
  `if err := ${expression}; err != nil { ${failure} }`

const inlineFunction = (signature: string, result: string) =>
  `${signature} { return ${result} }`

const goFunction = (signature: string, ...body: Source[]) =>
  block(`${signature} {`, sections(body))

const decoderFunction = (type: string, ...body: Source[]) =>
  goFunction(`func(raw json.RawMessage, value *${type}) error`, body)

/** A decoder builds each value once; named references invoke their own decoder. */
function decoder(shape: ContractShape, definitions: Definitions): string {
  const type = goType(shape, definitions)

  switch (shape.kind) {
    case 'string': {
      if (shape.minLength === undefined && shape.maxLength === undefined) {
        return 'contract.Decode[string]'
      }

      const bounds: string[] = []

      if (shape.minLength !== undefined) {
        bounds.push(
          `if length < ${shape.minLength} { return fmt.Errorf("string shorter than schema bound") }`
        )
      }

      if (shape.maxLength !== undefined) {
        bounds.push(
          `if length > ${shape.maxLength} { return fmt.Errorf("string longer than schema bound") }`
        )
      }

      return decoderFunction(
        'string',
        checked('contract.Decode(raw, value)'),
        lines('length := uint64(utf8.RuneCountInString(*value))', bounds[0]),
        bounds.slice(1),
        'return nil'
      )
    }

    case 'integer':
    case 'number':
      return decoderFunction(
        type,
        checked('contract.Decode(raw, value)'),
        `if *value < ${shape.min} || *value > ${shape.max} { return fmt.Errorf("number outside schema range") }`,
        'return nil'
      )

    case 'nullable':
      return inlineFunction(
        `func(raw json.RawMessage, value *${type}) error`,
        `contract.Nullable(raw, value, ${decoder(shape.inner, definitions)})`
      )

    case 'array':
      return decoderFunction(
        type,
        checked(
          `contract.Array(raw, value, ${decoder(shape.items, definitions)})`
        ),
        shape.minItems !== undefined &&
          `if len(*value) < ${shape.minItems} { return fmt.Errorf("array shorter than schema bound") }`,
        shape.maxItems !== undefined &&
          `if len(*value) > ${shape.maxItems} { return fmt.Errorf("array longer than schema bound") }`,
        'return nil'
      )

    case 'enum':
    case 'literal': {
      const choices = shape.kind === 'literal' ? [shape.value] : shape.values

      return decoderFunction(
        'string',
        checked('contract.Decode(raw, value)'),
        `return contract.Enum(*value, ${choices.map(value => q(value)).join(', ')})`
      )
    }

    case 'object':
      return decoderFunction(
        type,
        lines(
          'object, err := contract.Object(raw)',
          'if err != nil { return err }'
        ),
        decodeFields(shape.fields, definitions, '*value', true),
        'return nil'
      )

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

  return sections(
    checked(
      `contract.Fields(object${allowed.length ? ', ' + allowed.join(', ') : ''})`
    ),
    value.map(field => {
      const member = `${target}.${fieldName(field.name)}`

      const decodeValue = (destination: string) =>
        checked(
          `(${decoder(field.shape, definitions)})(raw, &${destination})`,
          `return fmt.Errorf("field %q: %w", ${q(field.name)}, err)`
        )

      const decode = optional(field)
        ? sections(
            lines(
              `var present ${goType(field.shape, definitions)}`,
              decodeValue('present')
            ),
            `${member} = &present`
          )
        : decodeValue(member)

      const missing = field.required
        ? `return fmt.Errorf("missing required field %q", ${q(field.name)})`
        : Object.hasOwn(field, 'default')
          ? checked(
              `(${decoder(field.shape, definitions)})(json.RawMessage(${q(JSON.stringify(field.default))}), &${member})`
            )
          : ''

      return block(
        `if raw, present := object[${q(field.name)}]; present {`,
        decode,
        missing ? block('} else {', missing) : '}'
      )
    })
  )
}

function objectDeclaration(
  name: string,
  value: Extract<ContractShape, { kind: 'object' }>,
  definitions: Definitions
) {
  return sections(
    block(`type ${name} struct {`, fields(value.fields, definitions)),
    goFunction(
      `func (value *${name}) UnmarshalJSON(raw []byte) error`,
      lines(
        'object, err := contract.Object(raw)',
        'if err != nil { return err }'
      ),
      lines(`type wire ${name}`, 'var decoded wire'),
      decodeFields(value.fields, definitions, 'decoded'),
      lines(`*value = ${name}(decoded)`, 'return nil')
    )
  )
}

function enumDeclaration(name: string, values: string[]) {
  const constants = values.map(value => name + enumName(value))
  if (new Set(constants).size !== constants.length) {
    throw new Error('Conflicting Go enum members: ' + name)
  }

  const choices = values.map(value => q(value)).join(', ')

  return sections(
    `type ${name} string`,
    block(
      'const (',
      lines(
        values.map(
          (value, index) => `${constants[index]} ${name} = ${q(value)}`
        )
      ),
      ')'
    ),
    goFunction(
      `func (value *${name}) UnmarshalJSON(raw []byte) error`,
      lines('var decoded string', checked('contract.Decode(raw, &decoded)')),
      checked(`contract.Enum(decoded, ${choices})`),
      lines(`*value = ${name}(decoded)`, 'return nil')
    ),
    goFunction(
      `func (value ${name}) MarshalJSON() ([]byte, error)`,
      checked(`contract.Enum(string(value), ${choices})`, 'return nil, err'),
      'return json.Marshal(string(value))'
    )
  )
}

function unionDeclaration(
  name: string,
  shape: Extract<ContractShape, { kind: 'union' }>,
  definitions: Definitions
) {
  if (!shape.discriminator) {
    throw new Error('Go unions require a string type tag: ' + name)
  }

  const variants = shape.variants.map(variant => {
    if (variant.kind !== 'object') {
      throw new Error('Go unions require tagged object variants: ' + name)
    }

    const tag = variant.fields.find(field => field.name === shape.discriminator)
    if (!tag || tag.shape.kind !== 'literal') {
      throw new Error('Go unions require a string type tag: ' + name)
    }

    return {
      tag: tag.shape.value,
      member: enumName(tag.shape.value),
      fields: variant.fields.filter(field => field !== tag)
    }
  })
  if (
    new Set(variants.map(variant => variant.member)).size !== variants.length
  ) {
    throw new Error('Conflicting Go union variants: ' + name)
  }

  const unmarshal = goFunction(
    `func (value *${name}) UnmarshalJSON(raw []byte) error`,
    lines(
      'object, err := contract.Object(raw)',
      'if err != nil { return err }'
    ),
    lines(
      'var tag string',
      checked(`contract.Decode(object[${q(shape.discriminator)}], &tag)`)
    ),
    block(
      'switch tag {',
      sections(
        variants.map(variant =>
          lines(
            `case ${q(variant.tag)}:`,
            sections(
              `var decoded ${name}${variant.member}`,
              decodeFields(variant.fields, definitions, 'decoded', false, [
                shape.discriminator!
              ]),
              lines(
                `*value = ${name}{${variant.member}: &decoded}`,
                'return nil'
              )
            )
          )
        )
      )
    ),
    'return fmt.Errorf("unknown union tag %q", tag)'
  )

  const marshal = goFunction(
    `func (value ${name}) MarshalJSON() ([]byte, error)`,
    'count := 0',
    variants.map(variant => `if value.${variant.member} != nil { count++ }`),
    'if count != 1 { return nil, fmt.Errorf("union requires exactly one variant") }',
    lines('var raw []byte', 'var err error'),
    variants.map(variant => {
      const tagged = `struct { Type string \`json:"type"\`; *${name}${variant.member} }{Type: ${q(variant.tag)}, ${name}${variant.member}: value.${variant.member}}`

      return `if value.${variant.member} != nil { raw, err = json.Marshal(${tagged}) }`
    }),
    'if err != nil { return nil, err }',
    lines(
      `var checked ${name}`,
      checked('json.Unmarshal(raw, &checked)', 'return nil, err')
    ),
    'return raw, nil'
  )

  return sections(
    block(
      `type ${name} struct {`,
      lines(
        variants.map(variant => `${variant.member} *${name}${variant.member}`)
      )
    ),
    variants.map(variant =>
      block(
        `type ${name}${variant.member} struct {`,
        fields(variant.fields, definitions)
      )
    ),
    unmarshal,
    marshal
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

  return sourceFile(
    lines(
      '// Code generated from Rust contracts. DO NOT EDIT.',
      `package ${packageName}`
    ),
    imports.length > 0 &&
      block('import (', lines(imports.map(([, path]) => q(path))), ')'),
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

  if (value.kind === 'object') {
    return objectDeclaration(name, value, definitions)
  }

  if (
    ['string', 'boolean', 'integer', 'number', 'literal'].includes(value.kind)
  ) {
    const type = goType(value, definitions)

    return sections(
      `type ${name} ${type}`,
      goFunction(
        `func (value *${name}) UnmarshalJSON(raw []byte) error`,
        lines(
          `var decoded ${type}`,
          checked(`(${decoder(value, definitions)})(raw, &decoded)`)
        ),
        lines(`*value = ${name}(decoded)`, 'return nil')
      ),
      goFunction(
        `func (value ${name}) MarshalJSON() ([]byte, error)`,
        type === 'string' &&
          'if !utf8.ValidString(string(value)) { return nil, fmt.Errorf("invalid UTF-8") }',
        lines(
          `raw, err := json.Marshal(${type}(value))`,
          'if err != nil { return nil, err }'
        ),
        lines(
          `var checked ${name}`,
          checked('json.Unmarshal(raw, &checked)', 'return nil, err')
        ),
        'return raw, nil'
      )
    )
  }

  throw new Error(`Unsupported named Go contract: ${name} (${value.kind})`)
}

export function emitGoDeclarations(module: ContractModule) {
  return sourceFile(
    [...module.definitions.values()].map(definition =>
      emitGoDefinition(definition, module.definitions)
    )
  )
}

export function goContract(schema: RawSchema, root = schema) {
  const module = normalizeContracts([schema], {}, root)

  return sourceFile(
    emitGoDefinition(module.definitions.get(schema.title!)!, module.definitions)
  )
}

export function goPayload(wireName: string, schema: RawSchema) {
  const module = normalizeContracts([schema])
  const definition = module.definitions.get(schema.title!)!
  if (definition.shape.kind !== 'object') {
    throw new Error('Payload must be object')
  }

  const name = typeName(definition.name)

  return sourceFile(
    `const ${name}Name = ${q(wireName)}`,
    emitGoDefinition(definition, module.definitions),
    `func (*${name}) NodePayload() {}`
  )
}

export function goNodes(
  entries: [string, RawSchema][],
  packageName = 'nodes',
  structures: Readonly<Record<string, NodeStructure | undefined>> = {}
) {
  const names = entries.map(([, schema]) => typeName(schema.title!))
  if (new Set(names).size !== names.length) {
    throw new Error('Duplicate generated payload type')
  }

  const module = normalizeContracts(entries.map(([, schema]) => schema))

  return goFile(
    packageName,
    sections(
      emitGoDeclarations(module),
      entries.map(([key, schema]) =>
        sections(
          `const ${typeName(schema.title!)}Name = ${q(key)}`,
          `func (*${typeName(schema.title!)}) NodePayload() {}`,
          structures[key] &&
            goStructure(typeName(schema.title!), structures[key]!)
        )
      ),
      goFunction(
        'func NewPayload(kind string) ast.Payload',
        block(
          'switch kind {',
          lines(
            entries.map(
              ([, schema]) =>
                `case ${typeName(schema.title!)}Name: return &${typeName(schema.title!)}{}`
            )
          )
        ),
        'return nil'
      )
    )
  )
}

function goStructure(name: string, structure: NodeStructure) {
  const strings = (values: readonly string[]) =>
    `[]string{${values.map(value => q(value)).join(',')}}`

  const children = structure.children
  const fields = [`Kind:${q(children.kind)}`]

  if ('roles' in children) {
    fields.push(
      `Roles:${strings(children.roles)}`,
      `Nonempty:${children.nonempty}`
    )
  }

  if ('types' in children) {
    fields.push(
      `Types:${strings(children.types)}`,
      `Nonempty:${children.nonempty}`
    )
  }

  if (children.kind === 'sequence') {
    fields.push(
      `Prefix:${strings(children.prefix)}`,
      `Rest:${q(children.rest)}`,
      `HasArity:${children.arityField !== undefined}`
    )
  }

  return sections(
    inlineFunction(
      `func (*${name}) NodeStructure() ast.NodeStructure`,
      `ast.NodeStructure{Role:${q(structure.role)},Children:ast.ChildStructure{${fields.join(',')}}}`
    ),
    children.kind === 'sequence' &&
      children.arityField !== undefined &&
      inlineFunction(
        `func (value *${name}) ChildArity() int`,
        `len(value.${fieldName(children.arityField)})`
      )
  )
}
