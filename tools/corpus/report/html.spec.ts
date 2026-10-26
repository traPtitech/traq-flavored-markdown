import { expect, test } from 'bun:test'

import { normalizeHtmlSerialization as normalize } from './html.ts'

test('HTML spelling normalization decodes once and sorts parsed attributes', () => {
  for (const [before, after] of [
    [
      `<span title='a&#039;b' class='error'>a&#39;b</span>`,
      `<span class="error" title="a'b">a'b</span>`
    ],
    ['<p>&#x3C;&amp;&quot;&#x1f600;</p>', '<p>&lt;&#38;"😀</p>'],
    ['<p>&nbsp;&copy;</p>', '<p>\u00a0©</p>'],
    ['<p title="&quot;&lt;&amp;">x</p>', `<p title='"<&amp;'>x</p>`],
    ['<a href=/page title=hello>x</a>', '<a title="hello" href="/page">x</a>'],
    ['<input disabled="" title="x" />', '<input title=x disabled>'],
    [
      '<svg><use xlink:href="/a" id="x"/></svg>',
      '<svg><use id="x" xlink:href="/a" /></svg>'
    ],
    [
      '<template><p title=x id=y>&#39;</p></template>',
      `<template><p id="y" title="x">'</p></template>`
    ],
    ['<pre><code>&#039;&lt;</code></pre>', `<pre><code>'&lt;</code></pre>`],
    ['<textarea>a&amp;b</textarea>', '<textarea>a&#38;b</textarea>']
  ]) {
    expect(normalize(before)).toBeDefined()
    expect(normalize(before)).toBe(normalize(after))
  }
})

test('HTML spelling normalization retains text, attributes, raw text and source structure', () => {
  for (const [before, after] of [
    ['<p>a b</p>', '<p>ab</p>'],
    ['<p>a  b</p>', '<p>a b</p>'],
    ['<p>&nbsp;</p>', '<p> </p>'],
    ['<p>&amp;lt;</p>', '<p>&lt;</p>'],
    ['<p title="&amp;quot;">x</p>', '<p title="&quot;">x</p>'],
    ['<a href="/before">x</a>', '<a href="/after">x</a>'],
    ['<i style="color:red">x</i>', '<i style="color:blue">x</i>'],
    ['<i class="a b">x</i>', '<i class="b a">x</i>'],
    ['<p><strong>x</strong></p>', '<p>x</p>'],
    ['<ul><li>a</li><li>b</li></ul>', '<ul><li>b</li><li>a</li></ul>'],
    ['<p>a<br>b</p>', '<p>a\nb</p>'],
    ['<p>a</p><p>b</p>', '<p>a<p>b'],
    ['<pre>\nx</pre>', '<pre>x</pre>'],
    ['<textarea>\nx</textarea>', '<textarea>x</textarea>'],
    ['<listing>\nx</listing>', '<listing>x</listing>'],
    ['<script>&amp;</script>', '<script>&</script>'],
    ['<style>&amp;</style>', '<style>&</style>'],
    ['<p>x<!-- &amp; --></p>', '<p>x<!-- & --></p>'],
    ['<svg><path/><circle/></svg>', '<svg><path><circle/></svg>'],
    [
      '<svg><text><![CDATA[&amp;]]></text></svg>',
      '<svg><text><![CDATA[&]]></text></svg>'
    ]
  ]) {
    expect(normalize(before)).toBeDefined()
    expect(normalize(before)).not.toBe(normalize(after))
  }
})

test('malformed HTML, duplicate attributes and parser-inserted elements remain unnormalized', () => {
  for (const source of [
    '<p title="first" title="second">x</p>',
    '<p title="unclosed>x</p>',
    '<p>&#0;</p>',
    '<a href="/outer"><a href="/inner">x</a></a>',
    '<div/>',
    '<table><tr><td>x</td></tr></table>'
  ])
    expect(normalize(source)).toBeUndefined()
})
