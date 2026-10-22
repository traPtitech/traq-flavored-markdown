use crate::{Grammar, GrammarBuilder, Parser, syntax::commonmark};
use std::sync::LazyLock;

pub fn syntax() -> &'static commonmark::Syntax {
    traq_markdown_features::commonmark_syntax()
}

pub fn builder() -> GrammarBuilder {
    let base = syntax();
    let mut builder = GrammarBuilder::new();
    for feature in traq_markdown_features::selected(traq_markdown_features::Profile::Commonmark) {
        builder
            .add((feature.syntax)())
            .expect("unique CommonMark features");
    }
    builder
        .before(commonmark::html::inline_rule(), &base.inline.entity)
        .expect("HTML inline anchor");
    builder
        .before(commonmark::html::block_rule(), &base.block.heading)
        .expect("HTML block anchor");
    builder
}

pub fn grammar() -> &'static Grammar {
    static GRAMMAR: LazyLock<Grammar> =
        LazyLock::new(|| builder().build().expect("valid CommonMark profile"));
    &GRAMMAR
}

pub fn parser() -> Parser {
    Parser::new(grammar())
}
