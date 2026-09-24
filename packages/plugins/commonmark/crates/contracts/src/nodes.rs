use markdown_ast::{Node, NodeData};
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
    fn validate(&self, children: &[Node]) -> bool {
        (1..=6).contains(&self.level) && inline_children(children)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Blockquote {}
impl NodeData for Blockquote {
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
    fn validate(&self, _children: &[Node]) -> bool {
        _children.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Softbreak {}
impl NodeData for Softbreak {
    fn validate(&self, _children: &[Node]) -> bool {
        _children.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Hardbreak {}
impl NodeData for Hardbreak {
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
    fn validate(&self, _children: &[Node]) -> bool {
        _children.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Emphasis {}
impl NodeData for Emphasis {
    fn validate(&self, children: &[Node]) -> bool {
        inline_children(children)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Strong {}
impl NodeData for Strong {
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
    fn validate(&self, _children: &[Node]) -> bool {
        _children.is_empty()
    }
}

fn known_block(node: &Node) -> bool {
    node.get::<Paragraph>().is_some()
        || node.get::<Heading>().is_some()
        || node.get::<Blockquote>().is_some()
        || node.get::<List>().is_some()
        || node.get::<ListItem>().is_some()
        || node.get::<CodeBlock>().is_some()
        || node.get::<ThematicBreak>().is_some()
        || node.get::<HtmlBlock>().is_some()
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

fn known_inline(node: &Node) -> bool {
    node.get::<Text>().is_some()
        || node.get::<Softbreak>().is_some()
        || node.get::<Hardbreak>().is_some()
        || node.get::<InlineCode>().is_some()
        || node.get::<Emphasis>().is_some()
        || node.get::<Strong>().is_some()
        || node.get::<Link>().is_some()
        || node.get::<Image>().is_some()
        || node.get::<HtmlInline>().is_some()
}

fn inline_children(children: &[Node]) -> bool {
    children.iter().all(|child| !known_block(child))
}

fn block_children(children: &[Node]) -> bool {
    children
        .iter()
        .all(|child| !known_inline(child) && child.get::<ListItem>().is_none())
}
