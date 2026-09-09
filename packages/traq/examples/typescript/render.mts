import { readFile } from "node:fs/promises";
import { createRuntime, presets } from "@traq-markdown-parser/traq";
import { renderer } from "@traq-markdown-parser/core/renderer";
import * as rendering from "@traq-markdown-parser/traq/renderer";

const runtime = await createRuntime(
    await readFile(
        new URL(import.meta.resolve("@traq-markdown-parser/traq/parser.wasm")),
    ),
);
try {
    const parser = runtime.createParser(presets.traq.v1);
    const view = renderer(rendering.html());

    console.log(
        view.render(
            parser.parse("**Hello** ==Markdown== $x^2$ !!secret!! :0xff0000:"),
        ),
    );
} finally {
    runtime.dispose();
}
