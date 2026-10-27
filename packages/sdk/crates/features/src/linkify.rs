//! traQ V1 opts into scheme-less angle autolinks, without bare linkification.
use std::sync::LazyLock;

pub fn syntax() -> &'static markdown_extensions_syntax::linkify::Syntax {
    static SYNTAX: LazyLock<markdown_extensions_syntax::linkify::Syntax> =
        LazyLock::new(markdown_extensions_syntax::linkify::Syntax::new);
    &SYNTAX
}
