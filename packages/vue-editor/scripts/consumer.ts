import {
  type InputPart,
  ReferenceInput,
  type ReferenceInputAdapter,
  partsToProjectedText
} from '@traq-flavored-markdown/vue-editor'
import {
  analyzeEditorProbe,
  editInput,
  editorTextBetween
} from '@traq-flavored-markdown/vue-editor/prosemirror'

type Task = { number: number; title: string }
const task: Task = { number: 17, title: 'Review the API' }
const adapter: ReferenceInputAdapter<Task> = {
  references: {
    parse: text => [{ type: 'text', text }],
    serialize: parts =>
      parts
        .map(part =>
          part.type === 'text' ? part.text : `[[task:${part.reference.number}]]`
        )
        .join('')
  },
  label: task => task.title
}
// Check the published generic SFC declaration with a payload having no traQ fields.
const props: Parameters<typeof ReferenceInput<Task>>[0] = { adapter }
const parts: InputPart<Task>[] = [
  { type: 'text', text: '😀 ' },
  { type: 'reference', reference: task }
]
if (
  !props.adapter ||
  !ReferenceInput ||
  partsToProjectedText(parts) !== '😀 \uFFFC'
)
  throw new Error('Packed Vue editor contract failed')
if (adapter.references.serialize(parts) !== '😀 [[task:17]]')
  throw new Error('Packed Vue editor serialization failed')
for (const helper of [analyzeEditorProbe, editInput, editorTextBetween])
  if (typeof helper !== 'function')
    throw new Error('Packed Vue editor integration entry failed')
