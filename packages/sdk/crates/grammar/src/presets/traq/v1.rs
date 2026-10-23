use crate::{Grammar, GrammarBuilder, Parser, syntax::commonmark};
use std::sync::LazyLock;

pub fn syntax() -> &'static commonmark::Syntax {
    traq_markdown_features::commonmark_syntax()
}

pub fn builder() -> GrammarBuilder {
    traq_markdown_features::GrammarProfile::TraqV1
        .grammar_builder()
        .expect("valid profile definition")
}

pub fn grammar() -> &'static Grammar {
    static GRAMMAR: LazyLock<Grammar> = LazyLock::new(|| {
        let grammar = builder().build().expect("valid V1 profile");
        // Product-specific lazy recognizers are warmed here, never in the generic hosts.
        Parser::new(&grammar)
            .parse("example.com :stamp: <a@example.com>")
            .expect("valid warmup");
        grammar
    });
    &GRAMMAR
}

pub fn parser() -> Parser {
    Parser::new(grammar())
}
