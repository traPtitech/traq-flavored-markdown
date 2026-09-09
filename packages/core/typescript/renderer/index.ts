import type {
    Node,
    Document,
    Preset,
    Renderer,
    RenderContext,
} from "./types.js";
import { configuration } from "./preset.js";
import { escapeHtml } from "./html.js";

export type {
    Node,
    Document,
    Preset,
    Renderer,
    RenderContext,
    Handler,
    Fallback,
} from "./types.js";

export { Plugin } from "./plugin.js";
export { PresetBuilder } from "./preset.js";

export function renderer(preset: Preset): Renderer {
    const { handlers, fallback: renderFallback } = configuration(preset);

    function render(document: Document) {
        let bytes: Uint8Array | undefined;

        const fallback = (node: Node) => {
            bytes ??= new TextEncoder().encode(document.source);
            const text = escapeHtml(
                new TextDecoder().decode(
                    bytes.subarray(node.span.start, node.span.end),
                ),
            );

            const output = renderFallback(text);
            if (typeof output !== "string")
                throw new TypeError(
                    "Render fallback must return an HTML string",
                );

            return output;
        };

        function nodes(
            values: Node[] = [],
            ancestors: readonly Node[] = [],
        ): string {
            return values
                .map((node) => {
                    const handler = handlers.get(node.kind);

                    if (!handler) return fallback(node);

                    const parents = [...ancestors, node];
                    const context: RenderContext = {
                        source: document.source,
                        ancestors,
                        escape: escapeHtml,
                        render: (values) => nodes(values, parents),
                        fallback,
                    };

                    const output = handler(node, context);

                    if (typeof output !== "string")
                        throw new TypeError(
                            "Render handlers must return HTML strings",
                        );

                    return output;
                })
                .join("");
        }

        return nodes(document.children);
    }

    return Object.freeze({ render });
}
