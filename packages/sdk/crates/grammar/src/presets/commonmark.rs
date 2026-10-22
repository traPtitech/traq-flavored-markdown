use crate::{Grammar, GrammarBuilder, Parser, syntax::commonmark};
use std::sync::LazyLock;

pub fn syntax() -> &'static commonmark::Syntax {
    traq_markdown_features::commonmark_syntax()
}

pub fn builder() -> GrammarBuilder {
    traq_markdown_features::Profile::Commonmark
        .grammar_builder()
        .expect("valid profile definition")
}

pub fn grammar() -> &'static Grammar {
    static GRAMMAR: LazyLock<Grammar> =
        LazyLock::new(|| builder().build().expect("valid CommonMark profile"));
    &GRAMMAR
}

pub fn parser() -> Parser {
    Parser::new(grammar())
}
