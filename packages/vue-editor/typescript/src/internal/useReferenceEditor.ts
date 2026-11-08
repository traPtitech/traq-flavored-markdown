import { useEditor } from '@tiptap/vue-3'
import { useResizeObserver } from '@vueuse/core'
import { type Ref, computed, nextTick, watch } from 'vue'

import type { SuggestionController } from '../types.js'
import type { ReferenceInputAdapter } from '../types.js'
import {
  type ReferenceInputHandle,
  contentToParts,
  inputExtensions
} from './editor.js'
import { createInputCommands } from './input/commands.js'
import { toDocumentRange } from './input/coordinates.js'
import { type PreparePaste, inputDataTransfer } from './input/dataTransfer.js'
import {
  loadInputDocument,
  replaceInputDocument,
  sourceToContent
} from './input/document.js'
import { createInputEventHandlers } from './input/events.js'
import {
  type InputRuntimeState,
  inputLifecycleKey,
  inputLifecycleMetadata
} from './input/lifecycle.js'
import { isIOS } from './input/platform.js'
import useInputComposition from './input/useComposition.js'
import {
  type MarkdownLineBreakOptions,
  markdownLineBreak
} from './markdown/lineBreak.js'

interface ReferenceEditorOptions<R> {
  model: Ref<string>
  adapter: ReferenceInputAdapter<R>
  popupId: string

  props: {
    singleLine: boolean
    readonly: boolean
    markdown: boolean
    documentKey?: string | number
    preparePaste?: PreparePaste
  }

  attributes: (suggestions: SuggestionController) => Record<string, string>
  onKeyDown: (event: KeyboardEvent) => void
  onKeyUp: (event: KeyboardEvent) => void
  onBeforeInput: (event: InputEvent) => void
  onFocus: () => void
  onBlur: () => void
  onLayoutChange: () => void
}

export default function useReferenceEditor<R>(
  options: ReferenceEditorOptions<R>
) {
  const { model, props, adapter } = options
  const { label } = adapter

  const updateInputRuntimeState = (runtime: Partial<InputRuntimeState>) => {
    const current = editor.value
    if (!current || current.isDestroyed) return

    const previous = inputLifecycleKey.getState(current.state)

    if (
      Object.entries(runtime).every(
        ([key, value]) => previous?.[key as keyof InputRuntimeState] === value
      )
    ) {
      return
    }

    current.view.dispatch(inputLifecycleMetadata.set(current.state.tr, runtime))
    nextTick(() => options.onLayoutChange())
  }

  const {
    isComposing,
    isCompositionKeyEvent,
    finish: finishComposition,
    start: startComposition,
    end: endComposition
  } = useInputComposition({
    view: () => editor.value?.view,
    onChange: composing => updateInputRuntimeState({ composing }),

    onSettled: () =>
      nextTick(() => {
        updateTarget()
        syncEditorAttributes()
      })
  })

  const { insertParts, insertText: insertTextAt } = createInputCommands<R>({
    editor: () => editor.value,
    readonly: () => props.readonly,
    singleLine: () => props.singleLine
  })

  const insertText: ReferenceInputHandle['insertText'] = (
    text,
    { focus } = {}
  ) => insertTextAt(text, undefined, focus)

  const insertLineBreak = (options: MarkdownLineBreakOptions = {}) => {
    const current = editor.value

    if (!current || props.readonly || props.singleLine || isComposing()) return

    if (!props.markdown || !adapter.markdown) {
      insertText('\n')

      return
    }

    current.view.dispatch(markdownLineBreak(current.state, options))
    current.view.focus()
  }

  const suggestions = adapter.suggestions?.({
    popupId: options.popupId,
    editor: () => editor.value,
    isComposing,
    finishComposition,

    insertParts: (parts, range, focus) =>
      insertParts(parts, range ? toDocumentRange(range) : undefined, focus)
  }) ?? {
    update: () => undefined,
    updatePosition: () => undefined,
    hide: () => undefined,
    onKeyDown: () => false
  }

  const {
    update: updateTarget,
    updatePosition,
    hide: hideSuggestions,
    onKeyDown: onSuggestionKeyDown
  } = suggestions

  const handleKeyAction = (event: KeyboardEvent) => {
    if (onSuggestionKeyDown(event)) return true

    options.onKeyDown(event)

    return event.defaultPrevented
  }

  const inputEvents = createInputEventHandlers({
    isIOS: isIOS(),
    isComposing,
    isCompositionKeyEvent,
    handleKeyAction,
    insertLineBreak,
    startComposition,
    endComposition,
    hideSuggestions,
    onKeyUp: event => options.onKeyUp(event),
    onBeforeInput: event => options.onBeforeInput(event)
  })

  const editorAttributes = computed(() => options.attributes(suggestions))

  const editor = useEditor({
    extensions: inputExtensions({
      label,
      singleLine: props.singleLine,
      editText: adapter.editText,
      isComposing,
      markdown: adapter.markdown,
      normalize: adapter.references.normalize
    }),

    content: sourceToContent(model.value, adapter.references),

    editable: !props.readonly,
    enableCoreExtensions: { keymap: false },
    enableInputRules: false,
    enablePasteRules: false,

    editorProps: {
      attributes: ({ doc }) => ({
        ...editorAttributes.value,
        'data-is-empty': String(doc.firstChild?.childCount === 0)
      }),

      ...inputEvents,

      handleDOMEvents: {
        ...inputEvents.handleDOMEvents,

        ...inputDataTransfer({
          editor: () => editor.value,
          readonly: () => props.readonly,
          singleLine: () => props.singleLine,
          clipboard: adapter.clipboard,
          label,
          insertParts,
          insertText: insertTextAt,
          preparePaste: event => props.preparePaste?.(event)
        })
      }
    },

    onUpdate: ({ editor: current }) => {
      model.value = adapter.references.serialize(
        contentToParts<R>(current.state.doc)
      )

      nextTick(() => {
        updateTarget()
        options.onLayoutChange()
      })
    },

    onSelectionUpdate: updateTarget,

    onFocus: () => {
      updateInputRuntimeState({ focused: true })
      options.onFocus()
    },

    onBlur: () => {
      updateInputRuntimeState({ focused: false })
      hideSuggestions()
      options.onBlur()
    }
  })

  watch(
    () => [editor.value, props.markdown] as const,
    () =>
      updateInputRuntimeState({
        markdown: !props.singleLine && props.markdown && !!adapter.markdown
      })
  )

  const syncEditorAttributes = () => {
    const current = editor.value

    if (current && !current.isDestroyed && !isComposing()) {
      current.setOptions({})
    }
  }

  watch([editor, editorAttributes], syncEditorAttributes)

  watch([model, () => props.documentKey], ([value, key], [, previousKey]) => {
    const current = editor.value
    if (!current) return

    const changed =
      key === undefined || key !== previousKey
        ? loadInputDocument(
            current,
            value,
            key !== previousKey,
            adapter.references
          )
        : replaceInputDocument(current, value, adapter.references)

    if (!changed) return

    hideSuggestions()
    options.onLayoutChange()
  })

  watch(
    () => props.readonly,
    value => editor.value?.setEditable(!value, false)
  )

  const focus: ReferenceInputHandle['focus'] = position =>
    editor.value?.commands.focus(position)

  const element = computed(() => editor.value?.view.dom)

  useResizeObserver(element, () => {
    updatePosition()
    options.onLayoutChange()
  })

  return { editor, suggestions, focus, insertText, insertLineBreak, element }
}
