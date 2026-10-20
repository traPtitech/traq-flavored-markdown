use crate::{Node, NodeKind};

/// Syntax-owned matching policy. The engine only pairs accepted runs and
/// caches failed searches within the policy's bounded equivalence classes.
#[derive(Clone, Copy)]
pub struct DelimiterPolicy {
    pub accepts: fn(DelimiterRun, DelimiterRun) -> bool,
    pub cache_class: fn(DelimiterRun) -> u8,
    pub single: fn() -> NodeKind,
    pub combined: Option<fn() -> NodeKind>,
}
impl DelimiterPolicy {
    pub const fn simple(single: fn() -> NodeKind) -> Self {
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
    pub width: usize,
    pub run_length: usize,
    pub open: bool,
    pub close: bool,
    pub policy: DelimiterPolicy,
}

pub struct InlineMatch {
    pub end: usize,
    pub action: InlineAction,
}

pub enum InlineAction {
    /// Literal source, still eligible for registered text rules.
    Literal,

    /// Decoded display text. Bypasses text rules and joins adjacent text before node creation.
    Text(String),

    Node {
        kind: NodeKind,
        children: Vec<Node>,
        inhibit_brackets: bool,
    },

    /// Remove trailing literal bytes before emitting a node, e.g. a hard break.
    TrimmedNode {
        trim: usize,
        kind: NodeKind,
    },

    Delimiter(Pairing),

    OpenBracket {
        tag: &'static str,
        inhibit_on_inner: bool,
    },

    CloseBracket {
        kind: NodeKind,
        inhibit_brackets: bool,
    },

    DiscardBracket,
}

impl InlineMatch {
    pub fn text(end: usize, value: String) -> Self {
        Self {
            end,
            action: InlineAction::Text(value),
        }
    }

    pub fn leaf(end: usize, kind: NodeKind) -> Self {
        Self {
            end,
            action: InlineAction::Node {
                kind,
                children: vec![],
                inhibit_brackets: false,
            },
        }
    }

    pub fn literal(end: usize) -> Self {
        Self {
            end,
            action: InlineAction::Literal,
        }
    }
}

#[derive(Clone, Copy)]
pub struct BracketInfo {
    pub label_start: usize,
    pub tag: &'static str,
    pub active: bool,
}

pub(super) enum TokenKind {
    Text(String),
    Decoded(String),
    Marker(String),
    Atom(NodeKind, Vec<Node>),
    Open(fn() -> NodeKind),
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
