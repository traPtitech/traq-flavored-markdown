"use strict";
const meta = JSON.parse(document.getElementById("metadata").textContent),
  payload = JSON.parse(document.getElementById("payload").textContent);
document.getElementById("metadata").remove();
document.getElementById("payload").remove();
const labels = {
  render: "traQ_S-UI · 通常",
  inline: "traQ_S-UI · インライン",
  notification: "traQ · 通知",
};
const el = (id) => document.getElementById(id),
  num = (n) => Number(n).toLocaleString("ja-JP");
let outputView = "rendered";
const viewSelect = document.createElement("select");
viewSelect.id = "output-view";
viewSelect.setAttribute("aria-label", "表示形式");
for (const [value, label] of [
  ["rendered", "レンダリング"],
  ["raw", "HTML / テキスト差分"],
]) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  viewSelect.append(option);
}
el("modes").after(viewSelect);
viewSelect.onchange = () => {
  outputView = viewSelect.value;
  show();
};
let mode = "render",
  page = 1,
  hits = null,
  generation = 0,
  filterGeneration = 0;
const cache = new Map();
el("overview").textContent =
  `${num(meta.messages)} 件を比較 · 差分のある結果のみ · 1ページ 50件 · 単独ファイルでオフライン閲覧`;
for (const key of Object.keys(labels)) {
  const b = document.createElement("button");
  b.textContent = labels[key] + "  " + num(meta.counts[key]);
  b.dataset.mode = key;
  b.addEventListener("click", () => {
    mode = key;
    page = 1;
    hits = null;
    el("search").value = "";
    generation++;
    applyFilters();
  });
  el("modes").append(b);
}
const allowed = new Set(
  "p div span pre code br hr strong b em i del s ins mark sub sup a ul ol li blockquote h1 h2 h3 h4 h5 h6 table thead tbody tr td th cite svg path line".split(
    " ",
  ),
);
const styleNames = [
  "height",
  "width",
  "min-width",
  "vertical-align",
  "margin-right",
  "margin-left",
  "top",
  "background-color",
  "text-align",
];
function renderHTML(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const copy = (node) => {
    if (node.nodeType === 3) return document.createTextNode(node.data);
    if (node.nodeType !== 1) return document.createTextNode("");
    if (node.localName === "img") {
      const span = document.createElement("span");
      span.className = "r-image";
      span.textContent =
        "[画像: " + (node.getAttribute("alt") || "外部画像") + "]";
      return span;
    }
    if (!allowed.has(node.localName)) return document.createTextNode("");
    const name = node.localName === "a" ? "span" : node.localName;
    const value = ["svg", "path", "line"].includes(name)
      ? document.createElementNS("http://www.w3.org/2000/svg", name)
      : document.createElement(name);
    for (const attr of [
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
    ])
      if (node.hasAttribute(attr))
        value.setAttribute(attr, node.getAttribute(attr));
    for (const key of styleNames) {
      const text = node.style.getPropertyValue(key);
      if (text && !/url|var\(|attr\(/i.test(text))
        value.style.setProperty(key, text);
    }
    if (node.localName === "a") {
      value.classList.add("r-link");
      value.title = node.getAttribute("href") || "リンク";
    }
    for (const child of node.childNodes) value.append(copy(child));
    return value;
  };
  const result = document.createDocumentFragment();
  for (const child of template.content.childNodes) result.append(copy(child));
  return result;
}
async function load(m, index) {
  const key = m + ":" + index;
  if (cache.has(key)) return cache.get(key);
  const bytes = Uint8Array.from(atob(payload[m][index]), (c) =>
    c.charCodeAt(0),
  );
  const text = await new Response(
    new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")),
  ).text();
  const rows = JSON.parse(text);
  cache.set(key, rows);
  if (cache.size > 4) cache.delete(cache.keys().next().value);
  return rows;
}

function highlightedPair(before, after) {
  let parts,
    coarse = false;
  // ponytail: bound character diff cost; large outputs retain exact text with coarser changed ranges.
  if (before.length + after.length <= 12000)
    parts = CorpusDiff.diffStringsRaw(before, after, true);
  else {
    coarse = true;
    let start = 0,
      end = 0;
    while (
      start < Math.min(before.length, after.length) &&
      before[start] === after[start]
    )
      start++;
    while (
      end < Math.min(before.length, after.length) - start &&
      before[before.length - end - 1] === after[after.length - end - 1]
    )
      end++;
    parts = [
      [0, before.slice(0, start)],
      [-1, before.slice(start, before.length - end)],
      [1, after.slice(start, after.length - end)],
      [0, before.slice(before.length - end)],
    ];
  }
  const sides = [document.createElement("pre"), document.createElement("pre")];
  for (const side of sides) {
    side.className = "cell-content raw-html";
    if (coarse)
      side.title =
        "長い出力のため、共通の先頭・末尾を除いた変更範囲をまとめて強調しています。文字列は省略していません。";
  }
  for (const part of parts) {
    const op = part[0],
      value = part[1];
    if (!value) continue;
    for (let i = 0; i < 2; i++) {
      if (op === (i === 0 ? 1 : -1)) continue;
      const node = document.createElement(op === 0 ? "span" : "mark");
      if (op) node.className = op === -1 ? "diff-removed" : "diff-added";
      node.textContent = value;
      sides[i].append(node);
    }
  }
  return sides;
}
function cell(row, text, isSource) {
  const td = document.createElement("td");
  if (isSource) {
    const label = document.createElement("div");
    label.className = "case-label";
    label.append("#" + num(row.index + 1));
    const expand = document.createElement("button");
    expand.className = "expand";
    expand.textContent = "展開";
    expand.addEventListener("click", () => {
      const tr = td.parentElement;
      const open = tr.classList.toggle("expanded");
      expand.textContent = open ? "折りたたむ" : "展開";
    });
    label.append(expand);
    td.append(label);
  }
  const box = document.createElement(
    isSource || mode === "notification" || text.startsWith("解析エラー:")
      ? "pre"
      : "div",
  );
  box.className =
    "cell-content " +
    (isSource
      ? "source"
      : mode === "notification"
        ? "notification"
        : "markdown-body");
  if (box.tagName === "PRE") box.textContent = text;
  else box.append(renderHTML(text));
  td.append(box);
  return td;
}
async function show() {
  const token = ++generation;
  const total = hits === null ? meta.counts[mode] : hits.length;
  const pages = Math.max(1, Math.ceil(total / 50));
  page = Math.min(Math.max(1, page), pages);
  el("page").value = page;
  el("page").max = pages;
  el("pages").textContent = num(pages);
  el("previous").disabled = page <= 1;
  el("next").disabled = page >= pages;
  el("status").textContent =
    num(total) +
    " 件" +
    (hits === null ? "" : " / 全 " + num(meta.counts[mode]) + " 件");
  for (const b of el("modes").children)
    b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
  let rows = [];
  if (total) {
    if (hits === null) rows = await load(mode, page - 1);
    else
      for (const [chunk, index] of hits.slice((page - 1) * 50, page * 50))
        rows.push((await load(mode, chunk))[index]);
  }
  if (token !== generation) return;
  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.append(cell(row, row.source, true));
    if (outputView === "raw") {
      for (const box of highlightedPair(row.before, row.after)) {
        const td = document.createElement("td");
        td.append(box);
        tr.append(td);
      }
    } else tr.append(cell(row, row.before, false), cell(row, row.after, false));
    fragment.append(tr);
  }
  el("rows").replaceChildren(fragment);
  el("empty").hidden = total !== 0;
}
el("previous").onclick = () => {
  page--;
  show();
  scrollTo({ top: 0 });
};
el("next").onclick = () => {
  page++;
  show();
  scrollTo({ top: 0 });
};
el("page").onchange = () => {
  page = Number(el("page").value) || 1;
  show();
  scrollTo({ top: 0 });
};
const filtersBar = document.createElement("div");
filtersBar.className = "filters";
const filterInputs = {};
for (const [id, label, title] of [
  [
    "whitespace",
    "ホワイトスペースのみを除外",
    "HTML・通知の文字列から半角スペース、タブ、改行、フォームフィードを除いて一致する結果を非表示にします。コードや属性値内の空白も対象です。",
  ],
]) {
  const labelNode = document.createElement("label"),
    input = document.createElement("input");
  input.type = "checkbox";
  input.id = "ignore-" + id;
  input.onchange = () => applyFilters();
  labelNode.title = title;
  labelNode.append(input, document.createTextNode(label));
  filtersBar.append(labelNode);
  filterInputs[id] = input;
}
document.querySelector(".toolbar").after(filtersBar);
async function applyFilters() {
  const token = ++filterGeneration,
    selectedMode = mode,
    q = el("search").value.trim().toLowerCase(),
    bit = filterInputs.whitespace.checked ? 1 : 0;
  page = 1;
  if (!q && !bit) {
    hits = null;
    return show();
  }
  const flags = meta.filters[selectedMode],
    found = [];
  for (let chunk = 0; chunk < payload[selectedMode].length; chunk++) {
    const rows = q ? await load(selectedMode, chunk) : null;
    if (token !== filterGeneration) return;
    const length = Math.min(50, meta.counts[selectedMode] - chunk * 50);
    for (let j = 0; j < length; j++) {
      if (bit && (flags.charCodeAt(chunk * 50 + j) - 48) & bit) continue;
      if (!q || rows[j].source.toLowerCase().includes(q))
        found.push([chunk, j]);
    }
    if (q)
      el("status").textContent =
        "検索 " + num(chunk + 1) + " / " + num(payload[selectedMode].length);
  }
  hits = found.length === meta.counts[selectedMode] ? null : found;
  return show();
}
el("search-form").onsubmit = (e) => {
  e.preventDefault();
  applyFilters();
};
const table = document.createElement("table");
const head = document.createElement("tr");
for (const name of [
  "表示",
  "平均 before / after (µs)",
  "中央値 before / after (µs)",
  "p95 before / after (µs)",
  "after / before",
]) {
  const th = document.createElement("th");
  th.textContent = name;
  head.append(th);
}
table.append(head);
const f = (n) =>
  Number(n).toLocaleString("ja-JP", { maximumFractionDigits: 2 });
for (const key of Object.keys(labels)) {
  const data = key === "notification" ? meta.traq : meta.sui.modes[key],
    tr = document.createElement("tr");
  for (const text of [
    labels[key],
    f(data.before.meanUs) + " / " + f(data.after.meanUs),
    f(data.before.p50Us) + " / " + f(data.after.p50Us),
    f(data.before.p95Us) + " / " + f(data.after.p95Us),
    f(data.after.meanUs / data.before.meanUs) + " 倍",
  ]) {
    const td = document.createElement("td");
    td.textContent = text;
    tr.append(td);
  }
  table.append(tr);
}
el("speed").append(table);
for (const text of [
  "同一入力・200件のウォームアップ後に計測。before / after の実行順は交互。収集・ファイル出力・画面表示の時間は含みません。" +
    "各モードを順に実行した際の参考値です。",
  "初期化: S-UI before " +
    f(meta.sui.beforeInitializationMs) +
    " ms / after " +
    f(meta.sui.afterInitializationMs) +
    " ms、traQ Rust " +
    f(meta.traq.afterInitializationMs) +
    " ms。モジュール読込は除きます。",
  "S-UI は同一の固定 Store を使用。traQ は master の Parse と Rust PlainTextRenderer が返す通知テキストを比較。参考値です。",
]) {
  const p = document.createElement("p");
  p.textContent = text;
  el("speed").append(p);
}
el("footer").textContent =
  "生成 " +
  new Date(meta.generated).toLocaleString("ja-JP") +
  " · master: S-UI " +
  meta.revisions.suiMaster.slice(0, 10) +
  " / traQ " +
  meta.revisions.traqMaster.slice(0, 10) +
  " · after: renderer " +
  meta.revisions.renderer.slice(0, 10) +
  " / SDK " +
  meta.revisions.processor.slice(0, 10) +
  " · 外部画像はプレースホルダー表示。リンク・スクリプトは実行しません。";
show().catch(() => {
  el("status").textContent =
    "読込に失敗しました。新しい Chrome / Edge で開いてください。";
});
