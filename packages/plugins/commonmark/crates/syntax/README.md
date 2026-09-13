# markdown-commonmark

The CommonMark block and inline syntax implementation. It depends on parser
core and CommonMark node contracts, not on traQ grammar or distribution code.

`Syntax::default()` provides the base rules, text provider, and `inline`/`block`
rule references used to position extensions. Add HTML support with
`html::plugin()`. `LinkOptions` configures link recognition and URL handling.

An application's `GrammarBuilder` determines the final rule order. Adding math
or spoilers does not require changing the CommonMark implementation.

Run the standalone composition example with:

```sh
cargo run -p markdown-commonmark --example compose
```

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for notices covering
third-party algorithms and data.
