use super::{
    block::BlockRule,
    inline::{InlineRule, TextRule},
};

#[derive(Clone)]
pub enum Contribution {
    Inline(InlineRule),
    Block(BlockRule),
    Text(TextRule),
}

impl From<InlineRule> for Contribution {
    fn from(rule: InlineRule) -> Self {
        Self::Inline(rule)
    }
}

impl From<BlockRule> for Contribution {
    fn from(rule: BlockRule) -> Self {
        Self::Block(rule)
    }
}

impl From<TextRule> for Contribution {
    fn from(rule: TextRule) -> Self {
        Self::Text(rule)
    }
}

impl From<&InlineRule> for Contribution {
    fn from(rule: &InlineRule) -> Self {
        Self::Inline(rule.clone())
    }
}

impl From<&BlockRule> for Contribution {
    fn from(rule: &BlockRule) -> Self {
        Self::Block(rule.clone())
    }
}

impl From<&TextRule> for Contribution {
    fn from(rule: &TextRule) -> Self {
        Self::Text(rule.clone())
    }
}

impl Contribution {
    pub(crate) fn name(&self) -> Option<&str> {
        match self {
            Self::Inline(r) => r.name(),
            Self::Block(r) => r.name(),
            Self::Text(r) => r.name(),
        }
    }

    pub(crate) fn phase(&self) -> &'static str {
        match self {
            Self::Inline(_) => "inline",
            Self::Block(_) => "block",
            Self::Text(_) => "text",
        }
    }

    pub(crate) fn same(&self, other: &Self) -> bool {
        match (self, other) {
            (Self::Inline(a), Self::Inline(b)) => a.same(b),
            (Self::Block(a), Self::Block(b)) => a.same(b),
            (Self::Text(a), Self::Text(b)) => a.same(b),
            _ => false,
        }
    }

    pub(crate) fn description(&self) -> String {
        match self {
            Self::Inline(r) => r.description(),
            Self::Block(r) => r.description(),
            Self::Text(r) => r.description(),
        }
    }
}
