import { readLines } from "./read-lines.mjs";
import { createWriteStream } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { once } from "node:events";
import { pathToFileURL, fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import path from "node:path";
const { values } = parseArgs({
  options: {
    corpus: { type: "string" },
    out: { type: "string" },
    max: { type: "string", default: "100000" },
    baseline: { type: "string" },
    origin: { type: "string" },
  },
});
if (!values.corpus || !values.out)
  throw new Error("--corpus and --out are required");
const baselineRequire = createRequire(
  path.resolve(values.baseline, "package.json"),
);
const { traQMarkdownIt } = baselineRequire("@traptitech/traq-markdown-it");
const sdkPath = fileURLToPath(new URL("../../", import.meta.url));
const frontendPath = sdkPath;
const { createRuntime, presets } = await import(
  pathToFileURL(sdkPath + "/dist/index.js")
);
const { messageRenderers } = await import(
  pathToFileURL(frontendPath + "/dist/renderer/index.js")
);
const origin = values.origin;
const store = {
  getMe: () => ({ id: "viewer" }),
  getUser: () => undefined,
  getChannel: (id) => ({ id }),
  getUserGroup: () => undefined,
  getStampByName: (name) => ({ name, fileId: "stamp" }),
  getUserByName: () => ({ iconFileId: "icon" }),
  generateUserHref: (id) => "#u-" + encodeURIComponent(id),
  generateUserGroupHref: (id) => "#g-" + encodeURIComponent(id),
  generateChannelHref: (id) => "#c-" + encodeURIComponent(id),
  generateStampHref: (id) => "/api/v3/files/" + encodeURIComponent(id),
};
let start = performance.now();
const baseline = new traQMarkdownIt(store, [], origin);
const beforeInitializationMs = performance.now() - start;
const bytes = await readFile(sdkPath + "/dist/parser.wasm");
start = performance.now();
const runtime = await createRuntime(bytes),
  parser = runtime.createParser(presets.traq.v1),
  view = messageRenderers({ origin, store, validateImage: () => false });
const afterInitializationMs = performance.now() - start;
const profiles = [
  {
    mode: "render",
    before: (s) => baseline.render(s),
    after: (s) => view.standard.render(parser.parse(s)),
  },
  {
    mode: "inline",
    before: (s) => baseline.renderInline(s),
    after: (s) => view.condensed.render(parser.parse(s)),
  },
];
const timings = Object.fromEntries(
  profiles.map((p) => [p.mode, { before: [], after: [] }]),
);
const report = {
  execution: "standalone",
  messages: 0,
  modes: Object.fromEntries(
    profiles.map((p) => [
      p.mode,
      {
        differences: 0,
        embeddingDifferences: 0,
        beforeErrors: 0,
        afterErrors: 0,
      },
    ]),
  ),
  beforeInitializationMs,
  afterInitializationMs,
  warnings: 0,
  timed:
    "Parse + render; 200 warmups; alternating before/after order; I/O excluded; same deterministic Store",
};
const logger = console.warn;
console.warn = () => report.warnings++;
const lines = () => readLines(values.corpus);
const execute = (f) => {
  const start = performance.now();
  try {
    const value = f(),
      ms = performance.now() - start;
    return {
      html: value.renderedText,
      embeddings: value.embeddings,
      ms,
      error: false,
    };
  } catch (e) {
    return {
      html: "解析エラー: " + (e.cause ? JSON.stringify(e.cause) : e.name),
      ms: performance.now() - start,
      error: true,
    };
  }
};
function summary(a) {
  a.sort((x, y) => x - y);
  const total = a.reduce((s, n) => s + n, 0);
  const q = (p) => (a[Math.floor((a.length - 1) * p)] ?? 0) * 1000;
  return {
    calls: a.length,
    totalMs: total,
    meanUs: (total / Math.max(a.length, 1)) * 1000,
    p50Us: q(0.5),
    p95Us: q(0.95),
    p99Us: q(0.99),
  };
}
await mkdir(values.out, { recursive: true });
const output = createWriteStream(
  path.join(values.out, "sui-differences.jsonl"),
);
const embeddingOutput = createWriteStream(
  path.join(values.out, "sui-embedding-differences.jsonl"),
);
const started = performance.now();
try {
  let n = 0;
  for await (const line of lines()) {
    if (!line) continue;
    const { source } = JSON.parse(line);
    for (const p of profiles) {
      execute(() => p.before(source));
      execute(() => p.after(source));
    }
    if (++n >= 200) break;
  }
  for await (const line of lines()) {
    if (!line) continue;
    if (values.max && report.messages >= Number(values.max)) break;
    const { source } = JSON.parse(line);
    for (const p of profiles) {
      let a, b;
      if (report.messages % 2 === 0) {
        a = execute(() => p.before(source));
        b = execute(() => p.after(source));
      } else {
        b = execute(() => p.after(source));
        a = execute(() => p.before(source));
      }
      timings[p.mode].before.push(a.ms);
      timings[p.mode].after.push(b.ms);
      const stats = report.modes[p.mode];
      stats.beforeErrors += Number(a.error);
      stats.afterErrors += Number(b.error);
      if (
        !a.error &&
        !b.error &&
        JSON.stringify(a.embeddings) !== JSON.stringify(b.embeddings)
      ) {
        stats.embeddingDifferences++;
        if (
          !embeddingOutput.write(
            JSON.stringify({
              index: report.messages,
              mode: p.mode,
              source,
              before: a.embeddings,
              after: b.embeddings,
            }) + "\n",
          )
        )
          await once(embeddingOutput, "drain");
      }
      if (a.html !== b.html || a.error !== b.error) {
        stats.differences++;
        if (
          !output.write(
            JSON.stringify({
              index: report.messages,
              mode: p.mode,
              source,
              before: a.html,
              after: b.html,
              error: a.error || b.error,
            }) + "\n",
          )
        )
          await once(output, "drain");
      }
    }
    report.messages++;
    if (report.messages % 10000 === 0)
      console.log(
        JSON.stringify({ processed: report.messages, modes: report.modes }),
      );
  }
  embeddingOutput.end();
  await once(embeddingOutput, "finish");
  output.end();
  await once(output, "finish");
  report.wallSeconds = (performance.now() - started) / 1000;
  for (const p of profiles)
    Object.assign(report.modes[p.mode], {
      before: summary(timings[p.mode].before),
      after: summary(timings[p.mode].after),
    });
  await writeFile(
    path.join(values.out, "sui-summary.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  console.warn = logger;
  runtime.dispose();
}
