# markdown-traq-syntax

Provides traQ JSON references, stamps, spoilers, and a `spacing` plugin that
preserves source blank lines. Each module's `plugin()` can be added to or removed from a grammar
independently; a distribution preset chooses the final priority and combination.

`markdown-traq-contracts` owns the payload types. Reference extraction,
plain-text rendering, and URL classification are outside this crate. The
implementation reuses CommonMark delimiter handling. CommonMark rules own
quotes, links, images, and URL encoding; rendering policies decide which URLs
may become active links or images.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for notices covering
third-party algorithms.
