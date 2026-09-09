import { createReadStream } from "node:fs";
// JSONL is delimited by LF; U+2028 and U+2029 can occur inside JSON strings.
export async function* readLines(file) {
  let pending = "";
  for await (const chunk of createReadStream(file, {
    encoding: "utf8",
    highWaterMark: 1 << 20,
  })) {
    pending += chunk;
    let start = 0,
      end;
    while ((end = pending.indexOf("\n", start)) !== -1) {
      yield pending.slice(start, end);
      start = end + 1;
    }
    pending = pending.slice(start);
  }
  if (pending) yield pending;
}
