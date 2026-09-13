use crate::{
    Grammar, GrammarBuilder, Parser,
    syntax::{commonmark, extensions, trap},
};
use std::sync::LazyLock;

pub fn syntax() -> &'static commonmark::Syntax {
    static SYNTAX: LazyLock<commonmark::Syntax> =
        LazyLock::new(|| commonmark::Syntax::new(trap::compat::links()));
    &SYNTAX
}

pub fn builder() -> GrammarBuilder {
    let base = syntax();
    let mut builder = GrammarBuilder::new();
    builder.add(&base.plugin).expect("unique base rules");
    add_plugins(&mut builder);
    set_inline_precedence(&mut builder, base);
    set_block_precedence(&mut builder, base);
    builder
}

fn add_plugins(builder: &mut GrammarBuilder) {
    for plugin in [
        extensions::table::plugin(),
        extensions::math::plugin(),
        extensions::strikethrough::plugin(),
        extensions::mark::plugin(),
        trap::spoiler::plugin(),
        trap::references::plugin(),
        trap::stamp::plugin(),
        extensions::linkify::plugin(),
        trap::compat::plugin(),
    ] {
        builder.add(plugin).expect("unique V1 plugins");
    }
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
        (extensions::linkify::inline_rule(), &base.inline.entity),
    ] {
        builder
            .before(rule, anchor)
            .expect("existing V1 inline anchors");
    }
}

fn set_block_precedence(builder: &mut GrammarBuilder, base: &commonmark::Syntax) {
    for (rule, anchor) in [
        (trap::compat::blank_rule(), &base.block.blank),
        (extensions::table::block_rule(), &base.block.fence),
        (extensions::math::block_rule(), &base.block.fence),
        (trap::compat::quote_rule(), &base.block.quote),
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
