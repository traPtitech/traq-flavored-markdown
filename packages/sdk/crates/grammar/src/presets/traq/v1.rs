use crate::{
    Grammar, GrammarBuilder, Parser,
    syntax::{commonmark, extensions, trap},
};
use std::sync::LazyLock;

pub fn syntax() -> &'static commonmark::Syntax {
    traq_markdown_features::commonmark_syntax()
}

pub fn builder() -> GrammarBuilder {
    let base = syntax();
    let mut builder = GrammarBuilder::new();
    for feature in traq_markdown_features::selected(traq_markdown_features::Profile::TraqV1) {
        builder.add((feature.syntax)()).expect("unique V1 features");
    }
    set_inline_precedence(&mut builder, base);
    set_block_precedence(&mut builder, base);
    builder
}

fn set_inline_precedence(builder: &mut GrammarBuilder, base: &commonmark::Syntax) {
    // Positions are frozen in the profile; plugins do not guess other rules' precedence.
    for (rule, anchor) in [
        (extensions::math::inline_rule(), &base.inline.code),
        (trap::spoiler::inline_rule(), &base.inline.emphasis),
        (
            extensions::strikethrough::inline_rule(),
            &base.inline.emphasis,
        ),
        (extensions::mark::inline_rule(), &base.inline.emphasis),
        (trap::references::inline_rule(), &base.inline.link),
        (trap::stamp::inline_rule(), &base.inline.entity),
        (
            &traq_markdown_features::traq_linkify_syntax().inline,
            &base.inline.entity,
        ),
    ] {
        builder
            .before(rule, anchor)
            .expect("existing V1 inline anchors");
    }
}

fn set_block_precedence(builder: &mut GrammarBuilder, base: &commonmark::Syntax) {
    for (rule, anchor) in [
        (trap::spacing::blank_rule(), &base.block.blank),
        (extensions::table::block_rule(), &base.block.fence),
        (extensions::math::block_rule(), &base.block.fence),
    ] {
        builder
            .before(rule, anchor)
            .expect("existing V1 block anchors");
    }
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
