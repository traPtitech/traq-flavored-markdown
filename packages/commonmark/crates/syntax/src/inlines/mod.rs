mod basic;
pub(crate) mod destination;
pub mod emphasis;
pub mod entities;
pub mod links;
pub mod url;

use markdown_parser::engine::inline::InlineRule;

pub struct Rules {
    pub escape: InlineRule,
    pub code: InlineRule,
    pub emphasis: InlineRule,
    pub link: InlineRule,
    pub autolink: InlineRule,
    pub entity: InlineRule,
    pub newline: InlineRule,
}

pub(crate) fn rules(options: links::LinkOptions) -> Rules {
    Rules {
        escape: InlineRule::new(b"\\", basic::escape).named("escape"),
        code: InlineRule::new(b"`", basic::code).named("code"),
        emphasis: InlineRule::new(b"*_", emphasis::emphasis).named("emphasis"),

        link: InlineRule::new(b"[!]", move |input, budget| {
            links::link(input, budget, options)
        })
        .named("link"),

        autolink: InlineRule::new(b"<", move |input, budget| {
            links::autolink(input, budget, options)
        })
        .named("autolink"),

        entity: InlineRule::new(b"&", basic::entity).named("entity"),
        newline: InlineRule::new(b"\n", basic::newline).named("newline"),
    }
}
impl Rules {
    pub(crate) fn register(&self, plugin: &mut markdown_parser::engine::Plugin) {
        plugin.add(&self.escape);
        plugin.add(&self.code);
        plugin.add(&self.emphasis);
        plugin.add(&self.link);
        plugin.add(&self.autolink);
        plugin.add(&self.entity);
        plugin.add(&self.newline);
    }
}
