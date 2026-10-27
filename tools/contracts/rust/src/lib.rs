//! Development-only contract collection. Runtime crates do not depend on exporters.
#![forbid(unsafe_code)]

mod manifest;
mod structure;
pub use manifest::*;
pub use structure::{ChildContract, StructureContract};

use markdown_ast::{NodeData, NodeStructure};
use schemars::{JsonSchema, generate::Contract};
use std::{
    any::TypeId,
    collections::{BTreeMap, HashMap},
    path::Path,
};

pub type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

pub fn schema<T: JsonSchema>(direction: Contract) -> serde_json::Value {
    let schema = schemars::generate::SchemaSettings::default()
        .with(|settings| settings.contract = direction)
        .into_generator()
        .into_root_schema_for::<T>();
    serde_json::to_value(schema).expect("schema is JSON")
}

struct PendingNode {
    group: String,
    schema: serde_json::Value,
    structure: &'static NodeStructure,
}

/// Collect every native identity first, then resolve cross-node structural references.
#[derive(Default)]
pub struct NodeExporter {
    identities: HashMap<TypeId, String>,
    nodes: BTreeMap<String, PendingNode>,
}

impl NodeExporter {
    pub fn register<T: NodeData + JsonSchema>(&mut self, group: &str, kind: &str) -> Result<()> {
        if self.identities.contains_key(&TypeId::of::<T>()) || self.nodes.contains_key(kind) {
            return Err(format!("duplicate node contract: {kind}").into());
        }
        self.identities.insert(TypeId::of::<T>(), kind.into());
        self.nodes.insert(
            kind.into(),
            PendingNode {
                group: group.into(),
                schema: schema::<T>(Contract::Serialize),
                structure: T::structure(),
            },
        );
        Ok(())
    }

    pub fn finish(self) -> Result<NodeManifest> {
        let nodes = self
            .nodes
            .into_iter()
            .map(|(kind, node)| {
                Ok((
                    kind,
                    NodeContract {
                        group: node.group,
                        schema: node.schema,
                        structure: structure::export(node.structure, &self.identities)?,
                    },
                ))
            })
            .collect::<Result<_>>()?;
        Ok(NodeManifest { nodes })
    }
}

pub fn write(directory: impl AsRef<Path>, manifest: &impl serde::Serialize) -> Result<()> {
    std::fs::create_dir_all(directory.as_ref())?;
    std::fs::write(
        directory.as_ref().join("contracts.json"),
        serde_json::to_vec_pretty(manifest)?,
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use markdown_ast::NodeRole;
    use std::sync::LazyLock;

    #[derive(Clone, Debug, PartialEq, JsonSchema)]
    struct Leaf;
    impl NodeData for Leaf {
        fn structure() -> &'static NodeStructure {
            static STRUCTURE: NodeStructure = NodeStructure::leaf(NodeRole::Opaque);
            &STRUCTURE
        }
        fn payload_bytes(&self) -> usize {
            0
        }
    }
    #[derive(Clone, Debug, PartialEq, JsonSchema)]
    struct Container;
    impl NodeData for Container {
        fn payload_bytes(&self) -> usize {
            0
        }
        fn structure() -> &'static NodeStructure {
            static STRUCTURE: LazyLock<NodeStructure> =
                LazyLock::new(|| NodeStructure::children::<Leaf>(NodeRole::Block, false));
            &STRUCTURE
        }
    }

    #[test]
    fn rejects_duplicate_native_and_wire_identities() {
        let mut exporter = NodeExporter::default();
        exporter.register::<Leaf>("group", "leaf").unwrap();
        assert!(exporter.register::<Leaf>("group", "other").is_err());
        assert!(exporter.register::<Container>("group", "leaf").is_err());
        assert_eq!(exporter.finish().unwrap().nodes.len(), 1);
    }

    #[test]
    fn resolves_forward_references_and_rejects_missing_payloads() {
        let mut exporter = NodeExporter::default();
        exporter
            .register::<Container>("group", "container")
            .unwrap();
        assert!(exporter.finish().is_err());
        let mut exporter = NodeExporter::default();
        exporter
            .register::<Container>("group", "container")
            .unwrap();
        exporter.register::<Leaf>("group", "leaf").unwrap();
        let value = serde_json::to_value(exporter.finish().unwrap()).unwrap();
        assert_eq!(
            value["nodes"]["container"]["structure"]["children"]["types"],
            serde_json::json!(["leaf"])
        );
    }
}
