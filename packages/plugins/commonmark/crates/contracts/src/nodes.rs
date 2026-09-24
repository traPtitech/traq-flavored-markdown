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
    fn role(&self) -> NodeRole {
        NodeRole::Block
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate(&self, children: &[Node]) -> bool {
        inline_children(children)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Heading {
    pub level: u8,
}
impl NodeData for Heading {
    fn role(&self) -> NodeRole {
        NodeRole::Block
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate(&self, children: &[Node]) -> bool {
        (1..=6).contains(&self.level) && inline_children(children)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Blockquote {}
impl NodeData for Blockquote {
    fn role(&self) -> NodeRole {
        NodeRole::Block
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate(&self, children: &[Node]) -> bool {
        block_children(children)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct List {
    pub ordered: bool,
    pub start: u32,
    pub tight: bool,
}
impl NodeData for List {
    fn role(&self) -> NodeRole {
        NodeRole::Block
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate(&self, children: &[Node]) -> bool {
        let Some(first) = children.first().and_then(|node| node.get::<ListItem>()) else {
            return false;
        };
        let Some((ordered, delimiter, start)) = list_marker(&first.marker) else {
            return false;
        };

        if ordered != self.ordered || start != self.start {
            return false;
        }

        children.iter().all(|node| {
            node.get::<ListItem>()
                .and_then(|item| list_marker(&item.marker))
                .is_some_and(|(ordered, item_delimiter, _)| {
                    ordered == self.ordered && item_delimiter == delimiter
                })
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct ListItem {
    pub marker: String,
}
impl NodeData for ListItem {
    fn role(&self) -> NodeRole {
        NodeRole::Structural
    }
    fn payload_bytes(&self) -> usize {
        self.marker.len()
    }
    fn validate(&self, children: &[Node]) -> bool {
        list_marker(&self.marker).is_some() && block_children(children)
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
    fn role(&self) -> NodeRole {
        NodeRole::Block
    }
    fn payload_bytes(&self) -> usize {
        self.info.len().saturating_add(self.literal.len())
    }
    fn validate(&self, _children: &[Node]) -> bool {
        _children.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct ThematicBreak {
    pub marker: String,
}
impl NodeData for ThematicBreak {
    fn role(&self) -> NodeRole {
        NodeRole::Block
    }
    fn payload_bytes(&self) -> usize {
        self.marker.len()
    }
    fn validate(&self, _children: &[Node]) -> bool {
        _children.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Text {
    pub value: String,
}
impl NodeData for Text {
    fn role(&self) -> NodeRole {
        NodeRole::Inline
    }
    fn payload_bytes(&self) -> usize {
        self.value.len()
    }
    fn validate(&self, _children: &[Node]) -> bool {
        _children.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Softbreak {}
impl NodeData for Softbreak {
    fn role(&self) -> NodeRole {
        NodeRole::Inline
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate(&self, _children: &[Node]) -> bool {
        _children.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Hardbreak {}
impl NodeData for Hardbreak {
    fn role(&self) -> NodeRole {
        NodeRole::Inline
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate(&self, _children: &[Node]) -> bool {
        _children.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct InlineCode {
    pub literal: String,
}
impl NodeData for InlineCode {
    fn role(&self) -> NodeRole {
        NodeRole::Inline
    }
    fn payload_bytes(&self) -> usize {
        self.literal.len()
    }
    fn validate(&self, _children: &[Node]) -> bool {
        _children.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Emphasis {}
impl NodeData for Emphasis {
    fn role(&self) -> NodeRole {
        NodeRole::Inline
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate(&self, children: &[Node]) -> bool {
        inline_children(children)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Strong {}
impl NodeData for Strong {
    fn role(&self) -> NodeRole {
        NodeRole::Inline
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate(&self, children: &[Node]) -> bool {
        inline_children(children)
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
    fn role(&self) -> NodeRole {
        NodeRole::Inline
    }
    fn payload_bytes(&self) -> usize {
        self.destination
            .len()
            .saturating_add(self.title.as_ref().map_or(0, String::len))
    }
    fn validate(&self, children: &[Node]) -> bool {
        inline_children(children)
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
    fn role(&self) -> NodeRole {
        NodeRole::Inline
    }
    fn payload_bytes(&self) -> usize {
        self.destination
            .len()
            .saturating_add(self.title.as_ref().map_or(0, String::len))
            .saturating_add(self.label_source.len())
    }
    fn validate(&self, children: &[Node]) -> bool {
        inline_children(children)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct HtmlInline {
    pub literal: String,
}
impl NodeData for HtmlInline {
    fn role(&self) -> NodeRole {
        NodeRole::Inline
    }
    fn payload_bytes(&self) -> usize {
        self.literal.len()
    }
    fn validate(&self, _children: &[Node]) -> bool {
        _children.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct HtmlBlock {
    pub literal: String,
}
impl NodeData for HtmlBlock {
    fn role(&self) -> NodeRole {
        NodeRole::Block
    }
    fn payload_bytes(&self) -> usize {
        self.literal.len()
    }
    fn validate(&self, _children: &[Node]) -> bool {
        _children.is_empty()
    }
}

fn list_marker(marker: &str) -> Option<(bool, u8, u32)> {
    let bytes = marker.as_bytes();
    if let [delimiter @ (b'-' | b'+' | b'*')] = bytes {
        return Some((false, *delimiter, 1));
    }

    let (&delimiter, digits) = bytes.split_last()?;
    if !(2..=10).contains(&bytes.len())
        || !matches!(delimiter, b'.' | b')')
        || !digits.iter().all(u8::is_ascii_digit)
    {
        return None;
    }

    Some((
        true,
        delimiter,
        std::str::from_utf8(digits).ok()?.parse().ok()?,
    ))
}

fn inline_children(children: &[Node]) -> bool {
    children
        .iter()
        .all(|child| child.role() == NodeRole::Inline)
}

fn block_children(children: &[Node]) -> bool {
    children.iter().all(|child| child.role() == NodeRole::Block)
}
