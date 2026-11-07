import { expect, test } from 'bun:test'

import { block, lines, sections, sourceFile } from '../emitters/source.ts'

test('repeated and optional fragments compose without empty lines of their own', () => {
  const fields = [
    ['Name string', false],
    [undefined, ['Active bool', null]],
    '',
    '\r\n \t'
  ] as const

  expect(lines(fields)).toBe('Name string\nActive bool')

  expect(sections('type Name string', [], fields)).toBe(
    'type Name string\n\nName string\n\nActive bool'
  )
})

test('related assignment and error guard stay together between logical phases', () => {
  const source = block(
    'func readValue() error {',
    sections(
      lines('value, err := read()', 'if err != nil { return err }'),
      lines('consume(value)', 'return nil')
    )
  )

  expect(source).toBe(`func readValue() error {
value, err := read()
if err != nil { return err }

consume(value)
return nil
}`)
})

test('explicit delimiters compose parenthesis groups and nested initializers', () => {
  expect(block('const (', ['First = 1', 'Second = 2'], ')')).toBe(`const (
First = 1
Second = 2
)`)

  expect(
    block(
      'export const options = Object.freeze({',
      block('nested: {', 'enabled: true'),
      '} as const)'
    )
  ).toBe(`export const options = Object.freeze({
nested: {
enabled: true
}
} as const)`)

  expect(block('type Empty struct {', [])).toBe('type Empty struct {\n}')
})

test('fragment boundaries normalize without accumulating final file newlines', () => {
  const source = sourceFile(
    '\r\n// Generated.\r\n\r\n',
    false,
    '\n\nconst enabled = true\n\n'
  )

  expect(source).toBe('// Generated.\n\nconst enabled = true\n')
  expect(sourceFile(source)).toBe(source)
  expect(sourceFile('', [], null, undefined, false, '\r\n \t')).toBe('')
})

test('literal contents and authored indentation survive nested composition', () => {
  const literal = '  const template = `\r\n  first\r\n\r\n\tsecond  \r\n`'

  expect(block('function render() {', literal)).toBe(
    'function render() {\n' + literal + '\n}'
  )

  expect(sections(literal, 'const tail = true')).toBe(
    literal + '\n\nconst tail = true'
  )

  expect(sourceFile(literal)).toBe(literal + '\n')
})
