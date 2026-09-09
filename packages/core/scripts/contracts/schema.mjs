// Accept only the schema forms emitted for the supported payload types.
// Context-specific checks prevent silently discarding combined constraints.
const metadata = ["$schema", "$defs", "title", "description", "default"];
function keys(schema, allowed) {
  for (const key of Object.keys(schema))
    if (!metadata.includes(key) && !allowed.includes(key))
      throw new Error("Unsupported schema keyword: " + key);
}
export function shape(schema, root = schema, references = new Set()) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema))
    throw new Error("Expected an object schema");
  if (schema.$ref) {
    keys(schema, ["$ref"]);
    if (!schema.$ref.startsWith("#/$defs/"))
      throw new Error("Only local schema references are supported");
    if (references.has(schema.$ref))
      throw new Error("Recursive payload schemas are unsupported");
    const target = root.$defs?.[schema.$ref.slice(8)];
    if (!target) throw new Error("Unresolved schema reference: " + schema.$ref);
    return {
      ...shape(target, root, new Set([...references, schema.$ref])),
      name: schema.$ref.slice(8),
    };
  }

  if (schema.anyOf || Array.isArray(schema.type)) {
    keys(schema, schema.anyOf ? ["anyOf"] : ["type"]);
    const variants = schema.anyOf ?? schema.type.map((type) => ({ type }));
    const real = variants.filter((s) => s.type !== "null");
    if (variants.length !== 2 || real.length !== 1)
      throw new Error("Only nullable unions are supported");
    keys(
      variants.find((s) => s.type === "null"),
      ["type"],
    );
    return { kind: "nullable", inner: shape(real[0], root, references) };
  }

  if (schema.enum) {
    keys(schema, ["type", "enum"]);
    if (
      schema.type !== "string" ||
      !schema.enum.length ||
      !schema.enum.every((s) => typeof s === "string")
    )
      throw new Error("Only nonempty string enums are supported");
    return { kind: "enum", values: schema.enum };
  }

  if (schema.type === "string" || schema.type === "boolean") {
    keys(schema, ["type"]);
    return { kind: schema.type };
  }

  if (schema.type === "integer") {
    keys(schema, ["type", "format", "minimum", "maximum"]);
    const ranges = { uint8: [0, 255], uint32: [0, 0xffffffff] };
    const range = ranges[schema.format];
    if (
      !range ||
      schema.minimum !== range[0] ||
      (schema.maximum ?? range[1]) !== range[1]
    )
      throw new Error("Unsupported integer representation or constraints");
    return {
      kind: "integer",
      format: schema.format,
      min: range[0],
      max: range[1],
    };
  }

  if (schema.type === "array") {
    keys(schema, ["type", "items"]);
    return { kind: "array", items: shape(schema.items, root, references) };
  }

  if (schema.type === "object") {
    keys(schema, ["type", "properties", "required", "additionalProperties"]);
    if (schema.additionalProperties !== false)
      throw new Error("Payload objects must reject unknown fields");
    const required = schema.required ?? [];
    const properties = schema.properties ?? {};
    if (!required.every((name) => Object.hasOwn(properties, name)))
      throw new Error("Required field lacks a property schema");
    return {
      kind: "object",
      fields: Object.entries(properties).map(([name, s]) => ({
        name,
        required: required.includes(name),
        shape: shape(s, root, references),
      })),
    };
  }

  throw new Error("Unsupported schema type: " + schema.type);
}

export function typeName(schema) {
  const name = schema.title?.replace(/Data$/, "");
  if (!name || !/^[A-Z][A-Za-z0-9_]*$/.test(name))
    throw new Error("Expected an exported payload type name");
  return name;
}
export const quoted = JSON.stringify;
