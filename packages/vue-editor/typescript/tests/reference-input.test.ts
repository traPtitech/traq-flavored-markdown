import { undo } from '@tiptap/pm/history'
import { EditorContent } from '@tiptap/vue-3'
import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { type Task, taskCodec, tasks } from '../../examples/tasks/tasks.js'
import ReferenceInput from '../src/ReferenceInput.vue'
import { partsToProjectedText } from '../src/projection.js'
import type {
  InputPart,
  ReferenceInputAdapter,
  SuggestionContext
} from '../src/types.js'

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))
beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
  HTMLElement.prototype.scrollIntoView = vi.fn()
})
const make = async (
  source: string,
  options: Partial<ReferenceInputAdapter<Task>> = {},
  singleLine = false
) => {
  const adapter: ReferenceInputAdapter<Task> = {
    references: taskCodec,
    label: task => `Task ${task.number}`,
    editText: task => `@${task.number}`,
    ...options
  }
  const wrapper = mount(ReferenceInput<Task>, {
    attachTo: document.body,
    props: { modelValue: source, adapter, singleLine, placeholder: 'Tasks' }
  })
  wrappers.push(wrapper)
  await nextTick()
  const editor = wrapper.getComponent(EditorContent).props('editor')
  if (!editor) throw new Error('No mounted editor')
  return { wrapper, editor }
}

describe('arbitrary reference payloads', () => {
  it('round-trips a numeric task reference without traQ fields and preserves authored notation', async () => {
    const { editor, wrapper } = await make('😀 [[task:017]]')
    expect(editor.view.dom.textContent).toBe('😀 Task 17')
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.commands.insertContent('!')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      '😀 [[task:017]]!'
    ])
    expect(partsToProjectedText(taskCodec.parse('😀 [[task:017]]'))).toBe(
      '😀 \uFFFC'
    )
  })
  it('reopens authored text separately from its label and restores the atom through Undo', async () => {
    const { editor, wrapper } = await make('[[task:17]]')
    editor.commands.setTextSelection(2)
    editor.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Backspace',
        bubbles: true,
        cancelable: true
      })
    )
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['@17'])
    expect(editor.view.dom.querySelector('.reference-token')).toBeNull()
    undo(editor.state, editor.view.dispatch)
    expect(editor.view.dom.querySelector('.reference-token')?.textContent).toBe(
      'Task 17'
    )
  })
  it('provides projected UTF-16 insertion coordinates and host-owned popup accessibility', async () => {
    let context: SuggestionContext<Task> | undefined
    const active = ref(true)
    const { editor, wrapper } = await make('😀 [[task:17]] tail', {
      suggestions: current => {
        context = current
        return {
          update: () => undefined,
          updatePosition: () => undefined,
          hide: () => undefined,
          onKeyDown: () => false,
          accessibility: () => ({
            popupRole: 'listbox',
            expanded: active.value,
            activeId: 'task-option',
            announcement: 'Task 28'
          })
        }
      }
    })
    expect(editor.view.dom.getAttribute('aria-activedescendant')).toBe(
      'task-option'
    )
    expect(wrapper.find('[aria-live]').text()).toBe('Task 28')
    context?.insertParts(
      [{ type: 'reference', reference: tasks[1] }],
      { from: 5, to: 9 },
      false
    )
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      '😀 [[task:17]] [[task:28]]'
    ])
    active.value = false
    await nextTick()
    expect(editor.view.dom.hasAttribute('aria-activedescendant')).toBe(false)
  })
  it('copies plain display text by default and consumes an explicit host clipboard codec', async () => {
    const data = { getData: vi.fn(() => ''), setData: vi.fn() }
    const { editor } = await make('[[task:17]]')
    editor.commands.selectAll()
    const copy = new Event('copy', { bubbles: true, cancelable: true })
    Object.defineProperty(copy, 'clipboardData', { value: data })
    editor.view.dom.dispatchEvent(copy)
    expect(data.setData).toHaveBeenCalledWith('text/plain', 'Task 17')
    const parts: InputPart<Task>[] = [
      { type: 'reference', reference: tasks[1] }
    ]
    const read = vi.fn(() => parts)
    const second = await make('', { clipboard: { read, write: vi.fn() } })
    const paste = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(paste, 'clipboardData', { value: data })
    second.editor.view.dom.dispatchEvent(paste)
    expect(read).toHaveBeenCalledWith(data)
    expect(second.wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      '[[task:28]]'
    ])
  })
  it('keeps single-line policy independent of the host reference type', async () => {
    const { editor, wrapper } = await make('', {}, true)
    editor.commands.insertContent('hello')
    editor.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true
      })
    )
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['hello'])
    expect(editor.view.dom.getAttribute('aria-multiline')).toBe('false')
  })
})
