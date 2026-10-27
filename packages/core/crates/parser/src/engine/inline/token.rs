use crate::{AnyPayload, Node, engine::source::ViewOffset};
use std::num::NonZeroUsize;

/// Syntax-owned matching policy. The engine only pairs accepted runs and
/// caches failed searches within the policy's bounded equivalence classes.
#[derive(Clone, Copy)]
pub struct DelimiterPolicy {
    pub accepts: fn(DelimiterRun, DelimiterRun) -> bool,
    pub cache_class: fn(DelimiterRun) -> u8,
    pub single: fn() -> AnyPayload,
    pub combined: Option<fn() -> AnyPayload>,
}
impl DelimiterPolicy {
    pub const fn simple(single: fn() -> AnyPayload) -> Self {
        Self {
            accepts: |_, _| true,
            cache_class: |_| 0,
            single,
            combined: None,
        }
    }
}
#[derive(Clone, Copy)]
pub struct DelimiterRun {
    pub length: usize,
    pub open: bool,
    pub close: bool,
}

/// Meaning and flanking are supplied by syntax; pairing is owned by the engine.
#[derive(Clone, Copy)]
pub struct Pairing {
    pub marker: u8,
    pub width: NonZeroUsize,
    pub run_length: usize,
    pub open: bool,
    pub close: bool,
    pub policy: DelimiterPolicy,
}

pub struct InlineMatch {
    pub end: ViewOffset,
    pub action: InlineAction,
}

pub enum InlineAction {
    /// Literal source, still eligible for registered text rules.
    Literal,

    /// Decoded display text. Bypasses text rules and joins adjacent text before node creation.
    Text(String),

    Node {
        payload: AnyPayload,
        children: Vec<Node>,
        inhibit_brackets: bool,
    },

    /// Remove trailing literal bytes before emitting a node, e.g. a hard break.
    TrimmedNode {
        trim: usize,
        payload: AnyPayload,
    },

    Delimiter(Pairing),

    OpenBracket {
        tag: &'static str,
        inhibit_on_inner: bool,
    },

    CloseBracket {
        payload: AnyPayload,
        inhibit_brackets: bool,
    },

    DiscardBracket,
}

impl InlineMatch {
    pub fn text(end: ViewOffset, value: String) -> Self {
        Self {
            end,
            action: InlineAction::Text(value),
        }
    }

    pub fn leaf(end: ViewOffset, payload: AnyPayload) -> Self {
        Self {
            end,
            action: InlineAction::Node {
                payload,
                children: vec![],
                inhibit_brackets: false,
            },
        }
    }

    pub fn literal(end: ViewOffset) -> Self {
        Self {
            end,
            action: InlineAction::Literal,
        }
    }
}

#[derive(Clone, Copy)]
pub struct BracketInfo {
    pub label_start: ViewOffset,
    pub tag: &'static str,
    pub active: bool,
}

pub(super) enum TokenKind {
    Text(String),
    Decoded(String),
    Marker(String),
    Atom(AnyPayload, Vec<Node>),
    Open(fn() -> AnyPayload),
    Close,
    Empty,
}

pub(super) struct Token {
    pub start: usize,
    pub end: usize,
    pub kind: TokenKind,
}

#[derive(Clone, Copy)]
pub(super) struct Delimiter {
    pub key: (usize, u8),
    pub length: usize,
    pub token: usize,
    pub open: bool,
    pub close: bool,
    pub end: Option<usize>,
    pub pairing: Pairing,
}

pub(super) struct Bracket {
    pub token: usize,
    pub bottom: usize,
    pub info: BracketInfo,
    pub inhibit_on_inner: bool,
}

impl Delimiter {
    pub fn run(self) -> DelimiterRun {
        DelimiterRun {
            length: self.length,
            open: self.open,
            close: self.close,
        }
    }
}
