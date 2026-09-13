# markdown-trap-syntax

Provides traP JSON references, stamps, spoilers, and traQ V1 compatibility
rules. Each module's `plugin()` can be added to or removed from a grammar
independently; a distribution preset chooses the final priority and combination.

`markdown-trap-contracts` owns the payload types. Reference extraction,
notification rendering, and URL classification are outside this crate. The
implementation reuses CommonMark delimiter, quote, and URL handling.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for notices covering
third-party algorithms.
