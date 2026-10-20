import { DocumentContext } from '@traq-flavored-markdown/core'
import type { Document } from '@traq-flavored-markdown/core'
import { expect, test } from 'bun:test'

import fixtures from '../../../../../tests/fixtures/document-structure.json' with { type: 'json' }
import { definitions } from '../../generated/nodes.js'

test('SDK document validation follows the shared cross-language structure contract', () => {
  for (const fixture of fixtures) {
    const validate = () =>
      new DocumentContext(fixture.document as Document, {
        definitions: Object.values(definitions)
      })
    if (fixture.valid) expect(validate, fixture.name).not.toThrow()
    else expect(validate, fixture.name).toThrow()
  }
})
