# traP reference extraction

`references::plugin()` returns a `Plugin<References>` that collects
`ReferenceData`. It uses the declaration shared by `markdown-trap-contracts`
and delegates traversal to `markdown-extractor`; it has no parser, renderer, or
codec dependency.

`References` contains `mentions`, `group_mentions`, and `channel_links`. Each
extraction call returns a new result, preserving document order and duplicates.
Invalid UUIDs are ignored. Standard, hyphen-free, braced, and `urn:uuid:` forms
are accepted and normalized to lowercase standard UUIDs.

The serialized result uses camelCase JSON field names. That serialization belongs
only to this concrete result type; it does not make JSON a requirement of the
AST or extraction core.
