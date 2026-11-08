<template>
  <main>
    <ReferenceInput
      :key="String(singleLine)"
      v-model="text"
      :adapter="adapter"
      :single-line="singleLine"
      :role="singleLine ? 'combobox' : 'textbox'"
      :markdown="markdownEnabled"
      :readonly="readonly"
      :document-key="documentKey"
      placeholder="Regression input"
      @keydown="onKeydown"
    />
    <button type="button">Outside the input</button>
    <pre data-testid="source">{{ text }}</pre>
    <output data-testid="parent-actions">{{ parentActions }}</output>
  </main>
</template>
<script setup lang="ts">
import {
  type MarkdownServices,
  ReferenceInput,
  type ReferenceInputAdapter
} from '@traq-flavored-markdown/vue-editor'
import { nextTick, ref } from 'vue'

import { type Task, taskCodec } from '../../examples/tasks/tasks.js'
import type { Draft } from './types.js'

const props = defineProps<{ markdown: MarkdownServices }>()
const text = ref('')
const singleLine = ref(false)
const markdownEnabled = ref(false)
const readonly = ref(false)
const documentKey = ref<string>()
const parentActions = ref(0)
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    parentActions.value++
  }
}
const adapter: ReferenceInputAdapter<Task> = {
  references: taskCodec,
  label: task => task.title,
  markdown: props.markdown
}
window.editorHarness = {
  ready: nextTick(),
  async load(draft: Draft) {
    text.value = draft.text
    singleLine.value = draft.singleLine ?? false
    markdownEnabled.value = draft.markdown ?? false
    readonly.value = draft.readonly ?? false
    documentKey.value = draft.documentKey
    parentActions.value = 0
    await nextTick()
  }
}
</script>
<style>
body {
  margin: 0;
  font:
    16px/1.5 system-ui,
    sans-serif;
}
main {
  max-width: 760px;
  margin: 24px;
  padding: 16px;
}
.reference-input {
  min-height: 80px;
  border: 1px solid #aaa;
  padding: 12px;
}
pre {
  white-space: pre-wrap;
}
</style>
