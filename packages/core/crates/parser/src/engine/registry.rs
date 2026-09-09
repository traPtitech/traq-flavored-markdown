use super::{
    GrammarBuilder, Plugin,
    block::BlockRule,
    inline::{InlineRule, TextRule},
};

/// Immutable compiled grammar. Its composition can be edited through a new builder.
#[derive(Clone)]
pub struct Grammar {
    pub(crate) data: std::sync::Arc<Compilation>,
}

pub(crate) struct Compilation {
    pub(crate) definition: GrammarBuilder,
    pub(crate) inline: Vec<InlineRule>,
    pub(crate) block: Vec<BlockRule>,
    pub(crate) text: Vec<TextRule>,
    pub(crate) make_text: super::plugin::TextFactory,
    pub(crate) dispatch: [Vec<usize>; 256],
}

impl Grammar {
    pub fn to_builder(&self) -> GrammarBuilder {
        self.data.definition.clone()
    }

    pub fn plugins(&self) -> &[Plugin] {
        &self.data.definition.plugins
    }

    pub fn describe(&self) -> String {
        self.data.definition.describe()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum BuildError {
    Duplicate { element: String },
    Missing { element: String },
    DuplicateName { scope: String, name: String },
    InvalidDefinition { reason: String },
}

impl std::fmt::Display for BuildError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{self:?}")
    }
}

impl std::error::Error for BuildError {}
