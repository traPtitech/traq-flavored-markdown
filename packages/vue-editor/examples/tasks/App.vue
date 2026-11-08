<template>
  <main>
    <h1>Task reference input</h1>
    <p>
      Type <kbd>@</kbd> to insert a task. Markdown, Enter, Tab and Undo are
      supported.
    </p>
    <ReferenceInput
      v-model="source"
      :adapter="adapter"
      markdown
      placeholder="Write a note and mention @task"
      class="input"
      data-testid="task-input"
    >
      <template #suggestions="{ popupId }">
        <ul
          v-if="candidates.length"
          :id="popupId"
          role="listbox"
          aria-label="Tasks"
        >
          <li
            v-for="(task, index) in candidates"
            :id="`${popupId}-${task.number}`"
            :key="task.number"
            role="option"
            tabindex="-1"
            :aria-selected="index === selected"
            @mousedown.prevent
            @click="confirm(task)"
          >
            #{{ task.number }} {{ task.title }}
          </li>
        </ul>
      </template>
    </ReferenceInput>
    <h2>Stored source</h2>
    <pre data-testid="stored-source">{{ source }}</pre>
  </main>
</template>

<script setup lang="ts">
import { isLiteralSource } from '@traq-flavored-markdown/sdk/editor'
import {
  type InputPart,
  type MarkdownServices,
  ReferenceInput,
  type ReferenceInputAdapter,
  type SuggestionContext,
  partsToProjectedText
} from '@traq-flavored-markdown/vue-editor'
import { editorTextBetween } from '@traq-flavored-markdown/vue-editor/prosemirror'
import { ref, shallowRef } from 'vue'

import { type Task, taskCodec, tasks } from './tasks.js'

const props = defineProps<{ markdown: MarkdownServices }>()
const source = ref('Review **these tasks** with [[task:17]].\n\n- ')
const candidates = shallowRef<Task[]>([])
const selected = ref(0)
let context: SuggestionContext<Task> | undefined
let target: { from: number; to: number } | undefined

const hide = () => {
  candidates.value = []
  target = undefined
}

const confirm = (task: Task) => {
  if (!context || !target) return

  context.insertParts(
    [
      { type: 'reference', reference: task },
      { type: 'text', text: ' ' }
    ],
    target
  )

  hide()
}

const normalize = (parts: readonly InputPart<Task>[]) => {
  const literals = props.markdown
    .analyze(partsToProjectedText(parts))
    .nodes.filter(isLiteralSource)

  let position = 0

  return parts.map(part => {
    const literal = literals.some(
      node => node.from <= position && position < node.to
    )

    position += part.type === 'text' ? part.text.length : 1

    return literal && part.type === 'reference'
      ? { type: 'text' as const, text: taskCodec.serialize([part]) }
      : part
  })
}

const adapter: ReferenceInputAdapter<Task> = {
  references: {
    ...taskCodec,
    parse: source => normalize(taskCodec.parse(source)),
    normalize: (parts, analysis) => {
      const literals = (
        analysis ?? props.markdown.analyze(partsToProjectedText(parts))
      ).nodes.filter(isLiteralSource)

      let offset = 0

      return parts.flatMap((part, index) => {
        const literal = literals.some(
          node => node.from <= offset && offset < node.to
        )

        offset += part.type === 'text' ? part.text.length : 1

        return part.type === 'reference' && literal
          ? [{ index, text: taskCodec.serialize([part]) }]
          : []
      })
    }
  },
  label: task => `#${task.number} ${task.title}`,
  editText: task => `@${task.number}`,
  markdown: props.markdown,

  suggestions(current) {
    context = current

    return {
      hide,
      updatePosition: () => undefined,

      update() {
        const editor = current.editor()
        if (
          !editor ||
          !editor.isFocused ||
          current.isComposing() ||
          !editor.state.selection.empty
        ) {
          return hide()
        }

        const text = editorTextBetween(editor.state.doc)
        const cursor = editor.state.selection.from - 1
        const match = /@([\w ]*)$/.exec(text.slice(0, cursor))

        const literal = props.markdown
          .analyze(text)
          .nodes.some(
            node =>
              isLiteralSource(node) && node.from <= cursor && cursor < node.to
          )
        if (!match || literal) return hide()

        target = { from: cursor - match[0].length, to: cursor }
        const word = match[1].toLowerCase()

        candidates.value = tasks.filter(task =>
          `${task.number} ${task.title}`.toLowerCase().includes(word)
        )

        selected.value = Math.min(
          selected.value,
          Math.max(0, candidates.value.length - 1)
        )
      },

      onKeyDown(event) {
        if (!candidates.value.length) return false

        if (event.key === 'Escape') {
          hide()
        } else if (event.key === 'ArrowDown') {
          selected.value = (selected.value + 1) % candidates.value.length
        } else if (event.key === 'ArrowUp') {
          selected.value =
            (selected.value + candidates.value.length - 1) %
            candidates.value.length
        } else if (event.key === 'Enter' || event.key === 'Tab') {
          confirm(candidates.value[selected.value])
        } else {
          return false
        }

        return true
      },

      accessibility: () => ({
        popupRole: 'listbox',
        expanded: candidates.value.length > 0,
        activeId: candidates.value[selected.value]
          ? `${current.popupId}-${candidates.value[selected.value].number}`
          : undefined,
        announcement: candidates.value[selected.value]?.title
      })
    }
  }
}
</script>

<style>
body {
  margin: 0;
  color: #17212b;
  background: #f4f6f8;

  font:
    16px/1.6 system-ui,
    sans-serif;
}

main {
  max-width: 760px;
  margin: 64px auto;
  padding: 0 24px;
}

.input {
  padding: 20px;
  border: 1px solid #ccd2d8;
  border-radius: 8px;
  background: white;
}

pre {
  padding: 16px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: #e9edf2;
  border-radius: 8px;
}

ul {
  padding: 0;
  list-style: none;
}

li[aria-selected='true'] {
  background: #e6f0ff;
}

li[role='option'] {
  width: 100%;
  padding: 8px;
  text-align: left;
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
}
</style>
