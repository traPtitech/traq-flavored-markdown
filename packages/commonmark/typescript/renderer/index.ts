import type { Options } from "./options.js";

import { names } from "@traq-markdown-parser/commonmark/nodes";
import { Plugin as Declaration } from "@traq-markdown-parser/core/definitions";
import { Plugin } from "@traq-markdown-parser/core/renderer";
import { PresetBuilder } from "@traq-markdown-parser/core/renderer";
import { registerBlockHandlers } from "./block.js";
import { registerInlineHandlers } from "./inline.js";
import { validateLink as defaultPolicy } from "./policy.js";

export type { Options } from "./options.js";

const declaration = Declaration.group("commonmark").new("core");

export { names as nodes };

export function plugin({
    validateLink = defaultPolicy,
    validateImage = validateLink,
    breaks = false,
    highlight,
    linkAttributes = {},
}: Options = {}) {
    const result = new Plugin(declaration);

    registerInlineHandlers(result, {
        validateLink,
        validateImage,
        breaks,
        linkAttributes,
    });

    registerBlockHandlers(result, { highlight });

    return result;
}

export const html = Object.freeze({ plugin });

export function preset(options?: Options) {
    return new PresetBuilder().add(plugin(options)).build();
}
