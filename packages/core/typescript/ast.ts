/** A half-open UTF-8 byte range in the original source. */
export interface Span {
    start: number;
    end: number;
}

export type Node<
    Kind extends { kind: string; data: unknown } = {
        kind: string;
        data: unknown;
    },
> = Kind & { span: Span; children?: Node<Kind>[] };

export interface Document<
    Kind extends { kind: string; data: unknown } = {
        kind: string;
        data: unknown;
    },
> {
    source: string;
    children: Node<Kind>[];
}
