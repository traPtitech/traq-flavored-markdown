use serde::{Deserialize, Serialize};

#[markdown_definitions::payload]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum LinkForm {
    Explicit,
    Autolink,
    Linkify,
}

#[markdown_definitions::node(role = Block, children = Inline)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Paragraph {}

#[markdown_definitions::node(role = Block, children = Inline)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Heading {
    #[constraint(range(min = 1, max = 6))]
    pub level: u8,
}

#[markdown_definitions::node(role = Block, children = Block)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Blockquote {}

#[markdown_definitions::node(role = Block, child_type = ListItem, nonempty)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct List {
    pub kind: ListKind,
    pub tight: bool,
}

#[markdown_definitions::payload]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum ListKind {
    Ordered {
        #[constraint(range(min = 0, max = 999_999_999))]
        start: u32,
        delimiter: OrderedDelimiter,
    },
    Bullet {
        marker: BulletMarker,
    },
}

#[markdown_definitions::payload]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum OrderedDelimiter {
    Period,
    Parenthesis,
}

#[markdown_definitions::payload]
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

#[markdown_definitions::node(role = Structural, children = Block)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct ListItem {}

#[markdown_definitions::node(role = Block)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct CodeBlock {
    pub fenced: bool,
    /// Decoded CommonMark info string. Authored notation remains in the source span.
    pub info: String,
    pub literal: String,
}

#[markdown_definitions::node(role = Block)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct ThematicBreak {
    pub marker: String,
}

#[markdown_definitions::node(role = Inline)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Text {
    pub value: String,
}

#[markdown_definitions::node(role = Inline)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Softbreak {}

#[markdown_definitions::node(role = Inline)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Hardbreak {}

#[markdown_definitions::node(role = Inline)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct InlineCode {
    pub literal: String,
}

#[markdown_definitions::node(role = Inline, children = Inline)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Emphasis {}

#[markdown_definitions::node(role = Inline, children = Inline)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Strong {}

#[markdown_definitions::node(role = Inline, children = Inline)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Link {
    pub destination: String,
    pub title: Option<String>,
    pub form: LinkForm,
}

#[markdown_definitions::node(role = Inline, children = Inline)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Image {
    pub destination: String,
    pub title: Option<String>,
    pub label_source: String,
}

#[markdown_definitions::node(role = Inline)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct HtmlInline {
    pub literal: String,
}

#[markdown_definitions::node(role = Block)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct HtmlBlock {
    pub literal: String,
}
