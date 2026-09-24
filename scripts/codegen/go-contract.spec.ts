import { write } from 'bun'
import { expect, test } from 'bun:test'

import { withTempDirectory } from '../testing/temp-directory.ts'
import { goContract, goNodes, goValidationRuntime } from './go.ts'
import { runCommand } from './io.ts'
import type { RawSchema } from './schema.ts'

test('string enums retain their values in named Go types', () => {
  expect(
    goContract({
      title: 'LookupKind',
      type: 'string',
      enum: ['user', 'group']
    })
  ).toContain('type LookupKind string')
  expect(
    goContract({
      title: 'LookupKind',
      type: 'string',
      enum: ['user', 'group']
    })
  ).toContain('LookupKindGroup LookupKind = "group"')
  expect(
    goContract({
      title: 'StampAnimation',
      type: 'string',
      enum: ['rotate', 'rotate-inv']
    })
  ).toContain('StampAnimationRotateInv StampAnimation = "rotate-inv"')
})

test('generated Go contracts enforce object and enum schemas while decoding', async () => {
  const schema: RawSchema = {
    title: 'Envelope',
    type: 'object',
    additionalProperties: false,
    properties: {
      kind: { $ref: '#/$defs/LookupKind' },
      nested: { $ref: '#/$defs/Nested' },
      entries: { type: 'array', items: { type: 'string' } },
      optional: { type: 'boolean' }
    },
    required: ['kind', 'nested', 'entries'],
    $defs: {
      LookupKind: { type: 'string', enum: ['user', 'group'] },
      Nested: {
        type: 'object',
        additionalProperties: false,
        properties: {
          count: {
            type: 'integer',
            format: 'uint8',
            minimum: 0,
            maximum: 255
          }
        },
        required: ['count']
      }
    }
  }
  const definitions = Object.entries(schema.$defs ?? {})
    .map(([name, definition]) =>
      goContract({ ...definition, title: name }, schema)
    )
    .join('\n')
  const source =
    'package contract\nimport ("bytes"; "encoding/json"; "fmt")\n' +
    goValidationRuntime +
    definitions +
    goContract(schema)
  const cases = [
    ['{"kind":"user","nested":{"count":255},"entries":[]}', true],
    [
      '{"kind":"user","nested":{"count":255},"entries":[],"optional":false}',
      true
    ],
    ['{"kind":"other","nested":{"count":1},"entries":[]}', false],
    ['{"nested":{"count":1},"entries":[]}', false],
    ['{"kind":"user","nested":{},"entries":[]}', false],
    ['{"kind":"user","nested":{"count":256},"entries":[]}', false],
    ['{"kind":"user","nested":{"count":1,"extra":1},"entries":[]}', false],
    ['{"kind":"user","nested":{"count":1},"entries":[],"extra":1}', false],
    ['{"kind":"user","nested":{"count":1},"entries":null}', false],
    ['{"kind":"user","nested":{"count":1},"entries":[],"optional":null}', false]
  ] as const
  const testSource =
    'package contract\nimport ("encoding/json"; "testing")\n' +
    'func TestDecode(t *testing.T) {\n' +
    cases
      .map(
        ([raw, valid]) =>
          `if err := json.Unmarshal([]byte(${JSON.stringify(raw)}), new(Envelope)); (err == nil) != ${valid} { t.Errorf("decode %q: %v", ${JSON.stringify(raw)}, err) }`
      )
      .join('\n') +
    '\n}\n'
  await withTempDirectory('go-contract-', async directory => {
    await write(`${directory}/go.mod`, 'module example.com/contract\ngo 1.23\n')
    await write(`${directory}/contract.go`, source)
    await write(`${directory}/contract_test.go`, testSource)
    await runCommand(['go', 'test', './...'], directory)
  })
}, 20_000)

test('tagged Rust unions generate typed Go variants and strict round trips', async () => {
  const schema: RawSchema = {
    title: 'StampData',
    type: 'object',
    additionalProperties: false,
    properties: { kind: { $ref: '#/$defs/StampKind' } },
    required: ['kind'],
    $defs: {
      StampKind: {
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', const: 'normal' },
              name: { type: 'string' }
            },
            required: ['type', 'name']
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', const: 'hex_color' },
              name: { type: 'string' },
              rgb: {
                type: 'integer',
                format: 'uint32',
                minimum: 0,
                maximum: 0xffffffff
              }
            },
            required: ['type', 'name', 'rgb']
          }
        ]
      }
    }
  }
  const source =
    'package contract\nimport ("bytes"; "encoding/json"; "fmt")\n' +
    goValidationRuntime +
    goContract({ ...schema.$defs!.StampKind, title: 'StampKind' }, schema) +
    goContract(schema)
  expect(goNodes([['example::StampData', schema]], 'trap')).toContain(
    'type StampKindHexColor struct'
  )
  const testSource = `package contract
import ("encoding/json"; "testing")
func TestStampKind(t *testing.T) {
 for _, raw := range []string{
  "{\\"kind\\":{\\"type\\":\\"invalid\\",\\"name\\":\\"x\\"}}",
  "{\\"kind\\":{\\"type\\":\\"normal\\"}}",
  "{\\"kind\\":{\\"type\\":\\"normal\\",\\"name\\":\\"x\\",\\"rgb\\":0}}",
  "{\\"kind\\":{\\"type\\":\\"hex_color\\",\\"name\\":\\"x\\",\\"rgb\\":4294967296}}",
 } {
  if err := json.Unmarshal([]byte(raw), new(Stamp)); err == nil { t.Errorf("accepted %s", raw) }
 }
 var stamp Stamp
 if err := json.Unmarshal([]byte("{\\"kind\\":{\\"type\\":\\"hex_color\\",\\"name\\":\\"x\\",\\"rgb\\":0}}"), &stamp); err != nil { t.Fatal(err) }
 if stamp.Kind.HexColor == nil || stamp.Kind.HexColor.Rgb != 0 { t.Fatalf("unexpected variant: %#v", stamp.Kind) }
 raw, err := json.Marshal(stamp)
 if err != nil { t.Fatal(err) }
 if string(raw) != "{\\"kind\\":{\\"type\\":\\"hex_color\\",\\"name\\":\\"x\\",\\"rgb\\":0}}" { t.Fatalf("wrong round trip: %s", raw) }
}
`
  await withTempDirectory('go-union-', async directory => {
    await write(`${directory}/go.mod`, 'module example.com/contract\ngo 1.23\n')
    await write(`${directory}/contract.go`, source)
    await write(`${directory}/contract_test.go`, testSource)
    await runCommand(['go', 'test', './...'], directory)
  })
}, 20_000)
