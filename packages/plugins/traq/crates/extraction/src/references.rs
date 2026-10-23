use markdown_extractor::{Plugin, Result};
use markdown_trap_contracts::{Embedding, EmbeddingKind, Reference, ReferenceKind};
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum EmbeddedKind {
    User,
    Group,
    Channel,
    File,
    Message,
}

#[derive(Debug, PartialEq, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EmbeddedInfo {
    pub raw: String,
    #[serde(rename = "type")]
    pub kind: EmbeddedKind,
    pub id: String,
}

#[derive(Debug, Default, PartialEq, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
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
    let mut plugin = Plugin::<References>::new(&markdown_trap_contracts::declarations().references);

    plugin.on::<Reference>(|reference, _, result| {
        result.record_reference(reference);
        Ok(())
    })?;

    plugin.on::<Embedding>(|embedding, _, result| {
        result.record_embedding(embedding);
        Ok(())
    })?;

    Ok(plugin)
}

impl References {
    /// Record one reference in document order, preserving duplicates.
    pub fn record_reference(&mut self, reference: &Reference) {
        if !reference.id.is_empty() {
            self.embeddings.push(EmbeddedInfo {
                raw: reference.label.clone(),
                kind: match reference.target {
                    ReferenceKind::User => EmbeddedKind::User,
                    ReferenceKind::Group => EmbeddedKind::Group,
                    ReferenceKind::Channel => EmbeddedKind::Channel,
                },
                id: reference.id.as_str().to_owned(),
            });
        }

        if let Some(id) = reference.id.canonical() {
            let ids = match reference.target {
                ReferenceKind::User => &mut self.mentions,
                ReferenceKind::Group => &mut self.group_mentions,
                ReferenceKind::Channel => &mut self.channel_links,
            };

            ids.push(id.to_string());
        }
    }

    /// Record one embedding in document order.
    pub fn record_embedding(&mut self, embedding: &Embedding) {
        if !embedding.id.is_empty() {
            self.embeddings.push(EmbeddedInfo {
                raw: embedding.label.clone(),
                kind: match embedding.target {
                    EmbeddingKind::File => EmbeddedKind::File,
                    EmbeddingKind::Message => EmbeddedKind::Message,
                },
                id: embedding.id.as_str().to_owned(),
            });
        }
    }
}
