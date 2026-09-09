use super::{
    Contribution, PluginGroup,
    block::BlockRule,
    inline::{InlineRule, TextRule},
};

use markdown_ast::{NodeData, NodeKind};
use std::sync::Arc;

pub(crate) type TextFactory = Arc<dyn Fn(String) -> NodeKind + Send + Sync>;
#[derive(Clone, Default)]
pub(crate) struct Definition {
    pub rules: Vec<Contribution>,
    pub text: Vec<TextFactory>,
}

/// Parser implementation of a shared declaration. Editing a shared copy creates
/// a new implementation snapshot, without changing the shared declaration.
#[derive(Clone)]
pub struct Plugin {
    pub(crate) definition: Arc<Definition>,
    pub(super) declaration: markdown_definitions::Plugin,
}

impl Plugin {
    pub fn new(declaration: &markdown_definitions::Plugin) -> Self {
        Self {
            definition: Arc::default(),
            declaration: declaration.clone(),
        }
    }

    pub fn name(&self) -> &str {
        self.declaration.name()
    }

    pub fn namespace(&self) -> Option<&PluginGroup> {
        self.declaration.namespace()
    }

    pub fn add(&mut self, rule: impl Into<Contribution>) -> &mut Self {
        Arc::make_mut(&mut self.definition).rules.push(rule.into());
        self
    }

    /// Construct ordinary text after text processing and joining.
    /// Exactly one provider must be registered when the grammar is built.
    pub fn text<T: NodeData>(
        &mut self,
        make: impl Fn(String) -> T + Send + Sync + 'static,
    ) -> &mut Self {
        Arc::make_mut(&mut self.definition)
            .text
            .push(Arc::new(move |value| NodeKind::new(make(value))));
        self
    }

    pub fn inline_rules(&self) -> impl Iterator<Item = &InlineRule> {
        self.definition.rules.iter().filter_map(|r| {
            if let Contribution::Inline(r) = r {
                Some(r)
            } else {
                None
            }
        })
    }

    pub fn block_rules(&self) -> impl Iterator<Item = &BlockRule> {
        self.definition.rules.iter().filter_map(|r| {
            if let Contribution::Block(r) = r {
                Some(r)
            } else {
                None
            }
        })
    }

    pub fn text_rules(&self) -> impl Iterator<Item = &TextRule> {
        self.definition.rules.iter().filter_map(|r| {
            if let Contribution::Text(r) = r {
                Some(r)
            } else {
                None
            }
        })
    }

    pub(crate) fn same(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.definition, &other.definition)
    }

    pub(crate) fn description(&self) -> String {
        self.namespace().map_or_else(
            || self.name().into(),
            |g| format!("{}/{}", group_description(g), self.name()),
        )
    }
}

pub(crate) fn group_description(group: &PluginGroup) -> String {
    let mut names = vec![group.name()];
    let mut parent = group.parent();

    while let Some(group) = parent {
        names.push(group.name());
        parent = group.parent();
    }

    names.reverse();
    names.join("/")
}
