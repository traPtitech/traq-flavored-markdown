import assert from "node:assert/strict";
import { inertHtml, mhtml } from "./report-assets.mjs";
import { ignoreMask } from "./ignore-differences.mjs";
const source =
  '<script>bad()</script><img src="https://invalid.example/a" onerror="bad()"><a href="javascript:bad()" onclick="bad()">&lt;text&gt;</a><span style="height:2em;background-image:url(https://invalid.example)">math</span>';
const result = inertHtml(source);
assert(!/<script|<img|<a\s|onclick|onerror|background-image/.test(result));
assert(result.includes("&lt;text&gt;"));
assert(result.includes("height:2em"));
assert(!result.includes(">bad()</"));
assert.equal(ignoreMask({ before: "a \nb", after: "ab" }), 1);
assert.equal(ignoreMask({ before: "a", after: "b" }), 0);
const html = '<!doctype html><html lang="ja"><body>日本語 $x$</body></html>';
const archive = mhtml(html);
const payload = archive
  .split(
    "Content-Location: https://markdown-report.invalid/differences.html\r\n\r\n",
  )[1]
  .split("\r\n------markdown-corpus-report--")[0];
assert.equal(
  Buffer.from(payload.replaceAll("\r\n", ""), "base64").toString(),
  html,
);
console.log(
  "Inert rendering, whitespace filter, and UTF-8 MHTML round trip passed",
);
