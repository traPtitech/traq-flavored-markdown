import path from 'node:path'

import { write } from 'bun'
import { expect, test } from 'bun:test'

import { withTempDirectory } from '../../workspace/infrastructure/temp-directory.ts'
import { repositoryRoot } from '../../workspace/paths.ts'
import {
  emitGoDeclarations,
  goContract,
  goFile,
  goNodes
} from '../emitters/go.ts'
import { runCommand } from '../io/io.ts'
import { normalizeContracts } from '../model/ir.ts'
import type { RawSchema } from '../model/schema.ts'

async function writeModule(directory: string) {
  const core = path
    .join(repositoryRoot, 'packages/core/go')
    .replaceAll('\\', '/')
  const manifest = await Bun.file(path.join(core, 'go.mod')).text()
  const version = /^go (.+)$/m.exec(manifest)?.[1]
  if (!version) throw new Error('Missing Go version')
  await write(
    path.join(directory, 'go.mod'),
    'module example.com/contract\ngo ' +
      version +
      '\nrequire github.com/traPtitech/traq-flavored-markdown/packages/core/go v0.0.0\nreplace github.com/traPtitech/traq-flavored-markdown/packages/core/go => ' +
      JSON.stringify(core) +
      '\n'
  )
}

test('named scalar contracts preserve strict decoding and bounded round trips', async () => {
  const schemas: RawSchema[] = [
    { title: 'Identity', type: 'string', minLength: 1, maxLength: 2 },
    {
      title: 'Count',
      type: 'integer',
      format: 'uint8',
      minimum: 1,
      maximum: 3
    },
    { title: 'Enabled', type: 'boolean' }
  ]
  await withTempDirectory('go-scalars-', async directory => {
    await writeModule(directory)
    await write(
      `${directory}/contract.go`,
      goFile('contract', emitGoDeclarations(normalizeContracts(schemas)))
    )
    await write(
      `${directory}/contract_test.go`,
      `package contract
import ("encoding/json"; "testing")
func TestScalars(t *testing.T) {
 for _, value := range []any{Identity("日😀"), Count(3), Enabled(false)} {
  if _, err := json.Marshal(value); err != nil { t.Fatal(err) }
 }
 for _, value := range []any{Identity(""), Identity("abc"), Identity(string([]byte{0xff})), Count(0), Count(4)} {
  if _, err := json.Marshal(value); err == nil { t.Fatalf("accepted invalid scalar %#v", value) }
 }
 var identity Identity
 if err := json.Unmarshal([]byte("\\"日😀\\""), &identity); err != nil || string(identity) != "日😀" { t.Fatalf("lost identity: %v", err) }
 for _, raw := range []string{"null", "1", "\\"\\"", "\\"abc\\"", "\\"\\\\ud800\\""} {
  if json.Unmarshal([]byte(raw), &identity) == nil { t.Fatalf("accepted invalid identity %s", raw) }
 }
 var enabled Enabled
 if json.Unmarshal([]byte("null"), &enabled) == nil { t.Fatal("accepted null boolean") }
}
`
    )
    await runCommand(['go', 'test', './...'], directory)
  })
}, 60_000)

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
  const source = goFile('contract', definitions + goContract(schema))
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
    '\n}\n' +
    `func TestEnumMarshal(t *testing.T) {
      for _, value := range []LookupKind{LookupKindUser, LookupKindGroup} {
        if _, err := json.Marshal(value); err != nil { t.Fatalf("valid enum %q: %v", value, err) }
      }
      if _, err := json.Marshal(LookupKind("other")); err == nil { t.Fatal("accepted invalid enum") }
      if _, err := json.Marshal(LookupKind("")); err == nil { t.Fatal("accepted empty enum") }
    }
    `
  await withTempDirectory('go-contract-', async directory => {
    await writeModule(directory)
    await write(`${directory}/contract.go`, source)
    await write(`${directory}/contract_test.go`, testSource)
    await runCommand(['go', 'test', './...'], directory)
  })
}, 60_000)

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
  const source = goFile(
    'contract',
    goContract({ ...schema.$defs!.StampKind, title: 'StampKind' }, schema) +
      goContract(schema)
  )
  expect(goNodes([['example::StampData', schema]], 'traq')).toContain(
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
  if err := json.Unmarshal([]byte(raw), new(StampData)); err == nil { t.Errorf("accepted %s", raw) }
 }
 var stamp StampData
 if err := json.Unmarshal([]byte("{\\"kind\\":{\\"type\\":\\"hex_color\\",\\"name\\":\\"x\\",\\"rgb\\":0}}"), &stamp); err != nil { t.Fatal(err) }
 if stamp.Kind.HexColor == nil || stamp.Kind.HexColor.Rgb != 0 { t.Fatalf("unexpected variant: %#v", stamp.Kind) }
 raw, err := json.Marshal(stamp)
 if err != nil { t.Fatal(err) }
 if string(raw) != "{\\"kind\\":{\\"type\\":\\"hex_color\\",\\"name\\":\\"x\\",\\"rgb\\":0}}" { t.Fatalf("wrong round trip: %s", raw) }
}
`
  await withTempDirectory('go-union-', async directory => {
    await writeModule(directory)
    await write(`${directory}/contract.go`, source)
    await write(`${directory}/contract_test.go`, testSource)
    await runCommand(['go', 'test', './...'], directory)
  })
}, 60_000)

test('request defaults omit invalid enum zeros and preserve valid explicit zero values', async () => {
  const schema: RawSchema = {
    title: 'Request',
    type: 'object',
    additionalProperties: false,
    properties: {
      origin: { type: 'string', default: '' },
      label: { type: 'string', default: 'fallback' },
      enabled: { type: 'boolean', default: true },
      whitespace: { $ref: '#/$defs/Whitespace', default: 'collapse' },
      emptyChoice: { $ref: '#/$defs/EmptyChoice', default: 'fallback' },
      inline: {
        type: 'string',
        enum: ['collapse', 'preserve'],
        default: 'collapse'
      },
      literal: { type: 'string', const: 'fixed', default: 'fixed' },
      count: {
        type: 'integer',
        format: 'uint16',
        minimum: 0,
        maximum: 10,
        default: 2
      },
      percentage: {
        type: 'number',
        format: 'double',
        minimum: 0,
        maximum: 100
      },
      nullable: { type: ['string', 'null'] }
    },
    required: ['percentage'],
    $defs: {
      Whitespace: { type: 'string', enum: ['collapse', 'preserve'] },
      EmptyChoice: { type: 'string', enum: ['', 'fallback'] }
    }
  }
  await withTempDirectory('go-defaults-', async directory => {
    await writeModule(directory)
    await write(
      `${directory}/contract.go`,
      goFile('contract', emitGoDeclarations(normalizeContracts([schema])))
    )
    await write(
      `${directory}/contract_test.go`,
      `package contract
import ("bytes"; "encoding/json"; "testing")
func TestRequest(t *testing.T) {
 var value Request
 if err := json.Unmarshal([]byte("{\\"percentage\\":12.5}"), &value); err != nil { t.Fatal(err) }
 if value.Count != 2 || value.Percentage != 12.5 || value.Nullable != nil || !value.Enabled || value.Label != "fallback" || value.Whitespace != WhitespaceCollapse || value.EmptyChoice != EmptyChoiceFallback || value.Inline != "collapse" || value.Literal != "fixed" { t.Fatalf("wrong defaults: %#v", value) }
 if err := json.Unmarshal([]byte("{\\"percentage\\":0,\\"count\\":0,\\"nullable\\":null,\\"enabled\\":false,\\"label\\":\\"\\",\\"emptyChoice\\":\\"\\",\\"whitespace\\":\\"preserve\\"}"), &value); err != nil { t.Fatal(err) }
 if value.Count != 0 || value.Nullable == nil || *value.Nullable != nil || value.Enabled || value.Label != "" || value.EmptyChoice != EmptyChoiceEmpty || value.Whitespace != WhitespacePreserve { t.Fatalf("lost zero or null: %#v", value) }
 raw, err := json.Marshal(value); if err != nil { t.Fatal(err) }
 if !bytes.Contains(raw, []byte("\\"count\\":0")) { t.Fatalf("lost explicit zero: %s", raw) }
 var roundTrip Request
 if err := json.Unmarshal(raw, &roundTrip); err != nil { t.Fatal(err) }
 if roundTrip.Count != 0 || roundTrip.Enabled || roundTrip.Label != "" || roundTrip.EmptyChoice != EmptyChoiceEmpty || roundTrip.Whitespace != WhitespacePreserve { t.Fatalf("lost explicit zero values: %s", raw) }
 raw, err = json.Marshal(Request{Percentage:12.5}); if err != nil { t.Fatal(err) }
 if bytes.Contains(raw, []byte("\\"whitespace\\"")) || bytes.Contains(raw, []byte("\\"inline\\"")) || bytes.Contains(raw, []byte("\\"literal\\"")) { t.Fatalf("serialized invalid enum or literal zero: %s", raw) }
 if err := json.Unmarshal(raw, &roundTrip); err != nil { t.Fatal(err) }
 if roundTrip.Whitespace != WhitespaceCollapse || roundTrip.Inline != "collapse" || roundTrip.Literal != "fixed" || roundTrip.EmptyChoice != EmptyChoiceEmpty || roundTrip.Enabled || roundTrip.Label != "" || roundTrip.Count != 0 { t.Fatalf("wrong omitted defaults: %#v", roundTrip) }
 for _, raw := range []string{"{\\"percentage\\":100.1}", "{\\"percentage\\":-1}", "{\\"percentage\\":5,\\"count\\":11}", "{\\"percentage\\":null}"} {
  if json.Unmarshal([]byte(raw), new(Request)) == nil { t.Fatalf("accepted %s", raw) }
 }
}
`
    )
    await runCommand(['go', 'test', './...'], directory)
  })
}, 60_000)

test('direct generated decoders reject duplicate keys and lossy Unicode repairs', async () => {
  const schema: RawSchema = {
    title: 'Text',
    type: 'object',
    additionalProperties: false,
    properties: { value: { type: 'string' } },
    required: ['value']
  }
  const invalid = [
    String.raw`{"value":"a","value":"b"}`,
    String.raw`{"value":"a","\u0076alue":"b"}`,
    String.raw`{"value":"\ud800"}`,
    String.raw`{"value":"\udc00"}`,
    String.raw`{"value":"\ud800x"}`,
    String.raw`{"value":"\ud800\u0041"}`,
    String.raw`{"value":"x"} {"value":"y"}`
  ]
  const valid = [
    String.raw`{"value":"\ud83d\ude00"}`,
    String.raw`{"value":"\\ud800"}`,
    String.raw`{"value":"\ufffd"}`
  ]
  await withTempDirectory('go-strict-json-', async directory => {
    await writeModule(directory)
    await write(
      `${directory}/contract.go`,
      goFile('contract', goContract(schema))
    )
    await write(
      `${directory}/contract_test.go`,
      `package contract
import "testing"
func TestDirectDecoder(t *testing.T) {
 for _, raw := range []string{${invalid.map(value => JSON.stringify(value)).join(',')}} {
  if err := new(Text).UnmarshalJSON([]byte(raw)); err == nil { t.Fatalf("accepted invalid JSON %s", raw) }
 }
 for _, raw := range []string{${valid.map(value => JSON.stringify(value)).join(',')}} {
  if err := new(Text).UnmarshalJSON([]byte(raw)); err != nil { t.Fatalf("rejected valid JSON %s: %v", raw, err) }
 }
 raw := append([]byte(${JSON.stringify('{"value":"')}), 0xff)
 raw = append(raw, []byte(${JSON.stringify('"}')})...)
 if err := new(Text).UnmarshalJSON(raw); err == nil { t.Fatal("repaired invalid UTF-8") }
}
`
    )
    await runCommand(['go', 'test', './...'], directory)
  })
}, 60_000)

test('generated Go string bounds count Unicode scalars and preserve one-sided and zero bounds', async () => {
  const schema: RawSchema = {
    title: 'Text',
    type: 'object',
    additionalProperties: false,
    properties: {
      value: { type: 'string', minLength: 2, maxLength: 2 },
      lower: { type: 'string', minLength: 2 },
      upper: { type: 'string', maxLength: 2 },
      empty: { type: 'string', maxLength: 0 }
    },
    required: ['value', 'lower', 'upper', 'empty']
  }
  const fields = { lower: '日😀字', upper: '', empty: '' }
  const cases = [
    ...['ab', '日😀', 'e\u0301'].map(
      value => [{ ...fields, value }, true] as const
    ),
    ...['', '日', '😀', 'abc', '日😀字', '\ud800x', 'x\udc00', null, 2].map(
      value => [{ ...fields, value }, false] as const
    ),
    [{ ...fields, value: '日😀', lower: '😀' }, false],
    [{ ...fields, value: '日😀', upper: '日😀字' }, false],
    [{ ...fields, value: '日😀', empty: '😀' }, false]
  ] as const
  const testSource =
    'package contract\nimport ("encoding/json"; "testing")\nfunc TestStringLengths(t *testing.T) {\n' +
    cases
      .map(([value, valid]) => {
        const raw = JSON.stringify(JSON.stringify(value))
        return (
          'if err := json.Unmarshal([]byte(' +
          raw +
          '), new(Text)); (err == nil) != ' +
          valid +
          ' { t.Errorf("decode %q: %v", ' +
          raw +
          ', err) }'
        )
      })
      .join('\n') +
    '\n}\n'
  await withTempDirectory('go-string-length-', async directory => {
    await writeModule(directory)
    await write(
      directory + '/contract.go',
      goFile('contract', goContract(schema))
    )
    await write(directory + '/contract_test.go', testSource)
    await runCommand(['go', 'test', './...'], directory)
  })
}, 60_000)
