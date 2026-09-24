//! The generic extension wire contract catalog. Adding a payload starts here.

use markdown_definitions::implement_wire_kinds;

#[macro_export]
macro_rules! node_catalog {
    ($consumer:ident) => {
        $consumer! {
            "generic";
            $crate::InlineMathData => "generic.inline_math",
            $crate::BlockMathData => "generic.block_math",
            $crate::TableData => "generic.table",
            $crate::RowData => "generic.row",
            $crate::CellData => "generic.cell",
            $crate::MarkData => "generic.mark",
            $crate::StrikethroughData => "generic.strikethrough",
        }
    };
}

node_catalog!(implement_wire_kinds);
