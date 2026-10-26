mod basic;
pub(crate) mod destination;
pub mod emphasis;
pub mod entities;
pub mod links;
pub mod url;

use markdown_parser::rules::inline::InlineRule;

pub struct Rules {
    pub escape: InlineRule,
    pub code: InlineRule,
    pub emphasis: InlineRule,
    pub link: InlineRule,
    pub autolink: InlineRule,
    pub entity: InlineRule,
    pub newline: InlineRule,
}

pub(crate) fn rules() -> Rules {
    Rules {
        escape: InlineRule::new(b"\\", basic::escape).named("escape"),
        code: InlineRule::new(b"`", basic::code).named("code"),
        emphasis: InlineRule::new(b"*_", emphasis::emphasis).named("emphasis"),

        link: InlineRule::new(b"[!]", links::link).named("link"),

        autolink: InlineRule::new(b"<", links::autolink).named("autolink"),

        entity: InlineRule::new(b"&", basic::entity).named("entity"),
        newline: InlineRule::new(b"\n", basic::newline).named("newline"),
    }
}
impl Rules {
    pub(crate) fn register(&self, plugin: &mut markdown_parser::grammar::SyntaxPlugin) {
        plugin.add(&self.escape);
        plugin.add(&self.code);
        plugin.add(&self.emphasis);
        plugin.add(&self.link);
        plugin.add(&self.autolink);
        plugin.add(&self.entity);
        plugin.add(&self.newline);
    }
}
