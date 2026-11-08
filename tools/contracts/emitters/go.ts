import {
  type ContractDefinition,
  type ContractField,
  type ContractModule,
  type ContractShape,
  normalizeContracts
} from '../model/ir.ts'
import { type RawSchema, quoted as q } from '../model/schema.ts'
import type { NodeStructure } from '../model/structure.ts'
import { GoNames, enumName, fieldName, goIdentifier } from './go-names.ts'
import { type Source, block, lines, sections, sourceFile } from './source.ts'

type Definitions = ContractModule['definitions']

const typeName = goIdentifier

function goType(shape: ContractShape, context: GoContext): string {
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
      return '*' + goType(shape.inner, context)

    case 'array':
      return '[]' + goType(shape.items, context)

    case 'object':
      return block('struct {', fields(shape.fields, context))

    case 'union':
      throw new Error('Go unions must be named contracts')
  }
}

const optional = (field: ContractField) =>
  !field.required && !Object.hasOwn(field, 'default')

const fieldType = (field: ContractField, context: GoContext) =>
  (optional(field) ? '*' : '') + goType(field.shape, context)

function excludesEmptyString(
  shape: ContractShape,
  context: GoContext
): boolean {
  if (shape.kind === 'reference') {
    const definition = context.definitions.get(shape.name)
    if (!definition) throw new Error('Unresolved Go contract: ' + shape.name)

    return excludesEmptyString(definition.shape, context)
  }

  return shape.kind === 'enum'
    ? !shape.values.includes('')
    : shape.kind === 'literal' && shape.value !== ''
}

// A nonzero default must not hide a valid explicit zero value. String enums
// that exclude the Go zero value can safely reserve it for an omitted default.
const canOmit = (field: ContractField, context: GoContext) =>
  !field.required &&
  (!Object.hasOwn(field, 'default') ||
    field.default === null ||
    field.default === '' ||
    field.default === false ||
    field.default === 0 ||
    (Array.isArray(field.default) && field.default.length === 0) ||
    excludesEmptyString(field.shape, context))

const fields = (value: readonly ContractField[], context: GoContext) => {
  const names = new GoNames('struct fields')
  for (const field of value) names.add(fieldName(field.name))

  return lines(
    value.map(
      field =>
        `${fieldName(field.name)} ${fieldType(field, context)} \`json:${q(field.name + (canOmit(field, context) ? ',omitempty' : ''))}\``
    )
  )
}

const checked = (expression: string, failure = 'return err') =>
  `if err := ${expression}; err != nil { ${failure} }`

const inlineFunction = (signature: string, result: string) =>
  `${signature} { return ${result} }`

const goFunction = (signature: string, ...body: Source[]) =>
  block(`${signature} {`, sections(body))

const decoderFunction = (type: string, ...body: Source[]) =>
  goFunction(`func(raw json.RawMessage, value *${type}) error`, body)

/** A decoder builds each value once; named references invoke their own decoder. */
function decoder(shape: ContractShape, context: GoContext): string {
  const type = goType(shape, context)
  useImports(context, 'contract')

  switch (shape.kind) {
    case 'string': {
      if (shape.minLength === undefined && shape.maxLength === undefined) {
        return 'contract.Decode[string]'
      }

      useImports(context, 'json', 'fmt', 'utf8')

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
      useImports(context, 'json', 'fmt')

      return decoderFunction(
        type,
        checked('contract.Decode(raw, value)'),
        `if *value < ${shape.min} || *value > ${shape.max} { return fmt.Errorf("number outside schema range") }`,
        'return nil'
      )

    case 'nullable':
      useImports(context, 'json')

      return inlineFunction(
        `func(raw json.RawMessage, value *${type}) error`,
        `contract.Nullable(raw, value, ${decoder(shape.inner, context)})`
      )

    case 'array':
      useImports(context, 'json')

      if (shape.minItems !== undefined || shape.maxItems !== undefined) {
        useImports(context, 'fmt')
      }

      return decoderFunction(
        type,
        checked(`contract.Array(raw, value, ${decoder(shape.items, context)})`),
        shape.minItems !== undefined &&
          `if len(*value) < ${shape.minItems} { return fmt.Errorf("array shorter than schema bound") }`,
        shape.maxItems !== undefined &&
          `if len(*value) > ${shape.maxItems} { return fmt.Errorf("array longer than schema bound") }`,
        'return nil'
      )

    case 'enum':
    case 'literal': {
      useImports(context, 'json')
      const choices = shape.kind === 'literal' ? [shape.value] : shape.values

      return decoderFunction(
        'string',
        checked('contract.Decode(raw, value)'),
        `return contract.Enum(*value, ${choices.map(value => q(value)).join(', ')})`
      )
    }

    case 'object':
      useImports(context, 'json')

      return decoderFunction(
        type,
        lines(
          'object, err := contract.Object(raw)',
          'if err != nil { return err }'
        ),
        decodeFields(shape.fields, context, '*value', true),
        'return nil'
      )

    default:
      return `contract.Decode[${type}]`
  }
}

function decodeFields(
  value: readonly ContractField[],
  context: GoContext,
  destination: string,
  parenthesize = false,
  extraAllowed: string[] = []
) {
  useImports(context, 'contract')
  if (value.length > 0) useImports(context, 'fmt')

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
          `(${decoder(field.shape, context)})(raw, &${destination})`,
          `return fmt.Errorf("field %q: %w", ${q(field.name)}, err)`
        )

      const decode = optional(field)
        ? sections(
            lines(
              `var present ${goType(field.shape, context)}`,
              decodeValue('present')
            ),
            `${member} = &present`
          )
        : decodeValue(member)

      const missing = field.required
        ? `return fmt.Errorf("missing required field %q", ${q(field.name)})`
        : Object.hasOwn(field, 'default')
          ? checked(
              `(${decoder(field.shape, context)})(json.RawMessage(${q(JSON.stringify(field.default))}), &${member})`
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
  context: GoContext
) {
  return sections(
    block(`type ${name} struct {`, fields(value.fields, context)),
    goFunction(
      `func (value *${name}) UnmarshalJSON(raw []byte) error`,
      lines(
        'object, err := contract.Object(raw)',
        'if err != nil { return err }'
      ),
      lines(`type wire ${name}`, 'var decoded wire'),
      decodeFields(value.fields, context, 'decoded'),
      lines(`*value = ${name}(decoded)`, 'return nil')
    )
  )
}

function enumDeclaration(name: string, values: string[], context: GoContext) {
  useImports(context, 'json', 'contract')

  const constants = values.map(value =>
    context.names.add(name + enumName(value))
  )

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
  context: GoContext
) {
  useImports(context, 'json', 'fmt', 'contract')

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

  const members = new GoNames(name)

  for (const variant of variants) {
    members.add(variant.member)
    context.names.add(name + variant.member)
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
              decodeFields(variant.fields, context, 'decoded', false, [
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
        fields(variant.fields, context)
      )
    ),
    unmarshal,
    marshal
  )
}

export type GoFragment = { source: string; imports: ReadonlySet<GoImport> }

const importPaths = {
  json: 'encoding/json',
  fmt: 'fmt',
  utf8: 'unicode/utf8',
  contract:
    'github.com/traPtitech/traq-flavored-markdown/packages/core/go/contract',
  ast: 'github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast',
  binding:
    'github.com/traPtitech/traq-flavored-markdown/packages/core/go/binding'
} as const

type GoImport = keyof typeof importPaths

type GoContext = {
  definitions: Definitions
  imports: Set<GoImport>
  names: GoNames
}

const useImports = (context: GoContext, ...imports: GoImport[]) => {
  for (const name of imports) context.imports.add(name)
}

export const goFragment = (
  source: string,
  imports: readonly GoImport[] = []
): GoFragment => ({ source, imports: new Set(imports) })

export const mergeGo = (...fragments: GoFragment[]): GoFragment => ({
  source: sections(fragments.map(fragment => fragment.source)),
  imports: new Set(fragments.flatMap(fragment => [...fragment.imports]))
})

export function goFile(packageName: string, fragment: GoFragment) {
  goIdentifier(packageName)

  const imports = Object.entries(importPaths).filter(([name]) =>
    fragment.imports.has(name as GoImport)
  )

  return sourceFile(
    lines(
      '// Code generated from Rust contracts. DO NOT EDIT.',
      'package ' + packageName
    ),
    imports.length > 0 &&
      block('import (', lines(imports.map(([, path]) => q(path))), ')'),
    fragment.source
  )
}

function emitGoDefinition(definition: ContractDefinition, context: GoContext) {
  const name = typeName(definition.name)
  const value = definition.shape
  if (value.kind === 'object') {
    const names = new GoNames(name)
    names.add('UnmarshalJSON')
    for (const field of value.fields) names.add(fieldName(field.name))
  }

  if (value.kind === 'enum') return enumDeclaration(name, value.values, context)

  if (value.kind === 'union') return unionDeclaration(name, value, context)

  if (value.kind === 'object') {
    return objectDeclaration(name, value, context)
  }

  if (
    ['string', 'boolean', 'integer', 'number', 'literal'].includes(value.kind)
  ) {
    const type = goType(value, context)
    useImports(context, 'json')
    if (type === 'string') useImports(context, 'fmt', 'utf8')

    return sections(
      `type ${name} ${type}`,
      goFunction(
        `func (value *${name}) UnmarshalJSON(raw []byte) error`,
        lines(
          `var decoded ${type}`,
          checked(`(${decoder(value, context)})(raw, &decoded)`)
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

function emitFragment(
  module: ContractModule,
  emit: (context: GoContext) => string,
  extraNames: readonly string[] = []
): GoFragment {
  const names = new GoNames('declarations')

  for (const definition of module.definitions.values()) {
    names.add(typeName(definition.name))
  }

  for (const name of extraNames) names.add(name)

  const context: GoContext = {
    definitions: module.definitions,
    imports: new Set(),
    names
  }

  return { source: emit(context), imports: context.imports }
}

export function emitGoDeclarations(
  module: ContractModule,
  extraNames: readonly string[] = []
) {
  return emitFragment(
    module,
    context =>
      sourceFile(
        [...module.definitions.values()].map(definition =>
          emitGoDefinition(definition, context)
        )
      ),
    extraNames
  )
}

export function goContract(schema: RawSchema, root = schema) {
  const module = normalizeContracts([schema], {}, root)

  return emitFragment(module, context =>
    sourceFile(
      emitGoDefinition(module.definitions.get(schema.title!)!, context)
    )
  )
}

export function goPayload(wireName: string, schema: RawSchema) {
  const module = normalizeContracts([schema])
  const definition = module.definitions.get(schema.title!)!
  if (definition.shape.kind !== 'object') {
    throw new Error('Payload must be object')
  }
  const name = typeName(definition.name)

  return emitFragment(module, context =>
    sourceFile(
      'const ' + name + 'Name = ' + q(wireName),
      emitGoDefinition(definition, context),
      'func (*' + name + ') NodePayload() {}'
    )
  )
}

export function goNodes(
  entries: [string, RawSchema][],
  packageName = 'nodes',
  structures: Readonly<Record<string, NodeStructure | undefined>> = {}
) {
  const module = normalizeContracts(entries.map(([, schema]) => schema))

  return goFile(
    packageName,
    mergeGo(
      emitGoDeclarations(module, [
        'NewPayload',
        ...entries.map(([, schema]) => typeName(schema.title!) + 'Name')
      ]),
      goFragment(
        sections(
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
        ),
        ['ast']
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
