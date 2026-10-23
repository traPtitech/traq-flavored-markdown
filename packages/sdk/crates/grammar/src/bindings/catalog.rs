use super::{
    CatalogExports, Composition, GroupId, GroupSpec, PluginId, PluginSpec, PresetId, RuleId,
};
use markdown_parser::{
    GrammarBuilder,
    engine::{Contribution, Plugin, PluginGroup},
};
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RuleSpec {
    pub name: Option<String>,
    pub phase: RulePhase,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PresetSpec {
    pub description: String,
    pub plugins: Vec<PluginId>,
    pub order: Vec<RuleId>,
}

#[derive(Default)]
pub struct Catalog {
    pub(super) groups: Vec<PluginGroup>,
    pub(super) plugins: Vec<Plugin>,
    pub(super) rules: Vec<Contribution>,
    pub(super) presets: Vec<PresetSpec>,
    pub exports: CatalogExports,
}

impl Catalog {
    fn group(&mut self, group: &PluginGroup) -> GroupId {
        if let Some(index) = self.groups.iter().position(|g| g == group) {
            return GroupId(index);
        }

        if let Some(parent) = group.parent() {
            self.group(parent);
        }

        self.groups.push(group.clone());
        GroupId(self.groups.len() - 1)
    }

    pub fn plugin(&mut self, plugin: &Plugin) -> PluginId {
        if let Some(index) = self.plugins.iter().position(|p| p.same(plugin)) {
            return index;
        }

        if let Some(group) = plugin.namespace() {
            self.group(group);
        }

        for rule in plugin.rules() {
            if !self.rules.iter().any(|r| r.same(rule)) {
                self.rules.push(rule.clone());
            }
        }

        self.plugins.push(plugin.clone());
        PluginId(self.plugins.len() - 1)
    }

    pub fn preset(
        &mut self,
        definition: &GrammarBuilder,
    ) -> Result<PresetId, crate::engine::BuildError> {
        // Metadata registration validates the recipe without compiling dispatch
        // tables or invoking a preset parser for recognizer warmup.
        definition.validate_definition()?;

        let description = definition.describe();
        let plugins = definition.plugins().map(|p| self.plugin(p)).collect();

        let order = definition.rules().map(|r| self.rule_index(r)).collect();

        self.presets.push(PresetSpec {
            plugins,
            order,
            description,
        });

        Ok(PresetId(self.presets.len() - 1))
    }

    fn rule_index(&self, rule: &Contribution) -> RuleId {
        RuleId(
            self.rules
                .iter()
                .position(|r| r.same(rule))
                .expect("registered rule"),
        )
    }

    pub fn preset_composition(&self, index: PresetId) -> Option<Composition> {
        let preset = self.presets.get(index.0)?;

        Some(Composition {
            groups: self.group_specs(),
            plugins: preset
                .plugins
                .iter()
                .map(|&i| self.plugin_spec(&self.plugins[i.0]))
                .collect(),
            order: preset.order.clone(),
        })
    }

    fn group_specs(&self) -> Vec<GroupSpec> {
        self.groups
            .iter()
            .map(|g| GroupSpec {
                parent: g.parent().map(|p| {
                    GroupId(
                        self.groups
                            .iter()
                            .position(|g| g == p)
                            .expect("registered parent"),
                    )
                }),
                name: g.name().to_owned(),
            })
            .collect()
    }

    fn plugin_spec(&self, plugin: &Plugin) -> PluginSpec {
        let provider_index = || {
            PluginId(
                self.plugins
                    .iter()
                    .position(|p| p.same(plugin))
                    .expect("registered plugin"),
            )
        };
        PluginSpec {
            group: plugin.namespace().map(|g| {
                GroupId(
                    self.groups
                        .iter()
                        .position(|p| p == g)
                        .expect("registered namespace"),
                )
            }),

            name: plugin.name().to_owned(),

            rules: plugin.rules().iter().map(|r| self.rule_index(r)).collect(),

            text_provider: plugin.has_text_provider().then(provider_index),
            block_policy: plugin.has_block_policy().then(provider_index),
        }
    }
    pub fn describe(&self) -> CatalogDescription {
        let rules = self
            .rules
            .iter()
            .map(|r| RuleSpec {
                name: r.name().map(str::to_owned),
                phase: match r {
                    Contribution::Block(_) => RulePhase::Block,
                    Contribution::Inline(_) => RulePhase::Inline,
                    Contribution::Text(_) => RulePhase::Text,
                },
            })
            .collect::<Vec<_>>();

        let plugins = self
            .plugins
            .iter()
            .map(|p| self.plugin_spec(p))
            .collect::<Vec<_>>();

        CatalogDescription {
            groups: self.group_specs(),
            plugins,
            rules,
            presets: self.presets.clone(),
            exports: self.exports.clone(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RulePhase {
    Block,
    Inline,
    Text,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogDescription {
    pub groups: Vec<GroupSpec>,
    pub plugins: Vec<PluginSpec>,
    pub rules: Vec<RuleSpec>,
    pub presets: Vec<PresetSpec>,
    pub exports: CatalogExports,
}
