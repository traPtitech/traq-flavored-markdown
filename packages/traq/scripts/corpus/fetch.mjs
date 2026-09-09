// Read-only production sampling. Response bodies and credentials never enter logs.
import { createHash, createHmac, randomBytes } from "node:crypto";
import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { parseArgs, parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

export async function collect({
  baseUrl,
  token,
  output,
  maxMessages = 100000,
  maxChannels = 10000,
  channelOffset = 0,
  perChannel = 2000,
  delayMs = 300,
  until = new Date().toISOString(),
  fetchImpl = fetch,
  progress = () => {},
}) {
  const base = new URL(baseUrl);
  if (
    base.protocol !== "https:" &&
    !(
      base.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(base.hostname)
    )
  )
    throw new Error("HTTPS is required");
  if (base.username || base.password || base.search || base.hash)
    throw new Error(
      "Provide a base URL without credentials, query, or fragment",
    );
  base.pathname =
    base.pathname.replace(/\/$/, "").replace(/\/api\/v3$/, "") + "/api/v3/";
  if (!/^[\x21-\x7e]+$/.test(token))
    throw new Error("Invalid token file format");
  for (const n of [maxMessages, maxChannels, perChannel])
    if (!Number.isSafeInteger(n) || n <= 0)
      throw new Error("Sampling bounds must be positive integers");
  if (!Number.isSafeInteger(channelOffset) || channelOffset < 0)
    throw new Error("Invalid channel offset");
  if (
    !Number.isFinite(delayMs) ||
    delayMs < 0 ||
    !Number.isFinite(Date.parse(until))
  )
    throw new Error("Invalid delay or date");
  const salt = randomBytes(32);
  const anonymous = (id) =>
    createHmac("sha256", salt).update(id).digest("hex").slice(0, 24);
  const report = {
    format: 1,
    status: "running",
    fetchedAt: new Date().toISOString(),
    until,
    maxMessages,
    maxChannels,
    perChannel,
    requests: 0,
    sampledChannels: 0,
    inaccessibleChannels: 0,
    messages: 0,
    bytes: 0,
    lengths: {},
    contains: {},
    rawText: true,
  };
  const seen = new Set();
  async function get(relative) {
    const url = new URL(relative, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
      throw new Error("Request escaped API origin");
    for (let attempt = 0; attempt < 4; attempt++) {
      if (report.requests)
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      report.requests++;
      let response;
      try {
        response = await fetchImpl(url, {
          method: "GET",
          redirect: "error",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(20000),
        });
      } catch {
        if (attempt < 3) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * 2 ** attempt),
          );
          continue;
        }
        throw new Error(
          "API connection failed (credentials and response omitted)",
        );
      }
      if ([429, 502, 503, 504].includes(response.status) && attempt < 3) {
        const retry = Math.min(
          30000,
          Math.max(
            1000,
            Number(response.headers.get("retry-after") ?? 0) * 1000 ||
              1000 * 2 ** attempt,
          ),
        );
        await response.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, retry));
        continue;
      }
      if ([403, 404].includes(response.status)) {
        await response.body?.cancel();
        return null;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`API returned HTTP ${response.status} (body omitted)`);
      }
      try {
        return await response.json();
      } catch {
        throw new Error("API returned invalid JSON (body omitted)");
      }
    }
  }
  await mkdir(output, { recursive: true, mode: 0o700 });
  // Never overwrite an existing corpus on a rerun.
  const sink = await open(path.join(output, "messages.jsonl"), "wx", 0o600);
  try {
    const list = await get("channels?include-dm=false");
    if (!list || !Array.isArray(list.public))
      throw new Error("Could not read public channel list");
    // Stable hash order avoids selecting only the first tree branches; include archived channels.
    const channels = list.public
      .filter((c) => typeof c.id === "string")
      .map((c) => ({
        id: c.id,
        key: createHash("sha256").update(c.id).digest("hex"),
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(channelOffset, channelOffset + maxChannels);
    report.channelOffset = channelOffset;
    report.availableChannels = list.public.length;
    for (const channel of channels) {
      if (report.messages >= maxMessages) break;
      let offset = 0,
        sampled = 0;
      while (sampled < perChannel && report.messages < maxMessages) {
        const limit = Math.min(
          200,
          perChannel - sampled,
          maxMessages - report.messages,
        );
        const query = new URLSearchParams({
          limit: String(limit),
          offset: String(offset),
          until,
          order: "desc",
        });
        const messages = await get(
          `channels/${encodeURIComponent(channel.id)}/messages?${query}`,
        );
        if (messages === null) {
          report.inaccessibleChannels++;
          break;
        }
        if (!Array.isArray(messages))
          throw new Error("Invalid message response shape (body omitted)");
        for (const message of messages) {
          if (
            typeof message.id !== "string" ||
            typeof message.content !== "string"
          )
            throw new Error("Invalid message fields (body omitted)");
          if (seen.has(message.id)) continue;
          seen.add(message.id);
          const bytes = Buffer.byteLength(message.content);
          const bucket =
            bytes < 100
              ? "<100"
              : bytes < 1000
                ? "<1000"
                : bytes < 10000
                  ? "<10000"
                  : ">=10000";
          report.lengths[bucket] = (report.lengths[bucket] ?? 0) + 1;
          for (const [name, regex] of Object.entries({
            json: /!\{/,
            fence: /```|~~~/,
            math: /\$/,
            table: /\|.+\|/,
            reference: /^ {0,3}\[[^\]]+\]:/m,
            stamp: /:[\w@]/,
            url: /https?:\/\//,
            quote: /^ {0,3}>/m,
            list: /^\s*(?:[-+*]|\d+[.)]) /m,
          })) {
            if (regex.test(message.content))
              report.contains[name] = (report.contains[name] ?? 0) + 1;
          }
          await sink.write(
            JSON.stringify({
              id: anonymous(message.id),
              channel: anonymous(channel.id),
              source: message.content,
              syntaxVersion: 1,
            }) + "\n",
          );
          report.messages++;
          sampled++;
          report.bytes += bytes;
        }
        offset += messages.length;
        if (messages.length < limit) break;
      }
      report.sampledChannels++;
      if (report.sampledChannels % 10 === 0)
        progress({
          channels: report.sampledChannels,
          messages: report.messages,
          requests: report.requests,
        });
    }
    report.status = "complete";
    return report;
  } catch (error) {
    report.status = "failed";
    throw error;
  } finally {
    await sink.close();
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(report, null, 2) + "\n",
      { mode: 0o600 },
    );
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const { values } = parseArgs({
      options: {
        "env-file": { type: "string" },
        "base-url": { type: "string" },
        "token-file": { type: "string" },
        out: { type: "string" },
        "max-messages": { type: "string", default: "100000" },
        "max-channels": { type: "string", default: "10000" },
        "channel-offset": { type: "string", default: "0" },
        "per-channel": { type: "string", default: "2000" },
        until: { type: "string" },
      },
    });
    let config = {};
    if (values["env-file"]) {
      try {
        config = parseEnv(await readFile(values["env-file"], "utf8"));
      } catch {
        throw new Error("Could not read env file");
      }
    }
    const baseUrl = values["base-url"] ?? config.TRAQ_API_BASE_URL;
    if (!baseUrl || !(values["token-file"] || config.BOT_ACCESS_TOKEN))
      throw new Error(
        "API base URL and token file, or --env-file with TRAQ_API_BASE_URL/BOT_ACCESS_TOKEN, are required",
      );
    const privateRoot = fileURLToPath(
      new URL("../../.private/corpora/", import.meta.url),
    );
    const output = path.resolve(
      values.out ??
        path.join(
          privateRoot,
          new Date().toISOString().replaceAll(/[:.]/g, "-"),
        ),
    );
    const relative = path.relative(privateRoot, output);
    if (relative.startsWith("..") || path.isAbsolute(relative))
      throw new Error("Corpus output must stay inside .private/corpora");
    let token;
    try {
      token = values["token-file"]
        ? (await readFile(values["token-file"], "utf8")).trim()
        : config.BOT_ACCESS_TOKEN.trim();
    } catch {
      throw new Error("Could not read token file");
    }
    const report = await collect({
      baseUrl,
      token,
      output,
      maxMessages: Number(values["max-messages"]),
      maxChannels: Number(values["max-channels"]),
      channelOffset: Number(values["channel-offset"]),
      perChannel: Number(values["per-channel"]),
      ...(values.until && { until: values.until }),
      progress: (value) => console.log(JSON.stringify(value)),
    });
    console.log(JSON.stringify({ output, ...report }, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
