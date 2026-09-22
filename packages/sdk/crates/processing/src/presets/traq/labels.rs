//! Display labels shared by source-preserving extraction and plain-text rendering.
use crate::links::Target;
use markdown_trap_contracts::EmbeddingKind;

pub(super) fn for_embedding(kind: EmbeddingKind) -> &'static str {
    match kind {
        EmbeddingKind::File => "[添付ファイル]",
        EmbeddingKind::Message => "[引用メッセージ]",
    }
}

pub(super) fn for_target(target: &Target) -> &'static str {
    let kind = match target {
        Target::File { .. } => EmbeddingKind::File,
        Target::Message { .. } => EmbeddingKind::Message,
    };
    for_embedding(kind)
}
