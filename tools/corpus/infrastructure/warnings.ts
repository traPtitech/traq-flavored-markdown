/** Each frontend worker has its own process; warnings must not disclose corpus text. */
export function countPrivateWarnings() {
  const previous = console.warn
  let count = 0
  console.warn = () => {
    count++
  }
  return {
    get count() {
      return count
    },
    [Symbol.dispose]() {
      console.warn = previous
    }
  }
}
