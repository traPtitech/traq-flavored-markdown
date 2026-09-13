use markdown_parser::{
    NodeKind, ParseError,
    engine::{
        Budget,
        inline::{InlineAction, InlineInput, InlineMatch, Pairing},
    },
};

use unicode_general_category::{GeneralCategory as G, get_general_category};

pub fn whitespace(ch: char) -> bool {
    matches!(
        ch,
        '\t'..='\r'
            | ' '
            | '\u{a0}'
            | '\u{1680}'
            | '\u{2000}'..='\u{200a}'
            | '\u{202f}'
            | '\u{205f}'
            | '\u{3000}'
    )
}

pub fn punctuation(ch: char) -> bool {
    ch.is_ascii_punctuation()
        || matches!(
            get_general_category(ch),
            G::ConnectorPunctuation
                | G::DashPunctuation
                | G::OpenPunctuation
                | G::ClosePunctuation
                | G::InitialPunctuation
                | G::FinalPunctuation
                | G::OtherPunctuation
                | G::MathSymbol
                | G::CurrencySymbol
                | G::ModifierSymbol
                | G::OtherSymbol
        )
}

fn flanking(prev: char, next: char, marker: u8) -> (bool, bool) {
    let left = !whitespace(next) && (!punctuation(next) || whitespace(prev) || punctuation(prev));
    let right = !whitespace(prev) && (!punctuation(prev) || whitespace(next) || punctuation(next));
    (
        left && (marker != b'_' || !right || punctuation(prev)),
        right && (marker != b'_' || !left || punctuation(next)),
    )
}

/// CommonMark-style flanking reused by paired extensions; odd suffixes remain.
pub fn paired(
    input: &InlineInput<'_>,
    budget: &mut Budget,
    width: usize,
    rule_of_three: bool,
    combine: bool,
    make: fn(bool) -> NodeKind,
) -> Result<Option<InlineMatch>, ParseError> {
    let source = &input.source.text();
    let pos = input.position;
    let marker = source.as_bytes()[pos];
    let mut end = pos;
    while source.as_bytes().get(end) == Some(&marker) {
        budget.spend(1)?;
        end += 1;
    }
    let length = end - pos;
    if length < width {
        return Ok(None);
    }
    let prev = source[..pos].chars().next_back().unwrap_or(' ');
    let next = source[end..].chars().next().unwrap_or(' ');
    let (open, close) = flanking(prev, next, marker);
    let pairing = Pairing {
        marker,
        width,
        run_length: length,
        open,
        close,
        rule_of_three,
        combine_pairs: combine,
        make,
    };
    Ok(Some(InlineMatch {
        end: pos + length / width * width,
        action: InlineAction::Delimiter(pairing),
    }))
}

pub(super) fn emphasis(
    input: &InlineInput<'_>,
    budget: &mut Budget,
) -> Result<Option<InlineMatch>, ParseError> {
    paired(input, budget, 1, true, true, |strong| {
        if strong {
            NodeKind::new(markdown_commonmark_contracts::Strong {})
        } else {
            NodeKind::new(markdown_commonmark_contracts::Emphasis {})
        }
    })
}
