use markdown_ast::{Node, NodeData, NodeRole};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum LinkForm {
    Explicit,
    Autolink,
    Linkify,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Paragraph {}
impl NodeData for Paragraph {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| {
                markdown_ast::NodeStructure::roles(NodeRole::Block, NodeRole::Inline)
            });
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Heading {
    #[cfg_attr(feature = "contracts", schemars(range(min = 1, max = 6)))]
    pub level: u8,
}
impl NodeData for Heading {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| {
                markdown_ast::NodeStructure::roles(NodeRole::Block, NodeRole::Inline)
            });
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate_payload(&self, _children: &[Node]) -> Result<(), markdown_ast::PayloadError> {
        if (1..=6).contains(&self.level) {
            Ok(())
        } else {
            Err(markdown_ast::PayloadError::new("heading level 1..=6")
                .actual(self.level.to_string()))
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Blockquote {}
impl NodeData for Blockquote {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| {
                markdown_ast::NodeStructure::roles(NodeRole::Block, NodeRole::Block)
            });
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct List {
    pub kind: ListKind,
    pub tight: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum ListKind {
    Ordered {
        #[cfg_attr(feature = "contracts", schemars(range(min = 0, max = 999_999_999)))]
        start: u32,
        delimiter: OrderedDelimiter,
    },
    Bullet {
        marker: BulletMarker,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum OrderedDelimiter {
    Period,
    Parenthesis,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
pub enum BulletMarker {
    #[serde(rename = "-")]
    Dash,
    #[serde(rename = "+")]
    Plus,
    #[serde(rename = "*")]
    Asterisk,
}
impl NodeData for List {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| {
                markdown_ast::NodeStructure::children::<ListItem>(NodeRole::Block, true)
            });
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate_payload(&self, _children: &[Node]) -> Result<(), markdown_ast::PayloadError> {
        if let ListKind::Ordered { start, .. } = self.kind
            && start > 999_999_999
        {
            return Err(
                markdown_ast::PayloadError::new("ordered list start 0..=999999999")
                    .actual(start.to_string()),
            );
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct ListItem {}
impl NodeData for ListItem {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| {
                markdown_ast::NodeStructure::roles(NodeRole::Structural, NodeRole::Block)
            });
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct CodeBlock {
    pub fenced: bool,
    pub info: String,
    pub literal: String,
}
impl NodeData for CodeBlock {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| markdown_ast::NodeStructure::leaf(NodeRole::Block));
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        self.info.len().saturating_add(self.literal.len())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct ThematicBreak {
    pub marker: String,
}
impl NodeData for ThematicBreak {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| markdown_ast::NodeStructure::leaf(NodeRole::Block));
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        self.marker.len()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Text {
    pub value: String,
}
impl NodeData for Text {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| markdown_ast::NodeStructure::leaf(NodeRole::Inline));
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        self.value.len()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Softbreak {}
impl NodeData for Softbreak {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| markdown_ast::NodeStructure::leaf(NodeRole::Inline));
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Hardbreak {}
impl NodeData for Hardbreak {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| markdown_ast::NodeStructure::leaf(NodeRole::Inline));
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct InlineCode {
    pub literal: String,
}
impl NodeData for InlineCode {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| markdown_ast::NodeStructure::leaf(NodeRole::Inline));
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        self.literal.len()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Emphasis {}
impl NodeData for Emphasis {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| {
                markdown_ast::NodeStructure::roles(NodeRole::Inline, NodeRole::Inline)
            });
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Strong {}
impl NodeData for Strong {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| {
                markdown_ast::NodeStructure::roles(NodeRole::Inline, NodeRole::Inline)
            });
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Link {
    pub destination: String,
    pub title: Option<String>,
    pub form: LinkForm,
}
impl NodeData for Link {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| {
                markdown_ast::NodeStructure::roles(NodeRole::Inline, NodeRole::Inline)
            });
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        self.destination
            .len()
            .saturating_add(self.title.as_ref().map_or(0, String::len))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Image {
    pub destination: String,
    pub title: Option<String>,
    pub label_source: String,
}
impl NodeData for Image {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| {
                markdown_ast::NodeStructure::roles(NodeRole::Inline, NodeRole::Inline)
            });
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        self.destination
            .len()
            .saturating_add(self.title.as_ref().map_or(0, String::len))
            .saturating_add(self.label_source.len())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct HtmlInline {
    pub literal: String,
}
impl NodeData for HtmlInline {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| markdown_ast::NodeStructure::leaf(NodeRole::Inline));
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        self.literal.len()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct HtmlBlock {
    pub literal: String,
}
impl NodeData for HtmlBlock {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| markdown_ast::NodeStructure::leaf(NodeRole::Block));
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        self.literal.len()
    }
}
