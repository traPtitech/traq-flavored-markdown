import type { ExtractorOptions, Extraction } from "./generated/processing.js";
export type {
    ExtractorOptions,
    Extraction,
    References,
    EmbeddedInfo,
    EmbeddingPlan,
    EmbeddingCandidate,
    LookupKind,
} from "./generated/processing.js";
import { buildId, inputBytes } from "./generated/artifact.js";
import type { Document } from "./generated/nodes.js";
export type { Preset } from "./generated/presets.js";
export { presets } from "./generated/presets.js";
export { isKnownNode } from "./generated/nodes.js";
export type {
    Document,
    Node,
    NodeKind,
    ParseError,
} from "./generated/nodes.js";

interface Wasm extends WebAssembly.Exports {
    memory: WebAssembly.Memory;
    input_ptr(length: number): number;
    output_ptr(): number;
    configure(): number;
    configure_extractor(): number;
    extract(): number;
    parse(mode: number): number;
}
export interface Parser {
    parse(source: string): Document;
    parseInline(source: string): Document;
    dispose(): void;
}

export interface Extractor {
    extract(document: Document): Extraction;
    dispose(): void;
}

export interface Runtime {
    createParser(preset: string): Parser;
    createExtractor(options: ExtractorOptions): Extractor;
    dispose(): void;
}

/** Compile Wasm once; each Parser owns an independent instance and Rust preset. */
export async function createRuntime(bytes: Uint8Array): Promise<Runtime> {
    let module: WebAssembly.Module | undefined = await WebAssembly.compile(
        new Uint8Array(bytes).buffer,
    );

    const instances = new Set<{ dispose(): void }>();

    return Object.freeze({
        createParser(preset: string): Parser {
            const instance = instantiate("configure", preset);
            return Object.freeze({
                parse: (source: string) =>
                    instance.call<Document>("parse", source),
                parseInline: (source: string) =>
                    instance.call<Document>("parse", source, 1),
                dispose: instance.dispose,
            });
        },

        createExtractor(options: ExtractorOptions): Extractor {
            const instance = instantiate(
                "configure_extractor",
                JSON.stringify(options),
            );
            return Object.freeze({
                extract: (document: Document) =>
                    instance.call<Extraction>(
                        "extract",
                        JSON.stringify(document),
                    ),
                dispose: instance.dispose,
            });
        },

        dispose() {
            module = undefined;
            for (const instance of instances) {
                instance.dispose();
            }
        },
    });

    function instantiate(
        configuration: "configure" | "configure_extractor",
        config: string,
    ) {
        if (!module) {
            throw new Error("Runtime is disposed");
        }
        let wasm: Wasm | undefined = new WebAssembly.Instance(module, {})
            .exports as Wasm;

        const encoder = new TextEncoder(),
            decoder = new TextDecoder("utf-8", {
                fatal: true,
                ignoreBOM: true,
            });

        function call<T>(
            operation:
                | "configure"
                | "configure_extractor"
                | "parse"
                | "extract",
            source: string,
            mode = 0,
        ): T {
            if (!wasm) {
                throw new Error("Instance is disposed");
            }
            if (typeof source !== "string") {
                throw new TypeError("Expected source string");
            }
            if (source.length > inputBytes) {
                throw new RangeError("Wasm input limit exceeded");
            }

            const input = encoder.encode(source);
            if (input.length > inputBytes) {
                throw new RangeError("Wasm input limit exceeded");
            }
            if (decoder.decode(input) !== source) {
                throw new TypeError("Source contains an unpaired surrogate");
            }

            const pointer = wasm.input_ptr(input.length);
            if (!pointer) {
                throw new RangeError("Wasm input limit exceeded");
            }

            let result: {
                document?: unknown;
                result?: unknown;
                configured?: string;
                error?: unknown;
            };

            try {
                new Uint8Array(wasm.memory.buffer, pointer, input.length).set(
                    input,
                );
                const length = wasm[operation](mode);
                result = JSON.parse(
                    decoder.decode(
                        new Uint8Array(
                            wasm.memory.buffer,
                            wasm.output_ptr(),
                            length,
                        ),
                    ),
                );
            } catch (error) {
                wasm = undefined;
                throw error;
            }

            // Rust validates the AST before encoding; the build ID pairs its types.
            if (result.error) {
                throw new Error("Markdown: " + JSON.stringify(result.error), {
                    cause: result.error,
                });
            }
            if (
                operation.startsWith("configure") &&
                result.configured !== buildId
            ) {
                throw new Error("Wasm does not match this SDK build");
            }
            return (result.result ?? result.document) as T;
        }

        call(configuration, config);

        const instance = Object.freeze({
            call,
            dispose() {
                wasm = undefined;
                instances.delete(instance);
            },
        });
        instances.add(instance);

        return instance;
    }
}

export { embedReferences, mentionsUser } from "./embedding.js";
