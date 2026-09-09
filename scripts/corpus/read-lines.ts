// JSONL is delimited by LF; U+2028 and U+2029 can occur inside JSON strings.
export async function* readLines(file) {
  let pending = ''
  const decoder = new TextDecoder()
  for await (const chunk of Bun.file(file).stream()) {
    pending += decoder.decode(chunk, { stream: true })
    let start = 0,
      end
    while ((end = pending.indexOf('\n', start)) !== -1) {
      yield pending.slice(start, end)
      start = end + 1
    }
    pending = pending.slice(start)
  }
  pending += decoder.decode()
  if (pending) yield pending
}
