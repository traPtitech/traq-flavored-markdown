import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { parseFragment } from "parse5";
import { readLines } from "./read-lines.mjs";
const require = createRequire(import.meta.url);
const escape = (s) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
export async function rendererCss() {
  const katexFile = require.resolve("katex/dist/katex.css", {
    paths: [fileURLToPath(new URL("../../../commonmark/", import.meta.url))],
  });
  let math = await readFile(katexFile, "utf8");
  for (const match of [...math.matchAll(/url\(([^)]+)\)/g)]) {
    const relative = match[1].replace(/^["']|["']$/g, "");
    const font = path.resolve(path.dirname(katexFile), relative);
    if (
      !font.startsWith(path.dirname(katexFile) + path.sep) ||
      !/^\.(woff2?|ttf)$/.test(path.extname(font))
    )
      throw Error("Unexpected font resource");
    math = math.replaceAll(
      match[0],
      "url(data:font/" +
        path.extname(font).slice(1) +
        ";base64," +
        (await readFile(font)).toString("base64") +
        ")",
    );
  }
  return (
    (await readFile(new URL("../../dist/index.css", import.meta.url))) +
    "\n" +
    math
  );
}
const allowed = new Set(
  "p div span pre code br hr strong b em i del s ins mark sub sup a ul ol li blockquote h1 h2 h3 h4 h5 h6 table thead tbody tr td th cite svg path line".split(
    " ",
  ),
);
const attrs = new Set([
  "class",
  "title",
  "colspan",
  "rowspan",
  "start",
  "aria-hidden",
  "viewBox",
  "d",
  "width",
  "height",
  "x1",
  "x2",
  "y1",
  "y2",
]);
const styles = new Set([
  "height",
  "width",
  "min-width",
  "vertical-align",
  "margin-right",
  "margin-left",
  "top",
  "background-color",
  "text-align",
]);
export function inertHtml(html) {
  const render = (node) => {
    if (node.nodeName === "#text") return escape(node.value);
    if (!node.tagName) return "";
    const values = Object.fromEntries(
      (node.attrs ?? []).map((a) => [a.name, a.value]),
    );
    if (node.tagName === "img")
      return (
        '<span class="r-image">[画像: ' +
        escape(values.alt ?? "外部画像") +
        "]</span>"
      );
    if (!allowed.has(node.tagName)) return "";
    const name = node.tagName === "a" ? "span" : node.tagName;
    if (node.tagName === "a") {
      values.class = (values.class ?? "") + " r-link";
      values.title = values.href ?? "リンク";
    }
    let attributes = "";
    for (const [key, value] of Object.entries(values))
      if (attrs.has(key)) attributes += " " + key + '="' + escape(value) + '"';
    const style = (values.style ?? "")
      .split(";")
      .filter((part) => {
        const index = part.indexOf(":");
        return (
          index > 0 &&
          styles.has(part.slice(0, index).trim()) &&
          !/url|var\(|attr\(/i.test(part)
        );
      })
      .join(";");
    if (style) attributes += ' style="' + escape(style) + '"';
    const open = "<" + name + attributes + ">";
    return ["br", "hr"].includes(name)
      ? open
      : open + (node.childNodes ?? []).map(render).join("") + "</" + name + ">";
  };
  return parseFragment(html).childNodes.map(render).join("");
}
export function mhtml(html) {
  const boundary = "----markdown-corpus-report";
  return [
    "MIME-Version: 1.0",
    'Content-Type: multipart/related; type="text/html"; boundary="' +
      boundary +
      '"',
    "",
    "--" + boundary,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "Content-Location: https://markdown-report.invalid/differences.html",
    "",
    Buffer.from(html)
      .toString("base64")
      .match(/.{1,76}/g)
      .join("\r\n"),
    "--" + boundary + "--",
    "",
  ].join("\r\n");
}
export async function writeMhtml(data, out, css, custom, meta) {
  const labels = { render: "通常", inline: "インライン", notification: "通知" },
    rows = { render: [], inline: [], notification: [] };
  for (const file of ["sui-differences.jsonl", "traq-differences.jsonl"])
    for await (const line of readLines(path.join(data, file))) {
      if (!line) continue;
      const r = JSON.parse(line);
      const show = (value) =>
        r.mode === "notification"
          ? '<pre class="notification">' + escape(value) + "</pre>"
          : '<div class="markdown-body">' + inertHtml(value) + "</div>";
      rows[r.mode].push(
        '<tr data-mode="' +
          r.mode +
          '"><td><small>#' +
          (r.index + 1) +
          '</small><pre class="source">' +
          escape(r.source) +
          "</pre></td><td>" +
          show(r.before) +
          "</td><td>" +
          show(r.after) +
          "</td></tr>",
      );
    }
  const sections = Object.entries(labels)
    .map(
      ([mode, label]) =>
        '<section id="' +
        mode +
        '"><h2>' +
        label +
        " · " +
        rows[mode].length +
        '件</h2><table class="comparison"><colgroup><col class="source-col"><col><col></colgroup><thead><tr><th>原文</th><th>before · master</th><th>after · Rust</th></tr></thead><tbody>' +
        rows[mode].join("") +
        "</tbody></table></section>",
    )
    .join("");
  const html =
    '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; font-src data:; img-src data:; base-uri \'none\'"><title>Markdown 差分一覧</title><style>@layer renderer{' +
    css +
    "}@layer report{" +
    custom +
    ' .comparison pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}section{margin-bottom:32px} .comparison .markdown-body pre{max-height:none}}</style></head><body><header class="top"><div><h1>Markdown 差分一覧</h1><p>' +
    meta.messages.toLocaleString("ja-JP") +
    '件を比較 · 全差分を収録</p><nav><a href="#render">通常</a> · <a href="#inline">インライン</a> · <a href="#notification">通知</a></nav></div></header><main>' +
    sections +
    "</main></body></html>";
  await writeFile(out, mhtml(html));
}
