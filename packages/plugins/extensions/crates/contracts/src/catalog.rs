//! Plugin-owned features and payload identities share one catalog.
#[macro_export]
macro_rules! feature_catalog {
    ($consumer:path $(, $argument:ident)*) => {
        $consumer! { $($argument;)*
            "extensions";
            Math => &$crate::declarations().math; [
                $crate::InlineMath => "extensions.inline_math",
                $crate::BlockMath => "extensions.block_math",
            ],
            Table => &$crate::declarations().table; [
                $crate::Table => "extensions.table",
                $crate::HeaderRow => "extensions.table_header_row",
                $crate::Row => "extensions.row",
                $crate::Cell => "extensions.cell",
            ],
            Mark => &$crate::declarations().mark; [
                $crate::Mark => "extensions.mark",
            ],
            Strikethrough => &$crate::declarations().strikethrough; [
                $crate::Strikethrough => "extensions.strikethrough",
            ],
            Linkify => &$crate::declarations().linkify; [

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
