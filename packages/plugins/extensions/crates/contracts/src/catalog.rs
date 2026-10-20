//! The generic extension wire contract catalog. Adding a payload starts here.

use markdown_definitions::implement_wire_kinds;

#[macro_export]
macro_rules! node_catalog {
    ($consumer:ident) => {
        $consumer! {
            "generic";
            $crate::InlineMath => "generic.inline_math",
            $crate::BlockMath => "generic.block_math",
            $crate::Table => "generic.table",
            $crate::HeaderRow => "generic.table_header_row",
            $crate::Row => "generic.row",
            $crate::Cell => "generic.cell",
            $crate::Mark => "generic.mark",
            $crate::Strikethrough => "generic.strikethrough",
        }
    };
}

node_catalog!(implement_wire_kinds);
