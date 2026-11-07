# Vue reference input

`@traq-flavored-markdown/vue-editor` provides a Vue 3 input with reference atoms,
source-preserving inline Markdown, composition handling, selection and Undo.
Reference payloads, persistence, completion UI and Markdown services belong to
the host. The package imports no application stores, routes, entity types or
theme files, and never loads or disposes a parser runtime.

```vue
<script setup lang="ts">
import {
  ReferenceInput,
  type ReferenceInputAdapter
} from '@traq-flavored-markdown/vue-editor'
import '@traq-flavored-markdown/vue-editor/style.css'
import { ref } from 'vue'

type Task = { number: number; title: string }
const source = ref('')
const adapter: ReferenceInputAdapter<Task> = {
  references: {
    parse: source => [{ type: 'text', text: source }],
    serialize: parts =>
      parts
        .map(part =>
          part.type === 'text' ? part.text : `[[task:${part.reference.number}]]`
        )
        .join('')
  },
  label: task => `#${task.number} ${task.title}`,
  editText: task => `@${task.number}`
}
</script>

<template>
  <ReferenceInput
    v-model="source"
    :adapter="adapter"
    placeholder="Write a note"
  />
</template>
```

For a complete parser, completion controller and popup, see `examples/tasks`.
It uses numeric task references and a custom `[[task:17]]` wire format. Run
`bun run build` at the repository root, then
`bun run --cwd packages/vue-editor dev` and open `http://127.0.0.1:4180`.
The example consumes the built public package exports, without S-UI aliases.

## Value and reference contract

`v-model` is the host's serialized string. `references.parse` and `serialize`
convert between that value and `InputPart<R>[]`. An unchanged atom retains its
`originalSource`; a codec can preserve this spelling during serialization.
`label` controls display and default plain-text copying; `editText` controls
Backspace reopening and defaults to `label`. They need not equal the serialized
form. A reference payload has no required ID, type discriminator or raw text.
Treat payloads as immutable values so history retains their identity. Reactive
labels can resolve changing display data from host state without rewriting atoms.

The optional `references.normalize` callback preserves part order and count,
and may replace a reference with literal text. It receives Markdown analysis of
the projected editor text when available. Hosts decide which notation to restore
inside code/math and apply the same policy in `parse`. `examples/tasks` shows
this policy for task notation; S-UI supplies its own message policy.

`singleLine` controls newline insertion, independently of the reference type.
`readonly`, `placeholder`, `labelledBy`, `dir`, `role` and `documentKey` control
presentation and document identity. A new `documentKey` resets the input's Undo
history. The adapter and `singleLine` are fixed for one mount. Remount when
changing the host profile. `markdown` may be toggled and requires
`adapter.markdown`; otherwise the source remains plain.

The exposed handle provides `element`, `focus`, `insertText` and
`insertLineBreak`. Composition, focus, selection direction, history grouping and
DOM transactions are handled by the component. Events include `keydown`,
`keyup`, `beforeInput`, `focus`, `blur` and `layoutChange`.

## Completion and coordinates

`adapter.suggestions(context)` creates a host controller during component setup.
It implements `update`, `updatePosition`, `hide` and `onKeyDown`. Return `true`
from `onKeyDown` when the host consumes a key. The component defers commands
during composition and supplies `finishComposition` for explicit confirmation.
Vue composables and reactive state may be created in this factory.

Candidate data and domain actions stay in that controller. The `suggestions`
slot renders the host's UI and receives `popupId`. The optional reactive
`accessibility()` result supplies `popupRole`, `expanded`, `activeId` and
`announcement`. The popup must use the supplied `popupId`, and `activeId` must
identify the currently active option. The component connects those IDs to the
editable element and announces the selected option. The default role is
`textbox`; use `combobox` for a single-line completion input.

`context.insertParts(parts, range?, focus?)` uses **zero-based UTF-16 offsets in
projected editor text**: text retains its UTF-16 length and each reference atom
occupies one unit (`U+FFFC`). Ranges are half-open and refer to the document
before insertion. They are unrelated to the length of a serialized reference
or its displayed label. `partsToProjectedText` exposes the same projection.

Advanced controllers can access `context.editor()`. This is a Tiptap instance;
its ProseMirror paragraph positions start at **one**, so convert them explicitly
when calling `insertParts`. The `/prosemirror` entry exposes only
`analyzeEditorProbe` (cached analysis using the host's analyzer), `editInput`
(history grouping) and `editorTextBetween` (projected text) for host completion
controllers. Internal editor modules are not public exports. This entry is tied
to the declared Tiptap peer version;
the main component contract does not require hosts to implement transactions.

## Runtime, clipboard and styling

The host creates `MarkdownServices` with `analyze(source)` and
`render(document, node)`. The renderer receives a node from that exact parsed
document and returns trusted HTML. A host can share one parser across inputs;
unmounting one input destroys its editor and leaves shared services alive.
Initialize services before mounting and dispose them after all consumers unmount.

Clipboard hooks are optional. By default, copying uses display text and pasting
inserts plain text. A host may provide validated structured `read`/`write` hooks
and an optional `fromText` conversion. Server identity, schema validation and
cross-application clipboard compatibility belong to that host codec.

Import `/style.css`. Theme through CSS custom properties such as
`--reference-input-accent`, `--reference-input-reference-background`,
`--reference-input-muted`, `--reference-input-focus`,
`--reference-input-border` and `--reference-input-spoiler-background`.
SDK renderer styles can be imported separately when rendering its HTML.

## Development

Build the SDK and this package first with `bun run build` at the repository root.
`bun run test:vue` runs editor model, selection, history, Markdown and composition
contracts in jsdom, using generic reference fixtures and the built SDK Wasm.
`bun run test:vue:browser` tests the standalone task application and a minimal
editor harness in Chromium, Firefox and WebKit, plus mobile Chromium and WebKit
profiles. It covers native DOM selection, Undo/Redo and IME updates; Chromium
also exercises native composition through CDP. Browser tests use port 4181 so
the task example can keep running on port 4180. S-UI's editor tests separately
verify traQ references, completion, clipboard and composer integration.
