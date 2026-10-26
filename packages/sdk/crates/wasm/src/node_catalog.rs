//! This distribution selects plugin-owned catalogs, never individual payloads.
macro_rules! selected_node_catalogs {
    ($consumer:ident) => {
        markdown_commonmark_contracts::node_catalog!($consumer);
        markdown_extensions_contracts::node_catalog!($consumer);
        markdown_traq_contracts::node_catalog!($consumer);
    };
}
