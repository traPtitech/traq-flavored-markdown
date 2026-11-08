import { EditorContent } from '@tiptap/vue-3'
import { type VueWrapper, mount } from '@vue/test-utils'
import { afterEach } from 'vitest'
import { nextTick } from 'vue'

import ReferenceInput from '../../src/ReferenceInput.vue'
import type {
  ReferenceInputAdapter,
  ReferenceInputHandle
} from '../../src/types.js'
import {
  type TestReference,
  encodeReference,
  referenceCodec
} from '../helpers/references.js'

export const embedded = encodeReference({ key: 'stable-key', label: '@alice' })
type InputWrapper = Omit<VueWrapper, 'vm'> & { vm: ReferenceInputHandle }
const wrappers: InputWrapper[] = []

export const makeInput = async ({
  source = '',
  mode = 'multiline',
  adapter
}: {
  source?: string
  mode?: 'multiline' | 'single-line'
  adapter?: Partial<ReferenceInputAdapter<TestReference>>
} = {}) => {
  const wrapper = mount(ReferenceInput<TestReference>, {
    attachTo: document.body,
    props: {
      modelValue: source,
      singleLine: mode === 'single-line',
      role: mode === 'single-line' ? 'combobox' : 'textbox',
      placeholder: 'input',
      adapter: {
        label: reference => reference.label,
        references: referenceCodec,
        ...adapter
      },

      'onUpdate:modelValue': (value: string) => {
        void wrapper.setProps({ modelValue: value })
      }
    }
  }) as unknown as InputWrapper

  wrappers.push(wrapper)
  await nextTick()
  return wrapper
}

export const getEditor = (wrapper: Pick<InputWrapper, 'getComponent'>) => {
  const editor = wrapper.getComponent(EditorContent).props('editor')
  if (!editor) throw new Error('Missing input editor')

  return editor
}

export const focus = async (wrapper: InputWrapper) => {
  wrapper.vm.element?.focus()
  await nextTick()
}

export const press = (
  wrapper: InputWrapper,
  key: string,
  options: KeyboardEventInit = {}
) =>
  wrapper.vm.element?.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...options
    })
  )

export const lastValue = (wrapper: InputWrapper) =>
  wrapper.emitted('update:modelValue')?.at(-1)?.[0]

export const installReferenceInputFixture = () =>
  afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))
