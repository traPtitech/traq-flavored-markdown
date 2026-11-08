import type { PluginKey, Transaction } from '@tiptap/pm/state'

/** Keep ProseMirror's untyped metadata boundary at the owning plugin. */
export const transactionMetadata = <T>(key: PluginKey) => ({
  get: (transaction: Transaction): T | undefined => transaction.getMeta(key),
  set: (transaction: Transaction, value: T) => transaction.setMeta(key, value)
})
