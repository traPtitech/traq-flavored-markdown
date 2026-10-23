//! Extension payloads use the `extensions.*` wire namespace.

use markdown_definitions::implement_wire_kinds;

#[macro_export]
macro_rules! node_catalog {
    ($consumer:ident) => {
        $consumer! {
            "extensions";
            $crate::InlineMath => "extensions.inline_math",
            $crate::BlockMath => "extensions.block_math",
            $crate::Table => "extensions.table",
            $crate::HeaderRow => "extensions.table_header_row",
            $crate::Row => "extensions.row",
            $crate::Cell => "extensions.cell",
            $crate::Mark => "extensions.mark",
            $crate::Strikethrough => "extensions.strikethrough",
        }
    };
}

node_catalog!(implement_wire_kinds);
