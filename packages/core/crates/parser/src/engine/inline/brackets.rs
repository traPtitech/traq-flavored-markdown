use super::{delimiters, scan::State, token::TokenKind, tree};
use crate::{NodeKind, ParseError};

pub(super) fn inhibit(state: &mut State<'_, '_>) {
    for bracket in &mut state.brackets {
        if bracket.inhibit_on_inner {
            bracket.info.active = false;
        }
    }
}

pub(super) fn close(
    state: &mut State<'_, '_>,
    end: usize,
    kind: NodeKind,
    prefix: usize,
    inhibit: bool,
) -> Result<(), ParseError> {
    let bracket = state.brackets.pop().ok_or(ParseError::InternalError)?;

    if !bracket.info.active {
        return Err(ParseError::InternalError);
    }

    let mut delimiters = state.delimiters.split_off(bracket.bottom);
    delimiters::balance(&mut state.tokens, &mut delimiters, state.budget)?;

    let children = tree::build(
        state.tokens.split_off(bracket.token + 1),
        state.source,
        state.make_text,
        state.budget,
    )?;

    let opening = state.tokens.pop().ok_or(ParseError::InternalError)?;
    let mut start = opening.start;

    if prefix > 0 {
        if prefix >= opening.end - start || !state.source.text.is_char_boundary(start + prefix) {
            return Err(ParseError::InternalError);
        }

        state.push(
            start,
            start + prefix,
            TokenKind::Text(state.source.text[start..start + prefix].into()),
        )?;

        start += prefix;
    }

    state.push(start, end, TokenKind::Atom(kind, children))?;

    if inhibit {
        self::inhibit(state);
    }

    Ok(())
}
