import type {
  InputPart,
  ReferenceCodec
} from '@traq-flavored-markdown/vue-editor'

// No traQ entity type, UUID, Pinia store or route is needed.
export type Task = { number: number; title: string }

export const tasks: Task[] = [
  { number: 17, title: 'Write the release notes' },
  { number: 28, title: 'Review the new API' },
  { number: 42, title: 'Fix the keyboard shortcut' }
]

export const taskCodec: ReferenceCodec<Task> = {
  parse(source) {
    const parts: InputPart<Task>[] = []
    let offset = 0

    for (const match of source.matchAll(/\[\[task:(\d+)\]\]/g)) {
      const task = tasks.find(task => task.number === Number(match[1]))
      if (!task) continue

      if (offset < match.index) {
        parts.push({ type: 'text', text: source.slice(offset, match.index) })
      }

      parts.push({
        type: 'reference',
        reference: task,
        originalSource: match[0]
      })

      offset = match.index + match[0].length
    }

    if (offset < source.length) {
      parts.push({ type: 'text', text: source.slice(offset) })
    }

    return parts
  },

  serialize: parts =>
    parts
      .map(part =>
        part.type === 'text'
          ? part.text
          : (part.originalSource ?? `[[task:${part.reference.number}]]`)
      )
      .join('')
}
