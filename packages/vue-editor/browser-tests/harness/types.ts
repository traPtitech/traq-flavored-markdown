export type Draft = {
  text: string
  singleLine?: boolean
  markdown?: boolean
  readonly?: boolean
  documentKey?: string
}
declare global {
  interface Window {
    editorHarness: { ready: Promise<void>; load(draft: Draft): Promise<void> }
  }
}
