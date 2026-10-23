//! Plugin-owned features and payload identities share one catalog.
#[macro_export]
macro_rules! feature_catalog {
    ($consumer:path $(, $argument:ident)*) => {
        $consumer! { $($argument;)*
            "commonmark";
            Core => &$crate::declarations().plugin; [
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
            ],
            Html => &$crate::declarations().html; [
                $crate::HtmlInline => "commonmark.html_inline",
                $crate::HtmlBlock => "commonmark.html_block",
            ],
        }
    };
}

#[macro_export]
macro_rules! node_catalog {
    ($consumer:ident) => {
        $crate::feature_catalog!(markdown_definitions::nodes_from_features, $consumer);
    };
}
feature_catalog!(markdown_definitions::define_feature_contracts);
