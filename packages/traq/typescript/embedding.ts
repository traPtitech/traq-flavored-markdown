import type {
  EmbeddingPlan,
  LookupKind,
  References,
} from "./generated/processing.js";

/** Resolves Rust's ordered AST-derived candidates and preserves all other source bytes. */
export function embedReferences(
  source: string,
  plan: EmbeddingPlan,
  resolve: (kind: LookupKind, name: string) => string | undefined,
): string {
  const bytes = new TextEncoder().encode(source);
  const decoder = new TextDecoder("utf-8", { fatal: true });

  let position = 0;
  let result = "";

  for (const candidate of plan.candidates) {
    const { start, end, raw, kind, name } = candidate;

    if (start < position) {
      continue;
    }

    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end <= start ||
      end > bytes.length ||
      decoder.decode(bytes.subarray(start, end)) !== raw
    ) {
      throw new Error("Embedding plan does not match source");
    }

    const id = resolve(kind, name);
    if (!id) {
      continue;
    }

    result += decoder.decode(bytes.subarray(position, start));
    result += "!" + JSON.stringify({ type: kind, raw, id });
    position = end;
  }

  return result + decoder.decode(bytes.subarray(position));
}

/** Uses parsed references, including those inside spoilers but excluding code/math. */
export function mentionsUser(
  references: References,
  userId: string,
  groupIds: readonly string[],
): boolean {
  return (
    references.mentions.includes(userId) ||
    references.groupMentions.some((id) => groupIds.includes(id))
  );
}
