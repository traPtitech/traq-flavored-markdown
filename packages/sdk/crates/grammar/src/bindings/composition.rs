use super::Catalog;

use crate::{
    Grammar, GrammarBuilder,
    engine::{BuildError, Plugin},
};

use markdown_definitions::Plugin as Declaration;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GroupSpec {
    pub parent: Option<usize>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PluginSpec {
    pub group: Option<usize>,
    pub name: Option<String>,
    pub rules: Vec<usize>,
    /// The catalog plugin supplying ordinary-text construction.
    #[serde(default)]
    pub text_provider: Option<usize>,
    /// The catalog plugin supplying block-sequence behavior.
    #[serde(default)]
    pub block_policy: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Composition {
    pub groups: Vec<GroupSpec>,
    pub plugins: Vec<PluginSpec>,
    pub order: Vec<usize>,
}

fn invalid(reason: &str) -> BuildError {
    BuildError::InvalidDefinition {
        reason: reason.into(),
    }
}

impl Catalog {
    pub fn build(&self, spec: &Composition) -> Result<Grammar, BuildError> {
        // Bound configuration work independently of message parsing.
        if spec.groups.len() > 256 || spec.plugins.len() > 256 || spec.order.len() > 4096 {
            return Err(invalid("composition limit exceeded"));
        }

        let groups = self.compose_groups(spec)?;
        let mut builder = self.compose_plugins(spec, &groups)?;

        self.apply_rule_order(spec, &mut builder)?;
        builder.build()
    }

    fn compose_groups(
        &self,
        spec: &Composition,
    ) -> Result<Vec<crate::engine::PluginGroup>, BuildError> {
        let mut groups: Vec<crate::engine::PluginGroup> = vec![];
        let mut depths = vec![];

        for (index, group) in spec.groups.iter().enumerate() {
            let name = group
                .name
                .as_deref()
                .ok_or_else(|| invalid("missing group display name"))?;

            let (value, depth) = if let Some(parent) = group.parent {
                if parent >= index {
                    return Err(invalid("namespace parent must precede child"));
                }

                (groups[parent].group(name), depths[parent] + 1)
            } else {
                (Declaration::group(name), 1)
            };

            if depth > 64 {
                return Err(invalid("namespace depth limit exceeded"));
            }

            groups.push(value);
            depths.push(depth);
        }

        Ok(groups)
    }

    fn compose_plugins(
        &self,
        spec: &Composition,
        groups: &[crate::engine::PluginGroup],
    ) -> Result<GrammarBuilder, BuildError> {
        let mut builder = GrammarBuilder::new();

        for plugin in &spec.plugins {
            builder.add(&self.compose_plugin(plugin, groups)?)?;
        }

        Ok(builder)
    }

    fn compose_plugin(
        &self,
        spec: &PluginSpec,
        groups: &[crate::engine::PluginGroup],
    ) -> Result<Plugin, BuildError> {
        let name = spec
            .name
            .as_deref()
            .ok_or_else(|| invalid("missing plugin display name"))?;

        let declaration = match spec.group {
            Some(index) => groups
                .get(index)
                .ok_or_else(|| invalid("unknown namespace"))?
                .plugin(name),
            None => Declaration::new(name),
        };

        let mut plugin = Plugin::new(&declaration);

        if spec.rules.len() > 4096 {
            return Err(invalid("rule limit exceeded"));
        }

        for &index in &spec.rules {
            plugin.add(
                self.rules
                    .get(index)
                    .ok_or_else(|| invalid("unknown rule"))?
                    .clone(),
            );
        }

        if let Some(index) = spec.text_provider {
            let source = self
                .plugins
                .get(index)
                .ok_or_else(|| invalid("unknown text provider"))?;
            plugin.inherit_text_from(source)?;
        }

        if let Some(index) = spec.block_policy {
            let source = self
                .plugins
                .get(index)
                .ok_or_else(|| invalid("unknown block policy"))?;
            plugin.inherit_block_policy_from(source)?;
        }

        Ok(plugin)
    }

    fn apply_rule_order(
        &self,
        spec: &Composition,
        builder: &mut GrammarBuilder,
    ) -> Result<(), BuildError> {
        if spec.order.len() != builder.rules().count() {
            return Err(invalid("incomplete rule order"));
        }

        let mut seen = HashSet::new();
        let mut ordered = vec![];

        for &index in &spec.order {
            if !seen.insert(index) {
                return Err(invalid("duplicate ordered rule"));
            }

            let rule = self
                .rules
                .get(index)
                .ok_or_else(|| invalid("unknown ordered rule"))?;

            let entry = builder
                .rules()
                .find(|r| r.same(rule))
                .ok_or_else(|| invalid("ordered rule is not registered"))?;

            ordered.push(entry.clone());
        }

        builder.reorder(&ordered)?;
        Ok(())
    }
}
