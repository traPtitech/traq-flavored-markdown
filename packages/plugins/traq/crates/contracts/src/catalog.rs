//! Plugin-owned features and payload identities share one catalog.
#[macro_export]
macro_rules! feature_catalog {
    ($consumer:path $(, $argument:ident)*) => {
        $consumer! { $($argument;)*
            "traq";
            Stamp => &$crate::declarations().stamp; [
                $crate::Stamp => "traq.stamp",
            ],
            References => &$crate::declarations().references; [
                $crate::Reference => "traq.reference",
                $crate::Embedding => "traq.embedding",
            ],
            Spoiler => &$crate::declarations().spoiler; [
                $crate::Spoiler => "traq.spoiler",
            ],
            Spacing => &$crate::declarations().spacing; [
                $crate::BlankLine => "traq.blank_line",
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
