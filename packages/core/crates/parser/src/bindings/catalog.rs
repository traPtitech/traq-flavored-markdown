use super::{Composition, GroupSpec, PluginSpec};
use crate::{
    GrammarBuilder,
    engine::{Contribution, Plugin, PluginGroup},
};
use serde::Serialize;
use serde_json::Value;

#[derive(Serialize)]
pub struct RuleSpec {
    pub name: Option<String>,
    pub phase: &'static str,
}

#[derive(Serialize)]
pub struct PresetSpec {
    pub description: String,
    pub plugins: Vec<usize>,
    pub order: Vec<usize>,
}

#[derive(Default)]
pub struct Catalog {
    pub(super) groups: Vec<PluginGroup>,
    pub(super) plugins: Vec<Plugin>,
    pub(super) rules: Vec<Contribution>,
    pub(super) presets: Vec<PresetSpec>,
    pub exports: Value,
}

impl Catalog {
    fn group(&mut self, group: &PluginGroup) -> usize {
        if let Some(index) = self.groups.iter().position(|g| g == group) {
            return index;
        }

        if let Some(parent) = group.parent() {
            self.group(parent);
        }

        self.groups.push(group.clone());
        self.groups.len() - 1
    }

    pub fn plugin(&mut self, plugin: &Plugin) -> usize {
        if let Some(index) = self.plugins.iter().position(|p| p.same(plugin)) {
            return index;
        }

        if let Some(group) = plugin.namespace() {
            self.group(group);
        }

        for rule in plugin.definition.rules.iter() {
            if !self.rules.iter().any(|r| r.same(rule)) {
                self.rules.push(rule.clone());
            }
        }

        self.plugins.push(plugin.clone());
        self.plugins.len() - 1
    }

    pub fn preset(
        &mut self,
        definition: &GrammarBuilder,
    ) -> Result<usize, crate::engine::BuildError> {
        // Metadata registration validates the recipe without compiling dispatch
        // tables or invoking a preset parser for recognizer warmup.
        definition.validate()?;

        let description = definition.describe();
        let plugins = definition.plugins.iter().map(|p| self.plugin(p)).collect();

        let order = definition
            .rules
            .iter()
            .map(|(_, r)| self.rule_index(r))
            .collect();

        self.presets.push(PresetSpec {
            plugins,
            order,
            description,
        });

        Ok(self.presets.len() - 1)
    }

    fn rule_index(&self, rule: &Contribution) -> usize {
        self.rules
            .iter()
            .position(|r| r.same(rule))
            .expect("registered rule")
    }

    pub fn preset_composition(&self, index: usize) -> Option<Composition> {
        let preset = self.presets.get(index)?;

        Some(Composition {
            groups: self.group_specs(),
            plugins: preset
                .plugins
                .iter()
                .map(|&i| self.plugin_spec(&self.plugins[i]))
                .collect(),
            order: preset.order.clone(),
        })
    }

    fn group_specs(&self) -> Vec<GroupSpec> {
        self.groups
            .iter()
            .map(|g| GroupSpec {
                parent: g.parent().map(|p| {
                    self.groups
                        .iter()
                        .position(|g| g == p)
                        .expect("registered parent")
                }),
                name: Some(g.name().to_owned()),
            })
            .collect()
    }

    fn plugin_spec(&self, plugin: &Plugin) -> PluginSpec {
        PluginSpec {
            group: plugin.namespace().map(|g| {
                self.groups
                    .iter()
                    .position(|p| p == g)
                    .expect("registered namespace")
            }),

            name: Some(plugin.name().to_owned()),

            rules: plugin
                .definition
                .rules
                .iter()
                .map(|r| self.rule_index(r))
                .collect(),

            text: if plugin.definition.text.is_empty() {
                vec![]
            } else {
                vec![
                    self.plugins
                        .iter()
                        .position(|p| p.same(plugin))
                        .expect("registered plugin"),
                ]
            },
        }
    }
    pub fn describe(&self) -> Value {
        let rules = self
            .rules
            .iter()
            .map(|r| RuleSpec {
                name: r.name().map(str::to_owned),
                phase: r.phase(),
            })
            .collect::<Vec<_>>();

        let plugins = self
            .plugins
            .iter()
            .map(|p| self.plugin_spec(p))
            .collect::<Vec<_>>();

        serde_json::json!({
            "groups": self.group_specs(), "plugins": plugins, "rules": rules,
            "presets": self.presets, "exports": self.exports,
        })
    }
}
