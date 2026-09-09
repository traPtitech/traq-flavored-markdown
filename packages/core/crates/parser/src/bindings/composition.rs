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
    /// Internal catalog references. User-facing SDKs carry these with the plugin.
    #[serde(default)]
    pub text: Vec<usize>,
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
                .new(name),
            None => Declaration::new(name),
        };

        let mut plugin = Plugin::new(&declaration);

        if spec.rules.len() > 4096 || spec.text.len() > 256 {
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

        for &index in &spec.text {
            let source = self
                .plugins
                .get(index)
                .ok_or_else(|| invalid("unknown text provider"))?;
            std::sync::Arc::make_mut(&mut plugin.definition)
                .text
                .extend(source.definition.text.iter().cloned());
        }

        Ok(plugin)
    }

    fn apply_rule_order(
        &self,
        spec: &Composition,
        builder: &mut GrammarBuilder,
    ) -> Result<(), BuildError> {
        if spec.order.len() != builder.rules.len() {
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
                .rules
                .iter()
                .find(|(_, r)| r.same(rule))
                .ok_or_else(|| invalid("ordered rule is not registered"))?;

            ordered.push(entry.clone());
        }

        builder.rules = ordered;
        Ok(())
    }
}
