export const whitespace = (s) => s.replace(/[ \t\r\n\f]/g, "");
export function ignoreMask(row) {
  return Number(!row.error && whitespace(row.before) === whitespace(row.after));
}
