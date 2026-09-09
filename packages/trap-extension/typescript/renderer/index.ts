import { names, isKnownNode } from "@traq-markdown-parser/trap-extension/nodes";
import { checked, escapeHtml } from "@traq-markdown-parser/core/html";
import { Plugin as Declaration } from "@traq-markdown-parser/core/definitions";
import { Plugin } from "@traq-markdown-parser/core/renderer";
import { validateLink as defaultPolicy } from "@traq-markdown-parser/commonmark/policy";
import { renderReference } from "./reference.js";
import { stampRenderer } from "./stamp.js";
import type { Options } from "./types.js";

export type { Options, Store } from "./types.js";

const declaration = Declaration.group("trap").new("presentation");

export function plugin({
  store,
  baseUrl,
  validateLink = defaultPolicy,
}: Options = {}) {
  const result = new Plugin(declaration);

  result.on(
    names.Reference,
    checked(names.Reference, isKnownNode, (node) =>
      renderReference(node, store, validateLink),
    ),
  );

  result.on(
    names.Spoiler,
    checked(
      names.Spoiler,
      isKnownNode,
      (n, ctx) => '<span class="spoiler">' + ctx.render(n.children) + "</span>",
    ),
  );

  result.on(
    names.BlankLine,
    checked(names.BlankLine, isKnownNode, () => "<br>\n"),
  );

  result.on(
    names.Embedding,
    checked(names.Embedding, isKnownNode, (node) => escapeHtml(node.data.literal)),
  );

  const stamp = stampRenderer({ store, baseUrl });

  result.on(
    names.Stamp,
    checked(names.Stamp, isKnownNode, (node) => stamp(node.data.literal)),
  );

  return result;
}
