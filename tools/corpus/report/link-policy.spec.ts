import { expect, test } from 'bun:test'
import punycode from 'punycode/punycode.js'

import { differenceFilters } from '../protocol/report.ts'
import { fixtureLinkedImage, fixtureRows } from '../testing/fixtures.ts'
import { differenceFilterMask } from './filter.ts'

const origin = 'https://q.example.test'
const { toASCII } = punycode
const file = origin + '/files/00000000-0000-0000-0000-000000000001'
const quote = origin + '/messages/00000000-0000-0000-0000-000000000002'
const anchor = (url: string, label = url) =>
  `<a href="${url}" target="_blank" rel="nofollow noopener noreferrer">${label}</a>`
const filtered = (
  source: string,
  before: string,
  after: string,
  kind: 'html' | 'text' = 'html',
  profile: 'render' | 'inline' | 'plainText' = 'render'
) =>
  Boolean(
    differenceFilterMask(
      {
        source,
        profile,
        before: { kind, value: before },
        after: { kind, value: after }
      },
      origin
    ) & differenceFilters.linkPolicy
  )

test('link policy recognizes scheme-less URL delinking and forced angle domains', () => {
  for (const [source, before, after] of [
    ['trap.jp', anchor('http://trap.jp', 'trap.jp'), 'trap.jp'],
    ['//trap.jp', anchor('//trap.jp'), anchor('https://trap.jp', '//trap.jp')],
    [
      '<trap.jp>',
      '&lt;' + anchor('http://trap.jp', 'trap.jp') + '&gt;',
      anchor('https://trap.jp', 'trap.jp')
    ],
    [
      '<README.md>',
      '&lt;README.md&gt;',
      anchor('https://readme.md', 'README.md')
    ],
    [
      '<//trap.jp>',
      '&lt;' + anchor('//trap.jp') + '&gt;',
      anchor('https://trap.jp', '//trap.jp')
    ]
  ])
    expect(filtered(source, before, after), source).toBe(true)
  expect(
    filtered('<README.md>', '<README.md>', 'README.md', 'text', 'plainText')
  ).toBe(true)
  expect(
    filtered('http://x/%00', 'http://x/\0', 'http://x/%00', 'text', 'plainText')
  ).toBe(false)
})

test('domain delinking ignores URL substrings inside differently labelled explicit links', () => {
  for (const [source, before, after] of [
    [
      '## [Runtime.NET の記事](https://news.example.test/article)\nRuntime.NET の説明',
      '<h2>' +
        anchor('https://news.example.test/article', 'Runtime.NET の記事') +
        '</h2>\n<p>' +
        anchor('http://Runtime.NET', 'Runtime.NET') +
        ' の説明</p>\n',
      '<h2>' +
        anchor('https://news.example.test/article', 'Runtime.NET の記事') +
        '</h2>\n<p>Runtime.NET の説明</p>\n'
    ],
    [
      '[更新記事](https://blog.example.test/entry/123)\nblog.example.test',
      anchor('https://blog.example.test/entry/123', '更新記事') +
        ' ' +
        anchor('http://blog.example.test', 'blog.example.test'),
      anchor('https://blog.example.test/entry/123', '更新記事') +
        ' blog.example.test'
    ]
  ]) {
    expect(filtered(source, before, after), source).toBe(true)
    expect(filtered(source, before, after + '別の変更'), source).toBe(false)
    expect(
      filtered(source, before, after.replace('https://', 'http://')),
      source
    ).toBe(false)
  }
  for (const rawLabel of [
    'trap.jp',
    'trap\\.jp',
    't&#114;ap.jp',
    '**trap.jp**'
  ]) {
    const source = `[${rawLabel}](http://trap.jp) trap.jp`
    expect(
      filtered(
        source,
        anchor('http://trap.jp', 'trap.jp') +
          ' ' +
          anchor('http://trap.jp', 'trap.jp'),
        'trap.jp trap.jp'
      )
    ).toBe(false)
  }
  expect(
    filtered(
      '[記事](http://trap.jp)',
      anchor('http://trap.jp', 'trap.jp'),
      'trap.jp'
    )
  ).toBe(false)
})

test('formatted explicit labels do not block unrelated bare domain changes', () => {
  for (const title of ['`abc123`', '**更新記事**', '更新 &amp; 修正']) {
    const source = `[${title}](https://code.example.test/repo/commit) code.example.test`
    const heading = anchor('https://code.example.test/repo/commit', title)
    expect(
      filtered(
        source,
        heading + ' ' + anchor('http://code.example.test', 'code.example.test'),
        heading + ' code.example.test'
      )
    ).toBe(true)
  }
  const email = 'package@1.2.3'
  const source = `[${email}](https://registry.example.test/package) ${email}`
  const explicit = anchor('https://registry.example.test/package', email)
  expect(
    filtered(
      source,
      explicit + ' ' + email,
      explicit + ' ' + anchor('mailto:' + email, email)
    )
  ).toBe(true)
  expect(
    filtered(
      source,
      explicit + ' ' + email,
      email + ' ' + anchor('mailto:' + email, email)
    )
  ).toBe(false)
})

test('legacy email prefixes are excluded only when the valid email suffix still links', () => {
  const email = 'person@example.test'
  const source = 'email:' + email
  const before = anchor('mailto:' + source, source)
  expect(
    filtered(source, before, 'email:' + anchor('mailto:' + email, email))
  ).toBe(true)
  expect(filtered(source, before, source)).toBe(false)
  expect(
    filtered(
      source,
      before,
      'email:' + anchor('mailto:other@example.test', email)
    )
  ).toBe(false)
  expect(filtered(`[${source}](mailto:${source})`, before, source)).toBe(false)
})

test('opaque angle notation is protected locally rather than blocking other links', () => {
  const source = '`<README.md>` example.test'
  const code = '<code>&lt;README.md&gt;</code>'
  expect(
    filtered(
      source,
      code + ' ' + anchor('http://example.test', 'example.test'),
      code + ' example.test'
    )
  ).toBe(true)
  expect(
    filtered(
      '<README.md> <README.md>',
      '&lt;README.md&gt; &lt;README.md&gt;',
      anchor('https://readme.md', 'README.md') + ' &lt;README.md&gt;'
    )
  ).toBe(false)
  expect(
    filtered(
      '<README.md> <readme.md>',
      '&lt;README.md&gt; &lt;readme.md&gt;',
      anchor('https://readme.md', 'README.md') +
        ' ' +
        anchor('https://readme.md', 'readme.md')
    )
  ).toBe(true)
})

test('link policy accepts restored automatic URLs, email links and HTTPS completion', () => {
  for (const [source, destination] of [
    ['//trap.jp/path', 'https://trap.jp/path'],
    ['//README.md', 'https://readme.md'],
    ['//[::1]:8443/path', 'https://[::1]:8443/path'],
    ['https://trap.jp/path', 'https://trap.jp/path'],
    ['ftp://trap.jp/file', 'ftp://trap.jp/file'],
    ['contact@midorimu.si', 'mailto:contact@midorimu.si'],
    ['mailto:info@trap.jp', 'mailto:info@trap.jp']
  ]) {
    expect(filtered(source, source, anchor(destination, source)), source).toBe(
      true
    )
    expect(filtered(source, anchor(destination, source), source), source).toBe(
      false
    )
    expect(
      filtered(source, source, anchor('https://wrong.test', source)),
      source
    ).toBe(false)
  }
  expect(
    filtered(
      '//trap.jp //trap.jp',
      anchor('//trap.jp') + ' ' + anchor('//trap.jp'),
      anchor('https://trap.jp', '//trap.jp') + ' //trap.jp'
    )
  ).toBe(false)
  expect(
    filtered(
      '[//trap.jp](//trap.jp)',
      anchor('//trap.jp'),
      anchor('https://trap.jp', '//trap.jp')
    )
  ).toBe(false)
  expect(
    filtered(
      '`//trap.jp`',
      '<code>//trap.jp</code>',
      '<code>' + anchor('https://trap.jp', '//trap.jp') + '</code>'
    )
  ).toBe(false)
  for (const [source, before, after] of [
    [
      'foo//trap.jp',
      'foo//trap.jp',
      'foo' + anchor('https://trap.jp', '//trap.jp')
    ],
    ['xhttps://trap.jp', 'xhttps://trap.jp', 'x' + anchor('https://trap.jp')],
    [
      '@info@trap.jp',
      '@info@trap.jp',
      '@' + anchor('mailto:info@trap.jp', 'info@trap.jp')
    ],
    [
      '//trap.jp/path',
      '//trap.jp/path',
      anchor('https://trap.jp', '//trap.jp') + '/path'
    ]
  ])
    expect(filtered(source, before, after), source).toBe(false)
})

test('literal brackets are distinguished from explicit and reference link labels', () => {
  for (const source of [
    '[example.test]',
    '[unclosed example.test',
    '[example.test] text'
  ]) {
    const before = source.replace(
      'example.test',
      anchor('http://example.test', 'example.test')
    )
    expect(filtered(source, before, source)).toBe(true)
  }
  for (const source of [
    '[example.test](http://example.test)',
    '[example.test][ref]\n\n[ref]: http://example.test',
    '[example.test]\n\n[example.test]: http://example.test'
  ])
    expect(
      filtered(
        source,
        anchor('http://example.test', 'example.test'),
        'example.test'
      )
    ).toBe(false)
})

test('unrelated HTML parse errors do not suppress valid automatic anchors', () => {
  const prefix = '<p title="first" title="duplicate">'
  expect(
    filtered(
      'example.test',
      prefix + anchor('http://example.test', 'example.test') + '</p>',
      prefix + 'example.test</p>'
    )
  ).toBe(true)
  expect(
    filtered(
      'example.test',
      '<a href="http://example.test" href="http://wrong.test">example.test</a>',
      'example.test'
    )
  ).toBe(false)
})

test('domain delinking accepts ports without treating them as URI schemes', () => {
  for (const domain of [
    'node.internal:5873',
    'docs.example.test:8080/path?q=1#part',
    'README.md:443',
    'code.example.test/team/tool@latest',
    'registry.example.test/app@sha256:abc'
  ]) {
    expect(filtered(domain, anchor('http://' + domain, domain), domain)).toBe(
      true
    )
    expect(filtered(domain, anchor('http://wrong.test', domain), domain)).toBe(
      false
    )
  }
  expect(
    filtered(
      '<docs.example.test:443/path>',
      '&lt;docs.example.test:443/path&gt;',
      anchor('https://docs.example.test:443/path', 'docs.example.test:443/path')
    )
  ).toBe(false)
  expect(
    filtered(
      'node.internal:65536',
      anchor('http://node.internal:65536', 'node.internal:65536'),
      'node.internal:65536'
    )
  ).toBe(false)
})

test('literal delimiters elsewhere do not suppress link normalization outside opaque HTML', () => {
  const domain = 'code.example.test/team/tool.(*Command).run'
  const email = '/go/pkg/mod/code.example.test/tool@v1.3.0'
  const source = 'trace```\n' + domain + '\n' + email + '/file.go:42\n```'
  const before =
    '<p>trace```<br>\n' +
    anchor('http://' + domain, domain) +
    '<br>\n' +
    email +
    '/file.go:42</p>\n<pre><code></code></pre>\n'
  const after =
    '<p>trace```<br>\n' +
    domain +
    '<br>\n' +
    anchor('mailto:' + email, email) +
    '/file.go:42</p>\n<pre><code></code></pre>\n'
  expect(filtered(source, before, after)).toBe(true)
  const mask = differenceFilterMask({
    source,
    profile: 'inline',
    before: { kind: 'html', value: before },
    after: { kind: 'html', value: after.replace('<pre>', ' <pre>') }
  })
  expect(mask & differenceFilters.linkPolicy).toBe(0n)
  expect(mask & differenceFilters.whitespaceAndLinkPolicy).toBeTruthy()
  for (const [notation, opaque] of [
    ['`example.test`', '<code>example.test</code>'],
    ['```\nexample.test\n```', '<pre><code>example.test</code></pre>'],
    ['$example.test$', '<span class="katex">example.test</span>'],
    ['$$example.test$$', '<span class="katex-error">example.test</span>']
  ]) {
    expect(
      filtered(
        notation + ' example.test',
        opaque + ' ' + anchor('http://example.test', 'example.test'),
        opaque + ' example.test'
      )
    ).toBe(true)
    expect(
      filtered(
        notation,
        opaque.replace(
          'example.test',
          anchor('http://example.test', 'example.test')
        ),
        opaque
      )
    ).toBe(false)
  }
})

test('email-shaped package paths replace old domain links while retaining their required mail link', () => {
  const label = 'code.example.test/tool@v1.3.0'
  const before = anchor('http://' + label, label)
  expect(filtered(label, before, anchor('mailto:' + label, label))).toBe(true)
  expect(filtered(label, before, label)).toBe(false)
  expect(
    filtered(label, before, anchor('mailto:wrong@example.test', label))
  ).toBe(false)
})

test('raw HTML elsewhere does not block a separate automatic domain change', () => {
  const raw = '&lt;a href="/page"&gt;custom&lt;/a&gt;'
  expect(
    filtered(
      '<a href="/page">custom</a> example.test',
      raw + ' ' + anchor('http://example.test', 'example.test'),
      raw + ' example.test'
    )
  ).toBe(true)
  expect(
    filtered(
      '<a href="http://example.test">example.test</a>',
      anchor('http://example.test', 'example.test'),
      'example.test'
    )
  ).toBe(false)
  expect(
    filtered(
      'added <a> element\nexample.test',
      'added &lt;a&gt; element<br>\n' +
        anchor('http://example.test', 'example.test'),
      'added &lt;a&gt; element<br>\nexample.test'
    )
  ).toBe(true)
  const opening = '&lt;a href="https://short.example.test/redirect"&gt;'
  const closing = '&lt;/a&gt;'
  expect(
    filtered(
      '<a href="https://short.example.test/redirect">example.test</a>',
      opening + anchor('http://example.test', 'example.test') + closing,
      opening + 'example.test' + closing
    )
  ).toBe(true)
})

test('legacy reg-name domains and percent-encoded email local parts follow their final link policy', () => {
  const domain = 'server.preview~.example.test'
  expect(filtered(domain, anchor('http://' + domain, domain), domain)).toBe(
    true
  )
  expect(
    filtered(
      '<' + domain + '>',
      '&lt;' + domain + '&gt;',
      anchor('https://' + domain, domain)
    )
  ).toBe(false)
  for (const [email, href] of [
    ['{person@example.test', 'mailto:%7Bperson@example.test'],
    ['^person@example.test', 'mailto:%5Eperson@example.test']
  ]) {
    expect(filtered(email, email, anchor(href, email))).toBe(true)
    expect(
      filtered(email, email, anchor('mailto:wrong@example.test', email))
    ).toBe(false)
    expect(filtered(email, anchor(href, email), email)).toBe(false)
  }
})

test('legacy Punycode targets are checked exactly when non-URL text stops linking', () => {
  const domain = '文字６→example.test'
  expect(
    filtered(domain, anchor('http://' + toASCII(domain), domain), domain)
  ).toBe(true)
  expect(
    filtered(domain, anchor('http://wrong.example.test', domain), domain)
  ).toBe(false)
  const email = 'person@ex\u200bample.test'
  expect(
    filtered(
      email,
      anchor('mailto:person@' + toASCII('ex\u200bample.test'), email),
      email
    )
  ).toBe(true)
  expect(
    filtered(
      'person@example.test',
      anchor('mailto:person@example.test', 'person@example.test'),
      'person@example.test'
    )
  ).toBe(false)
})

test('automatic links inside escaped literal HTML attributes can disappear without exposing raw HTML links', () => {
  const source = '<a href="?filename=README.md">README.md</a>'
  const before =
    '&lt;a href="?' +
    anchor('http://filename=README.md', 'filename=README.md') +
    '"&gt;' +
    anchor('http://README.md', 'README.md') +
    '&lt;/a&gt;'
  const after = '&lt;a href="?filename=README.md"&gt;README.md&lt;/a&gt;'
  expect(filtered(source, before, after)).toBe(true)
  const sourceUrl = '<a href="https://example.test/page">custom</a>'
  const plain = '&lt;a href="https://example.test/page"&gt;custom&lt;/a&gt;'
  const linked =
    '&lt;a href="' +
    anchor('https://example.test/page') +
    '"&gt;custom&lt;/a&gt;'
  expect(filtered(sourceUrl, linked, plain)).toBe(true)
  expect(filtered(sourceUrl, plain, linked)).toBe(false)
  expect(
    filtered(
      '<a href="http://example.test">example.test</a>',
      anchor('http://example.test', 'example.test'),
      'example.test'
    )
  ).toBe(false)
})

test('unchanged links and literal HTML occurrences do not obstruct separate domain delinking', () => {
  const domain = 'README.md'
  const retained = anchor('https://readme.md', domain)
  const automatic = anchor('http://readme.md', domain)
  expect(
    filtered(
      `[${domain}](https://readme.md) ${domain}`,
      retained + ' ' + automatic,
      retained + ' ' + domain
    )
  ).toBe(true)
  // A retained link does not authorize dropping another explicit occurrence.
  expect(
    filtered(
      `[${domain}](https://readme.md) [${domain}](https://readme.md) ${domain}`,
      retained + ' ' + retained + ' ' + automatic,
      retained + ' ' + domain + ' ' + domain
    )
  ).toBe(false)
  const escaped = '&lt;a href="https://example.test/page"&gt;page&lt;/a&gt;'
  const linkedHtml =
    '&lt;a href="' + anchor('https://example.test/page') + '"&gt;page&lt;/a&gt;'
  expect(
    filtered(
      `${domain} <a href="https://example.test/page">page</a>`,
      automatic + ' ' + linkedHtml,
      domain + ' ' + linkedHtml
    )
  ).toBe(true)
  expect(
    filtered(
      `${domain} <a href="https://example.test/page">page</a>`,
      automatic + ' ' + linkedHtml,
      domain + ' ' + escaped
    )
  ).toBe(true)
  expect(
    filtered(
      `${domain} <a href="/new?filename=README.md">create</a>`,
      automatic +
        ' &lt;a href="/new?filename=' +
        automatic +
        '"&gt;create&lt;/a&gt;',
      domain + ' &lt;a href="/new?filename=README.md"&gt;create&lt;/a&gt;'
    )
  ).toBe(true)
})

test('delinked fuzzy domains restore the authored percent spelling exactly', () => {
  for (const source of [
    'example.test/search?q=%E6%97%A5%E6%9C%AC',
    'example.test/search?q=%e6%97%a5%e6%9c%ac'
  ]) {
    const label = 'example.test/search?q=日本'
    expect(filtered(source, anchor('http://' + source, label), source)).toBe(
      true
    )
    expect(
      filtered(source, anchor('http://wrong.test/search?q=日本', label), source)
    ).toBe(false)
    expect(
      filtered(source, anchor('http://' + source, label), source + 'changed')
    ).toBe(false)
    expect(
      filtered(
        '`' + source + '`',
        '<code>' + anchor('http://' + source, label) + '</code>',
        '<code>' + source + '</code>'
      )
    ).toBe(false)
  }
})

test('adding a bare email does not move identical existing angle email links', () => {
  const email = 'person@example.test'
  const link = anchor('mailto:' + email, email)
  expect(
    filtered(`<${email}>\n${email}`, link + ' ' + email, link + ' ' + link)
  ).toBe(true)
  expect(filtered(`<${email}>`, link, email)).toBe(false)
})

test('HTTPS completion also handles a scheme consumed as a stamp', () => {
  const url = '//example.test/page'
  const prefix = '<i>:https:</i>'
  expect(
    filtered(
      'https:' + url,
      prefix + anchor(url),
      prefix + anchor('https:' + url, url)
    )
  ).toBe(true)
  expect(
    filtered(
      'https:' + url,
      prefix + anchor(url),
      prefix + anchor('https://wrong.test/page', url)
    )
  ).toBe(false)
})

test('scheme-relative resource URLs acquire HTTPS resource labels and trailing cards', () => {
  for (const [url, label] of [
    [file, '添付ファイル'],
    [quote, '引用メッセージ']
  ]) {
    const source = url.replace('https:', '')
    expect(filtered(source, anchor(source), '', 'html', 'inline')).toBe(true)
    expect(
      filtered(
        '本文\n' + source,
        '<p>本文<br>\n' + anchor(source) + '</p>\n',
        '<p>本文</p>\n'
      )
    ).toBe(true)
    expect(
      filtered(
        '本文 ' + source + ' 続き',
        '本文 ' + anchor(source) + ' 続き',
        '本文 ' + anchor(url, `[[${label}]]`) + ' 続き',
        'html',
        'inline'
      )
    ).toBe(true)
    expect(filtered(source, source, `[${label}]`, 'text', 'plainText')).toBe(
      true
    )
    expect(filtered(source, anchor(source), source)).toBe(false)
    expect(
      filtered(
        'cf)' + source,
        '<p>cf)' + anchor(source) + '</p>\n',
        '<p>cf)</p>\n'
      )
    ).toBe(true)
    expect(
      filtered(
        '本文\n\n' + source,
        '<p>本文</p>\n<p>' + anchor(source) + '</p>\n',
        '<p>本文</p>\n<p></p>\n'
      )
    ).toBe(true)
    expect(
      filtered(
        '本文\n' + source,
        '<p>本文<br>\n' + anchor(source) + '</p>\n',
        '<p>変更後</p>\n'
      )
    ).toBe(false)
  }
})

test('HTTPS completion preserves decoded URL labels and encoded source notation', () => {
  for (const [source, label] of [
    ['//trap.jp/%E6%97%A5%E6%9C%AC?q=%2F', '//trap.jp/日本?q=%2F'],
    ['//xn--wgv71a119e.jp/%E6%97%A5%E6%9C%AC', '//日本語.jp/日本']
  ]) {
    expect(
      filtered(source, anchor(source, label), anchor('https:' + source, label))
    ).toBe(true)
    expect(
      filtered(
        source,
        anchor(source, label),
        anchor('https://wrong.test', label)
      )
    ).toBe(false)
  }
})

test('scheme URL resource-label and trailing-card changes remain visible', () => {
  expect(
    filtered(
      `${file} ${quote}`,
      '[添付ファイル] [引用メッセージ]',
      `${file} ${quote}`,
      'text',
      'plainText'
    )
  ).toBe(false)
  expect(
    filtered(
      `本文 ${file} 続き`,
      '本文 ' + anchor(file, '[[添付ファイル]]') + ' 続き',
      `本文 ${file} 続き`
    )
  ).toBe(false)
  for (const url of [file, quote]) {
    expect(
      filtered(`本文\n${url}`, '<p>本文</p>\n', `<p>本文<br>\n${url}</p>\n`)
    ).toBe(false)
    expect(
      filtered(`本文 ${url}`, '<p>本文 </p>\n', `<p>本文 ${url}</p>\n`)
    ).toBe(false)
    expect(
      filtered(
        `本文  \n${url}`,
        '<p>本文<br>\n</p>\n',
        `<p>本文<br>\n${url}</p>\n`
      )
    ).toBe(false)
    expect(
      filtered(`本文\n${url}`, '本文', `本文 ${url}`, 'html', 'inline')
    ).toBe(false)
    expect(filtered(url, '', `<p>${url}</p>\n`)).toBe(false)
  }
  expect(
    filtered(
      `本文\n${file}\n${quote}`,
      '<p>本文</p>\n',
      `<p>本文<br>\n${file}<br>\n${quote}</p>\n`
    )
  ).toBe(false)
  const external = file.replace(origin, 'https://external.test')
  expect(
    filtered(
      `本文 ${file} ${quote}`,
      `<p>本文 ${anchor(file)} </p>\n`,
      `<p>本文 ${file} ${quote}</p>\n`
    )
  ).toBe(false)
  expect(
    filtered(
      `本文\n${file}\n\n\n`,
      '<p>本文</p>\n',
      `<p>本文<br>\n${file}</p>\n<br>\n`
    )
  ).toBe(false)
  expect(
    filtered(
      `本文\n${file}`,
      '<p>本文</p>\n',
      `<p>本文<br>\n${file}</p>\n<br>\n`
    )
  ).toBe(false)
  expect(filtered(external, '', `<p>${external}</p>\n`)).toBe(false)
})

test('link policy retains explicit links, unrelated changes, opaque contexts and regressions', () => {
  for (const [source, before, after] of [
    [
      'info@trap.jp',
      anchor('mailto:info@trap.jp', 'info@trap.jp'),
      'info@trap.jp'
    ],
    [
      'mailto:info@trap.jp',
      anchor('mailto:info@trap.jp', 'mailto:info@trap.jp'),
      'mailto:info@trap.jp'
    ],
    ['https://trap.jp', anchor('https://trap.jp'), 'https://trap.jp'],
    ['ftp://trap.jp/file', anchor('ftp://trap.jp/file'), 'ftp://trap.jp/file'],
    [
      '[https://trap.jp](https://trap.jp)',
      anchor('https://trap.jp'),
      'https://trap.jp'
    ],
    ['<https://trap.jp>', anchor('https://trap.jp'), 'https://trap.jp'],
    [
      '<info@trap.jp>',
      anchor('mailto:info@trap.jp', 'info@trap.jp'),
      'info@trap.jp'
    ],
    [
      '`https://trap.jp`',
      '<code>' + anchor('https://trap.jp') + '</code>',
      '<code>https://trap.jp</code>'
    ],
    [
      'https://trap.jp',
      anchor('https://other.test', 'https://trap.jp'),
      'https://trap.jp'
    ],
    ['https://trap.jp', anchor('https://trap.jp', 'other'), 'https://trap.jp'],
    ['hello', anchor('http://hello', 'hello'), 'hello'],
    [
      `!{"type":"file","raw":"${file}"}`,
      anchor(file, '[[添付ファイル]]'),
      file
    ],
    [
      'https://trap.jp',
      '<a href="https://trap.jp" title="unexpected">https://trap.jp</a>',
      'https://trap.jp'
    ],
    [
      'https://trap.jp',
      anchor('https://trap.jp') + ' before',
      'https://trap.jp after'
    ],
    [
      '<README.md>',
      '&lt;README.md&gt;',
      anchor('http://readme.md', 'README.md')
    ],
    [
      '<README.md> <README.md>',
      '&lt;README.md&gt; &lt;README.md&gt;',
      anchor('https://readme.md', 'README.md') + ' &lt;README.md&gt;'
    ],
    [
      '<README.md>',
      '&lt;README.md&gt;',
      anchor('https://other.test', 'README.md')
    ]
  ])
    expect(filtered(source, before, after), source).toBe(false)
  for (const kind of ['error', 'text'] as const)
    expect(
      differenceFilterMask({
        ...fixtureRows[0],
        source: 'https://trap.jp',
        before: { kind: 'html', value: anchor('https://trap.jp') },
        after: { kind, value: 'https://trap.jp' }
      }) & differenceFilters.linkPolicy
    ).toBe(0n)
})

test('all 63 output filter combinations preserve every independently selected difference', () => {
  const url = 'bare.example'
  const after = `<a href="https://example.test/docs" title="page">!badge's</a>`
  const error = (value: string) =>
    `<span class="katex-error" title="${value}">${value}</span>`
  for (let required = 1; required < 64; required++) {
    let label = required & 2 ? "BADGE'S" : "badge's"
    if (required & 1) label = label.slice(0, 2) + ' ' + label.slice(2)
    if (required & 8) label = label.replace(/'/g, '&#039;')
    const opening =
      required & 8
        ? `<a title='page' href='https://example.test/docs'>`
        : '<a href="https://example.test/docs" title="page">'
    const image =
      required & 4
        ? `[!<a href="https://images.example.test/badge.svg">${label}</a>](${opening}https://example.test/docs</a>)`
        : `${opening}!${label}</a>`
    const mask = differenceFilterMask({
      source: url + ' ' + fixtureLinkedImage.source,
      before: {
        kind: 'html',
        value:
          (required & 32 ? anchor('http://' + url, url) : url) +
          image +
          error(required & 16 ? 'before' : 'after')
      },
      after: { kind: 'html', value: url + after + error('after') }
    })
    for (let selected = 1; selected < 64; selected++)
      expect(
        Boolean(mask & (1n << BigInt(selected - 1))),
        `required ${required}, selected ${selected}`
      ).toBe((required & selected) === required)
  }
})
