export const whitespace = (s: string) => s.replace(/[ \t\r\n\f]/g, '')
export function ignoreMask(row: {
  before: string
  after: string
  error?: boolean
  source?: string
  index?: number
  mode?: string
}) {
  return Number(!row.error && whitespace(row.before) === whitespace(row.after))
}
