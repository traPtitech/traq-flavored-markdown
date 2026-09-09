const q = JSON.stringify;

function leaves(tree, path = []) {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "number"
      ? [[...path, key]]
      : leaves(value, [...path, key]),
  );
}

function named(tree, path = []) {
  return Object.fromEntries(
    Object.entries(tree).map(([key, value]) => [
      key,
      typeof value === "number"
        ? [...path, key].join(".")
        : named(value, [...path, key]),
    ]),
  );
}

export function presetFiles(tree) {
  const paths = leaves(tree);
  const goName = (part) =>
    ({ traq: "TraQ", commonmark: "CommonMark" })[part] ??
    part[0].toUpperCase() + part.slice(1);
  return new Map([
    [
      "typescript/generated/presets.ts",
      "// Generated from Rust preset exports. Do not edit.\n" +
        "export type Preset = " +
        paths.map((p) => q(p.join("."))).join(" | ") +
        ";\n" +
        "export const presets = " +
        q(named(tree)) +
        " as const;\n",
    ],
    [
      "go/presets_generated.go",
      "// Code generated from Rust preset exports. DO NOT EDIT.\npackage markdown\ntype Preset string\nconst (\n" +
        paths
          .map(
            (p) =>
              "Preset" + p.map(goName).join("") + " Preset = " + q(p.join(".")),
          )
          .join("\n") +
        "\n)\n",
    ],
  ]);
}
