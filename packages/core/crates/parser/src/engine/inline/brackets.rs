use super::{delimiters, scan::State, token::TokenKind, tree};
use crate::{AnyPayload, ParseError};

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
    kind: AnyPayload,
    inhibit: bool,
    syntax: Option<crate::syntax::SourceSyntax>,
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

    let syntax = match syntax {
        Some(syntax) => Some(syntax),

        None => state.source.syntax(
            &[state.source.range(opening.end..state.position)?],
            &[
                (
                    crate::syntax::MarkerKind::Open,
                    state.source.range(opening.start..opening.end)?,
                ),
                (
                    crate::syntax::MarkerKind::Close,
                    state.source.range(state.position..end)?,
                ),
            ],
            state.budget,
        )?,
    };

    state.push(opening.start, end, TokenKind::Atom(kind, children, syntax))?;

    if inhibit {
        self::inhibit(state);
    }

    Ok(())
}
