import { declarations } from '../declarations.ts'
import { goContract } from '../go.ts'

type Schema = { title: string; $defs?: Record<string, Schema> }

export async function processingFiles(
  schemas: Record<string, Schema>,
  input: string
) {
  const files = new Map([
    [
      'typescript/generated/processing.ts',
      '// Generated from Rust processing contracts. Do not edit.\n'
    ],
    [
      'go/generated_processing.go',
      '// Code generated from Rust processing contracts. DO NOT EDIT.\npackage markdown\n'
    ]
  ])
  const types = await declarations(input, Object.keys(schemas))

  let go = ''
  const goDeclarations = new Map()
  function addGo(schema, root = schema) {
    const source = goContract(schema, root)
    const previous = goDeclarations.get(schema.title)
    if (previous !== undefined && previous !== source)
      throw new Error('Conflicting processing type: ' + schema.title)
    if (previous === undefined) {
      goDeclarations.set(schema.title, source)
      go += source
    }
  }

  for (const name of Object.keys(schemas)) {
    const schema = schemas[name]
    addGo(schema)
    for (const [name, definition] of Object.entries(schema.$defs ?? {}))
      addGo({ ...definition, title: name }, schema)
  }
  const tsPath = 'typescript/generated/processing.ts'
  const goPath = 'go/generated_processing.go'
  files.set(tsPath, files.get(tsPath) + [...types.values()].join('\n') + '\n')
  files.set(goPath, files.get(goPath) + go)
  return files
}
