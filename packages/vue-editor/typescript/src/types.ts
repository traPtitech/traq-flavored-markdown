import type { Editor } from '@tiptap/core'
import type { ParsedDocument, ReadonlyNode } from '@traq-flavored-markdown/sdk'
import type {
  EditorRange,
  LineBreakOptions,
  SourceAnalysis
} from '@traq-flavored-markdown/sdk/editor'

export type SourceRange = EditorRange
export type MarkdownLineBreakOptions = Pick<LineBreakOptions, 'continueItem'>

export type InputPart<R = unknown> =
  | { type: 'text'; text: string }
  | { type: 'reference'; reference: R; originalSource?: string }

export interface ReferenceCodec<R> {
  parse(source: string): InputPart<R>[]
  serialize(parts: readonly InputPart<R>[]): string

  /** Preserve part order/count; a reference may become literal text. */
  normalize?(
    parts: readonly InputPart<R>[],
    analysis?: SourceAnalysis
  ): InputPart<R>[]
}

export interface MarkdownServices {
  analyze(source: string): SourceAnalysis
  /** Return trusted HTML for a node belonging to the supplied document. */
  render(document: ParsedDocument, node: ReadonlyNode): string
}

export type PastePlan =
  { type: 'handled' } | { type: 'text'; text: string | Promise<string> }

export type PreparePaste = (event: ClipboardEvent) => PastePlan | undefined

export interface SuggestionAccessibility {
  popupRole: 'listbox' | 'grid' | 'tree'
  expanded: boolean
  activeId?: string
  announcement?: string
}

export interface SuggestionController {
  update(): void
  updatePosition(): void
  hide(): void
  onKeyDown(event: KeyboardEvent): boolean
  /** Read reactive state here; activeId must identify an element in the popup. */
  accessibility?(): SuggestionAccessibility
}

export interface SuggestionContext<R> {
  popupId: string
  /** Advanced integration: Tiptap positions include the paragraph's opening token. */
  editor: () => Editor | undefined
  isComposing(): boolean
  finishComposition(action: () => void): void
  /** Ranges use UTF-16 projected text offsets, with each reference occupying one unit. */
  insertParts(parts: InputPart<R>[], range?: EditorRange, focus?: boolean): void
}

export interface ReferenceInputAdapter<R> {
  references: ReferenceCodec<R>
  label(reference: R): string
  /** Authored text restored when reopening a reference; defaults to label. */
  editText?(reference: R): string
  markdown?: MarkdownServices
  suggestions?(context: SuggestionContext<R>): SuggestionController

  clipboard?: {
    read(data: Pick<DataTransfer, 'getData'>): InputPart<R>[] | undefined

    write(
      data: Pick<DataTransfer, 'setData'>,
      parts: readonly InputPart<R>[]
    ): void

    fromText?(
      text: string,
      before: string,
      after: string
    ): InputPart<R>[] | undefined
  }
}

export interface ReferenceInputHandle {
  readonly element?: HTMLElement
  focus(position?: 'end'): void
  insertText(text: string, options?: { focus?: boolean }): void
  insertLineBreak(options?: MarkdownLineBreakOptions): void
}
