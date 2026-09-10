import path from 'path'

import { parseFragment } from 'parse5'

import { packageRoot } from '../../scripts/paths.ts'
import { readLines } from './read-lines.ts'

const readText = (file: string) => Bun.file(file).text()
const readBase64 = async (file: string) =>
  new Uint8Array(await Bun.file(file).arrayBuffer()).toBase64()

const escape = (s: string) => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }
  return s.replace(/[&<>"]/g, c => map[c]!)
}
export async function rendererCss() {
  const commonmark = packageRoot('commonmark')
  const katexFile = Bun.resolveSync('katex/dist/katex.css', commonmark)
  let math = await readText(katexFile)
  for (const match of [...math.matchAll(/url\(([^)]+)\)/g)]) {
    const relative = match[1].replace(/^["']|["']$/g, '')
    const font = path.resolve(path.dirname(katexFile), relative)
    if (
      !font.startsWith(path.dirname(katexFile) + path.sep) ||
      !/^\.(woff2?|ttf)$/.test(path.extname(font))
    )
      throw Error('Unexpected font resource')
    math = math.replaceAll(
      match[0],
      'url(data:font/' +
        path.extname(font).slice(1) +
        ';base64,' +
        (await readBase64(font)) +
        ')'
    )
  }
  const fixture = packageRoot('traq')
  const renderer = await readText(
    path.join(fixture, 'typescript/tests/rendering/fixtures/renderer.css')
  )
  return math + '\n' + renderer
}

type HtmlNode = {
  nodeName: string
  tagName?: string
  attrs?: { name: string; value: string }[]
  value?: string
  childNodes?: HtmlNode[]
}

export function inertHtml(html: string) {
  const allowed = new Set([
    'a',
    'b',
    'blockquote',
    'br',
    'code',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'img',
    'li',
    'ol',
    'p',
    'pre',
    'strong',
    'span',
    'sub',
    'sup',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'ul'
  ])
  const attrs = new Set([
    'alt',
    'class',
    'data-channel-id',
    'data-id',
    'data-user-id',
    'href',
    'src',
    'title'
  ])
  const styles = new Set(['display', 'height', 'max-height', 'max-width', 'width'])
  const render = (node: HtmlNode): string => {
    if (node.nodeName === '#text') return escape(node.value ?? '')
    if (!node.tagName) return ''
    const values = Object.fromEntries(
      (node.attrs ?? []).map((a: { name: string; value: string }) => [
        a.name,
        a.value
      ])
    )
    if (node.tagName === 'img')
      return (
        '<span class="r-image">[画像: ' +
        escape(values.alt ?? '外部画像') +
        ']</span>'
      )
    if (!allowed.has(node.tagName)) return ''
    const name = node.tagName === 'a' ? 'span' : node.tagName
    if (node.tagName === 'a') {
      values.class = (values.class ?? '') + ' r-link'
      values.title = values.href ?? 'リンク'
    }
    let attributes = ''
    for (const [key, value] of Object.entries(values))
      if (attrs.has(key)) attributes += ' ' + key + '="' + escape(value) + '"'
    const style = (values.style ?? '')
      .split(';')
      .filter((part: string) => {
        const index = part.indexOf(':')
        return (
          index > 0 &&
          styles.has(part.slice(0, index).trim()) &&
          !/url|var\(|attr\(/i.test(part)
        )
      })
      .join(';')
    if (style) attributes += ' style="' + escape(style) + '"'
    const open = '<' + name + attributes + '>'
    return ['br', 'hr'].includes(name)
      ? open
      : open + (node.childNodes ?? []).map(render).join('') + '</' + name + '>'
  }
  const fragment = parseFragment(html) as unknown as { childNodes: HtmlNode[] }
  return fragment.childNodes.map(render).join('')
}

export function mhtml(html: string) {
  const boundary = '----markdown-corpus-report'
  const encoded = new TextEncoder().encode(html).toBase64()
  return [
    'MIME-Version: 1.0',
    'Content-Type: multipart/related; type="text/html"; boundary="' +
      boundary +
      '"',
    '',
    '--' + boundary,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    'Content-Location: https://markdown-report.invalid/differences.html',
    '',
    encoded.match(/.{1,76}/g)?.join('\r\n'),
    '--' + boundary + '--',
    ''
  ].join('\r\n')
}
export async function writeMhtml(
  data: string,
  out: string,
  css: string,
  custom: string,
  meta: { messages: number } & Record<string, unknown>
) {
  const labels: Record<string, string> = {
      render: '通常',
      inline: 'インライン',
      notification: '通知'
    },
    rows: Record<string, string[]> = {
      render: [],
      inline: [],
      notification: []
    }
  for (const file of ['sui-differences.jsonl', 'traq-differences.jsonl'])
    for await (const line of readLines(path.join(data, file))) {
      if (!line) continue
      const r = JSON.parse(line)
      const show = (value: string) =>
        r.mode === 'notification'
          ? '<pre class="notification">' + escape(value) + '</pre>'
          : '<div class="markdown-body">' + inertHtml(value) + '</div>'
      rows[r.mode].push(
        '<tr data-mode="' +
          r.mode +
          '"><td><small>#' +
          (r.index + 1) +
          '</small><pre class="source">' +
          escape(r.source) +
          '</pre></td><td>' +
          show(r.before) +
          '</td><td>' +
          show(r.after) +
          '</td></tr>'
      )
    }
  const sections = Object.entries(labels)
    .map(
      ([mode, label]) =>
        '<section id="' +
        mode +
        '"><h2>' +
        label +
        ' · ' +
        rows[mode].length +
        '件</h2><table class="comparison"><colgroup><col class="source-col"><col><col></colgroup><thead><tr><th>原文</th><th>before · master</th><th>after · Rust</th></tr></thead><tbody>' +
        rows[mode].join('') +
        '</tbody></table></section>'
    )
    .join('')
  const html =
    '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; font-src data:; img-src data:; base-uri \'none\'"><title>Markdown 差分一覧</title><style>@layer renderer{' +
    css +
    '}@layer report{' +
    custom +
    ' .comparison pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}section{margin-bottom:32px} .comparison .markdown-body pre{max-height:none}}</style></head><body><header class="top"><div><h1>Markdown 差分一覧</h1><p>' +
    meta.messages.toLocaleString('ja-JP') +
    '件を比較 · 全差分を収録</p><nav><a href="#render">通常</a> · <a href="#inline">インライン</a> · <a href="#notification">通知</a></nav></div></header><main>' +
    sections +
    '</main></body></html>'
  await Bun.write(out, mhtml(html))
}
