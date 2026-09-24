//! The traQ wire contract catalog. Adding a payload starts here.

use markdown_definitions::implement_wire_kinds;

#[macro_export]
macro_rules! node_catalog {
    ($consumer:ident) => {
        $consumer! {
            "trap";
            $crate::StampData => "traq.stamp",
            $crate::ReferenceData => "traq.reference",
            $crate::EmbeddingData => "traq.embedding",
            $crate::SpoilerData => "traq.spoiler",
            $crate::BlankLineData => "traq.blank_line",
        }
    };
}

node_catalog!(implement_wire_kinds);
