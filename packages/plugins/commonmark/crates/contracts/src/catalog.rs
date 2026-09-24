//! The CommonMark wire contract catalog. Adding a payload starts here.

use markdown_definitions::implement_wire_kinds;

#[macro_export]
macro_rules! node_catalog {
    ($consumer:ident) => {
        $consumer! {
            "commonmark";
            $crate::Paragraph => "commonmark.paragraph",
            $crate::Heading => "commonmark.heading",
            $crate::Blockquote => "commonmark.blockquote",
            $crate::List => "commonmark.list",
            $crate::ListItem => "commonmark.list_item",
            $crate::CodeBlock => "commonmark.code_block",
            $crate::ThematicBreak => "commonmark.thematic_break",
            $crate::Text => "commonmark.text",
            $crate::Softbreak => "commonmark.softbreak",
            $crate::Hardbreak => "commonmark.hardbreak",
            $crate::InlineCode => "commonmark.inline_code",
            $crate::Emphasis => "commonmark.emphasis",
            $crate::Strong => "commonmark.strong",
            $crate::Link => "commonmark.link",
            $crate::Image => "commonmark.image",
            $crate::HtmlInline => "commonmark.html_inline",
            $crate::HtmlBlock => "commonmark.html_block",
        }
    };
}

node_catalog!(implement_wire_kinds);
