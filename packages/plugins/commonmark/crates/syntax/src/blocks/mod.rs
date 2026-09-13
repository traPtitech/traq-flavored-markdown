mod definition;
mod leaf;
mod list;
pub(crate) mod markers;
mod paragraph;
pub mod quote;

use super::inlines::links::LinkOptions;
use markdown_parser::engine::block::BlockRule;

pub struct Rules {
    pub definition: BlockRule,
    pub blank: BlockRule,
    pub fence: BlockRule,
    pub indented: BlockRule,
    pub heading: BlockRule,
    pub thematic: BlockRule,
    pub quote: BlockRule,
    pub list: BlockRule,
    pub paragraph: BlockRule,
}

pub(crate) fn rules(options: LinkOptions) -> Rules {
    Rules {
        definition: BlockRule::new(move |input, budget| {
            definition::parse(input, budget, options.normalize)
        })
        .named("definition"),

        blank: BlockRule::new(|input, _| {
            Ok(markers::blank(input.current())
                .then(|| markdown_parser::engine::block::BlockMatch::ignore(input.start + 1)))
        })
        .named("blank")
        .interrupts(|probe| markers::blank(probe.line)),

        fence: BlockRule::new(leaf::fenced)
            .named("fence")
            .interrupts(|probe| markers::fence(probe.line).is_some()),

        indented: BlockRule::new(leaf::indented).named("indented"),

        heading: BlockRule::new(leaf::atx)
            .named("heading")
            .interrupts(|probe| markers::heading(probe.line).is_some()),

        thematic: BlockRule::new(leaf::thematic_break)
            .named("thematic")
            .interrupts(|probe| !probe.line.starts_with("    ") && markers::thematic(probe.line)),

        quote: BlockRule::new(quote::parse)
            .named("quote")
            .interrupts(|probe| markers::quote(probe.line).is_some()),

        list: BlockRule::new(list::parse)
            .named("list")
            .interrupts(|probe| {
                markers::item(probe.line).is_some_and(|m| {
                    (!m.ordered || m.start == 1) && !markers::blank(&probe.line[m.content..])
                })
            }),

        paragraph: BlockRule::new(paragraph::parse).named("paragraph"),
    }
}

impl Rules {
    pub(crate) fn register(&self, plugin: &mut markdown_parser::engine::Plugin) {
        plugin.add(&self.definition);
        plugin.add(&self.blank);
        plugin.add(&self.fence);
        plugin.add(&self.indented);
        plugin.add(&self.heading);
        plugin.add(&self.thematic);
        plugin.add(&self.quote);
        plugin.add(&self.list);
        plugin.add(&self.paragraph);
    }
}
