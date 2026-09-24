//! This distribution selects plugin-owned catalogs, never individual payloads.
macro_rules! selected_node_catalogs {
    ($consumer:ident) => {
        markdown_commonmark_contracts::node_catalog!($consumer);
        markdown_generic_contracts::node_catalog!($consumer);
        markdown_trap_contracts::node_catalog!($consumer);
    };
}
