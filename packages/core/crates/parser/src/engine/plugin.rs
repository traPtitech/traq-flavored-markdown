use super::{
    Contribution, PluginGroup,
    block::BlockRule,
    inline::{InlineRule, TextRule},
};

use markdown_ast::{AnyPayload, NodeData};
use std::sync::Arc;

pub(crate) type TextFactory = Arc<dyn Fn(String) -> AnyPayload + Send + Sync>;
#[derive(Clone, Default)]
pub(crate) struct Definition {
    pub rules: Vec<Contribution>,
    pub text: Option<TextFactory>,
    pub block_policy: Option<Arc<dyn super::block::BlockPolicy>>,
}

/// Parser implementation of a shared declaration. Editing a shared copy creates
/// a new implementation snapshot, without changing the shared declaration.
#[derive(Clone)]
pub struct SyntaxPlugin {
    pub(crate) definition: Arc<Definition>,
    pub(super) declaration: markdown_definitions::PluginDeclaration,
}

impl SyntaxPlugin {
    pub fn new(declaration: &markdown_definitions::PluginDeclaration) -> Self {
        Self {
            definition: Arc::default(),
            declaration: declaration.clone(),
        }
    }

    /// A plugin implementing one rule and no parser context providers.
    pub fn from_rule(
        declaration: &markdown_definitions::PluginDeclaration,
        rule: impl Into<Contribution>,
    ) -> Self {
        let mut plugin = Self::new(declaration);
        plugin.add(rule);
        plugin
    }

    pub fn name(&self) -> &str {
        self.declaration.name()
    }

    pub fn namespace(&self) -> Option<&PluginGroup> {
        self.declaration.namespace()
    }

    pub fn rules(&self) -> &[Contribution] {
        &self.definition.rules
    }

    pub fn has_text_provider(&self) -> bool {
        self.definition.text.is_some()
    }

    pub fn has_block_policy(&self) -> bool {
        self.definition.block_policy.is_some()
    }

    /// Inherit only ordinary-text construction, never block-sequence behavior.
    pub fn inherit_text_from(
        &mut self,
        source: &SyntaxPlugin,
    ) -> Result<&mut Self, super::BuildError> {
        if self.has_text_provider() {
            return Err(super::BuildError::Duplicate {
                element: "text provider".into(),
            });
        }
        let provider =
            source
                .definition
                .text
                .clone()
                .ok_or_else(|| super::BuildError::Missing {
                    element: "text provider".into(),
                })?;
        Arc::make_mut(&mut self.definition).text = Some(provider);
        Ok(self)
    }

    /// Inherit only block-sequence behavior, never ordinary-text construction.
    pub fn inherit_block_policy_from(
        &mut self,
        source: &SyntaxPlugin,
    ) -> Result<&mut Self, super::BuildError> {
        if self.has_block_policy() {
            return Err(super::BuildError::Duplicate {
                element: "block sequence policy".into(),
            });
        }
        let policy =
            source
                .definition
                .block_policy
                .clone()
                .ok_or_else(|| super::BuildError::Missing {
                    element: "block sequence policy".into(),
                })?;
        Arc::make_mut(&mut self.definition).block_policy = Some(policy);
        Ok(self)
    }

    pub fn block_policy(&mut self, policy: impl super::block::BlockPolicy + 'static) -> &mut Self {
        Arc::make_mut(&mut self.definition).block_policy = Some(Arc::new(policy));
        self
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
        Arc::make_mut(&mut self.definition).text =
            Some(Arc::new(move |value| AnyPayload::new(make(value))));
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

    pub fn same(&self, other: &Self) -> bool {
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
