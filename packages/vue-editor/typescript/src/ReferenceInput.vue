<template>
  <div
    class="reference-input"
    :data-readonly="readonly"
    :dir="dir"
    @mousedown.left.self.prevent="focus()"
  >
    <EditorContent :editor="editor" class="reference-input-content" />
    <slot name="suggestions" :popup-id="popupId" :suggestions="suggestions" />
    <span class="reference-input-announcement" aria-live="polite">{{
      accessibility?.announcement ?? ''
    }}</span>
  </div>
</template>

<script setup lang="ts" generic="R">
import { EditorContent } from '@tiptap/vue-3'
import { computed, proxyRefs, useId } from 'vue'

import useReferenceEditor from './internal/useReferenceEditor.js'
import type {
  PreparePaste,
  ReferenceInputAdapter,
  ReferenceInputHandle
} from './types.js'

const props = withDefaults(
  defineProps<{
    /** Fixed for this mount. Services are owned and disposed by the host. */
    adapter: ReferenceInputAdapter<R>
    singleLine?: boolean
    role?: 'textbox' | 'combobox'
    dir?: 'auto' | 'ltr' | 'rtl'
    placeholder?: string
    labelledBy?: string
    readonly?: boolean
    markdown?: boolean
    preparePaste?: PreparePaste
    documentKey?: string | number
    testId?: string
  }>(),
  {
    singleLine: false,
    role: 'textbox',
    placeholder: '',
    readonly: false,
    markdown: false
  }
)

const model = defineModel<string>({ default: '' })

const emit = defineEmits<{
  keydown: [event: KeyboardEvent]
  keyup: [event: KeyboardEvent]
  beforeInput: [event: InputEvent]
  focus: []
  blur: []
  layoutChange: []
}>()

const popupId = useId()

const { editor, suggestions, focus, insertText, insertLineBreak, element } =
  useReferenceEditor({
    model,
    props,
    adapter: props.adapter,
    popupId,

    attributes: controller => {
      const popup = controller.accessibility?.()

      return {
        role: props.role,
        tabindex: '0',
        dir: props.dir ?? 'auto',
        ...(popup
          ? {
              'aria-autocomplete': 'list',
              'aria-haspopup': popup.popupRole,
              ...(popup.expanded ? { 'aria-controls': popupId } : {}),
              ...(popup.expanded && popup.activeId
                ? { 'aria-activedescendant': popup.activeId }
                : {})
            }
          : {}),
        ...(props.role === 'combobox'
          ? { 'aria-expanded': String(popup?.expanded ?? false) }
          : {}),
        ...(props.labelledBy
          ? { 'aria-labelledby': props.labelledBy }
          : { 'aria-label': props.placeholder }),
        'aria-readonly': String(props.readonly),
        'aria-multiline': String(!props.singleLine),
        'data-placeholder': props.placeholder,
        ...(props.testId ? { 'data-testid': props.testId } : {})
      }
    },

    onKeyDown: event => emit('keydown', event),
    onKeyUp: event => emit('keyup', event),
    onBeforeInput: event => emit('beforeInput', event),
    onFocus: () => emit('focus'),
    onBlur: () => emit('blur'),
    onLayoutChange: () => emit('layoutChange')
  })

const accessibility = computed(() => suggestions.accessibility?.())

defineExpose(
  proxyRefs({
    focus,
    insertText,
    insertLineBreak,
    element
  }) satisfies ReferenceInputHandle
)
</script>
