use markdown_extractor::{Plugin, Result};
use markdown_trap_contracts::{EmbeddingData, EmbeddingKind, ReferenceData, ReferenceKind};
use serde::Serialize;

#[derive(Debug, PartialEq, Serialize)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct EmbeddedInfo {
    pub raw: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub id: String,
}

#[derive(Debug, Default, PartialEq, Serialize)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct References {
    pub mentions: Vec<String>,
    pub group_mentions: Vec<String>,
    pub channel_links: Vec<String>,
    pub embeddings: Vec<EmbeddedInfo>,
}

/// Repeated calls share the default implementation; editing a value is isolated.
pub fn plugin() -> Plugin<References> {
    static PLUGIN: std::sync::LazyLock<Plugin<References>> =
        std::sync::LazyLock::new(|| build().expect("valid reference extraction plugin"));
    PLUGIN.clone()
}

fn build() -> Result<Plugin<References>> {
    let mut plugin = Plugin::<References>::new(&markdown_trap_contracts::preset().references);

    plugin.on::<ReferenceData>(|reference, result| {
        add_reference(reference, result);
        Ok(())
    })?;

    plugin.on::<EmbeddingData>(|embedding, result| {
        add_embedding(embedding, result);
        Ok(())
    })?;

    Ok(plugin)
}

fn add_reference(reference: &ReferenceData, result: &mut References) {
    if !reference.id.is_empty() {
        result.embeddings.push(EmbeddedInfo {
            raw: reference.label.clone(),
            kind: match reference.target {
                ReferenceKind::User => "user",
                ReferenceKind::Group => "group",
                ReferenceKind::Channel => "channel",
            }
            .into(),
            id: reference.id.clone(),
        });
    }

    if let Some(id) = crate::uuid::normalize(&reference.id) {
        let ids = match reference.target {
            ReferenceKind::User => &mut result.mentions,
            ReferenceKind::Group => &mut result.group_mentions,
            ReferenceKind::Channel => &mut result.channel_links,
        };

        // Preserve document order and duplicates, including inside spoilers.
        ids.push(id);
    }
}

fn add_embedding(embedding: &EmbeddingData, result: &mut References) {
    if !embedding.id.is_empty() {
        result.embeddings.push(EmbeddedInfo {
            raw: embedding.label.clone(),
            kind: match embedding.target {
                EmbeddingKind::File => "file",
                EmbeddingKind::Message => "message",
            }
            .into(),
            id: embedding.id.clone(),
        });
    }
}
