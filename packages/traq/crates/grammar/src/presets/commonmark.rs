use crate::{Grammar, GrammarBuilder, Parser, syntax::commonmark};
use std::sync::LazyLock;

pub fn syntax() -> &'static commonmark::Syntax {
    static SYNTAX: LazyLock<commonmark::Syntax> = LazyLock::new(commonmark::Syntax::default);
    &SYNTAX
}

pub fn builder() -> GrammarBuilder {
    let base = syntax();
    let mut builder = GrammarBuilder::new();
    builder.add(&base.plugin).expect("unique CommonMark rules");
    builder
        .add(commonmark::html::plugin())
        .expect("unique HTML rules");
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
