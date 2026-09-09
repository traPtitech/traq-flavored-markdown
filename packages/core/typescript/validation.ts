// Small validators shared by the common AST and plugin-owned payload codecs.
export type Check = (value: unknown) => boolean;
type Checked<C> = C extends (value: unknown) => value is infer T ? T : unknown;
type Shape<S> = { [K in keyof S]: Checked<S[K]> };

export const string = (value: unknown): value is string =>
    typeof value === "string";

export const boolean = (value: unknown): value is boolean =>
    typeof value === "boolean";

export const uint = (value: unknown): value is number =>
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 0xffffffff;

export const nullable = (check: Check) => (value: unknown) =>
    value === null || check(value);

export const oneOf =
    (...values: unknown[]) =>
    (value: unknown) =>
        values.includes(value);

export const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

export function fields<
    R extends Record<string, Check>,
    O extends Record<string, Check> = {},
>(
    value: unknown,
    required: R,
    optional: O = {} as O,
): value is Shape<R> & Partial<Shape<O>> {
    return (
        object(value) &&
        Object.entries(required).every(
            ([key, check]) => Object.hasOwn(value, key) && check(value[key]),
        ) &&
        Object.entries(value).every(
            ([key, item]) =>
                Object.hasOwn(required, key) ||
                (Object.hasOwn(optional, key) && optional[key](item)),
        )
    );
}
