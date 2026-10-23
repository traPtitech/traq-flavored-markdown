use super::{PluginId, PresetId};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub type ExportTree<Id> = BTreeMap<String, ExportEntry<Id>>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ExportEntry<Id> {
    Id(Id),
    Group(ExportTree<Id>),
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CatalogExports {
    pub plugins: BTreeMap<String, BTreeMap<String, PluginId>>,
    pub presets: ExportTree<PresetId>,
}
