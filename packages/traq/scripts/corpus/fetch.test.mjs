import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { collect } from "./fetch.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "traq-corpus-check-"));
try {
  const calls = [],
    logs = [];
  const fetchImpl = async (url, options) => {
    calls.push(String(url));
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    if (url.pathname.endsWith("/channels"))
      return Response.json({
        public: [{ id: "channel-a" }],
        dm: [{ id: "private-dm" }],
      });
    assert(!String(url).includes("private-dm"));
    assert.equal(url.searchParams.get("limit"), "2");
    return Response.json([
      { id: "a", userId: "author", content: "**private text**" },
      { id: "b", content: "`code`" },
    ]);
  };
  const result = await collect({
    baseUrl: "https://traq.example/",
    token: "test-token",
    output: directory,
    maxMessages: 2,
    perChannel: 5,
    delayMs: 0,
    fetchImpl,
    progress: (x) => logs.push(x),
  });
  assert.equal(result.messages, 2);
  assert.equal(calls.length, 2);
  const saved = (await readFile(path.join(directory, "messages.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.equal(saved[0].source, "**private text**");
  assert.notEqual(saved[0].id, "a");
  assert.equal(saved[0].userId, undefined);
  assert(!JSON.stringify(result).includes("private text"));
  assert(!JSON.stringify(logs).includes("test-token"));
  await assert.rejects(
    collect({
      baseUrl: "https://traq.example/",
      token: "test-token",
      output: directory,
      fetchImpl,
    }),
    { code: "EEXIST" },
  );
  console.log(
    "PASS read-only sampling, bounds, credential handling, raw local corpus, no overwrite",
  );
} finally {
  await rm(directory, { recursive: true });
}
