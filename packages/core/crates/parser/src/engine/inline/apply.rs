use super::{brackets, scan::State, token::*};

use crate::{
    Node, NodeKind, ParseError,
    engine::{Budget, source::SourceView},
};

pub(super) fn children_budget(nodes: &[Node], budget: &mut Budget) -> Result<(), ParseError> {
    let mut pending: Vec<_> = nodes.iter().collect();
    while let Some(node) = pending.pop() {
        budget.token()?;
        pending.extend(&node.children);
    }
    Ok(())
}

pub(super) fn matched(
    state: &mut State<'_, '_>,
    key: usize,
    found: InlineMatch,
) -> Result<(), ParseError> {
    let start = state.position;
    let end = found.end;

    match found.action {
        InlineAction::Literal => state.literal(end)?,
        InlineAction::Text(value) => state.push(start, end, TokenKind::Decoded(value))?,

        InlineAction::Node {
            kind,
            children,
            inhibit_brackets,
        } => apply_node(state, start, end, kind, children, inhibit_brackets)?,

        InlineAction::TrimmedNode { trim, kind } => {
            apply_trimmed_node(state, start, end, trim, kind)?
        }

        InlineAction::Delimiter(pairing) => apply_delimiter(state, key, start, end, pairing)?,

        InlineAction::OpenBracket {
            tag,
            inhibit_on_inner,
        } => open_bracket(state, start, end, tag, inhibit_on_inner)?,

        InlineAction::CloseBracket {
            kind,
            prefix,
            inhibit_brackets,
        } => brackets::close(state, end, kind, prefix, inhibit_brackets)?,

        InlineAction::DiscardBracket => {
            state.brackets.pop();
            state.literal(end)?;
        }
    }

    state.position = end;

    Ok(())
}

fn apply_node(
    state: &mut State<'_, '_>,
    start: usize,
    end: usize,
    kind: NodeKind,
    children: Vec<Node>,
    inhibit_brackets: bool,
) -> Result<(), ParseError> {
    children_budget(&children, state.budget)?;

    state.push(start, end, TokenKind::Atom(kind, children))?;

    if inhibit_brackets {
        brackets::inhibit(state);
    }

    Ok(())
}

fn apply_trimmed_node(
    state: &mut State<'_, '_>,
    start: usize,
    end: usize,
    trim: usize,
    kind: NodeKind,
) -> Result<(), ParseError> {
    let mut node_start = start;

    if trim > 0 {
        let Some(Token {
            end: previous_end,
            kind: TokenKind::Text(value),
            ..
        }) = state.tokens.last_mut()
        else {
            return Err(ParseError::InternalError);
        };

        if trim > value.len() || trim > start || !value.is_char_boundary(value.len() - trim) {
            return Err(ParseError::InternalError);
        }

        value.truncate(value.len() - trim);
        *previous_end -= trim;
        node_start -= trim;
    }

    state.push(node_start, end, TokenKind::Atom(kind, vec![]))
}

fn apply_delimiter(
    state: &mut State<'_, '_>,
    key: usize,
    start: usize,
    end: usize,
    pairing: Pairing,
) -> Result<(), ParseError> {
    validate_delimiter(state.source, start, end, pairing)?;

    for offset in (0..end - start).step_by(pairing.width) {
        let token = state.tokens.len();

        state.push(
            start + offset,
            start + offset + pairing.width,
            TokenKind::Marker(
                state.source.text[start + offset..start + offset + pairing.width].into(),
            ),
        )?;

        state.delimiters.push(Delimiter {
            key: (key, pairing.marker),
            length: if pairing.rule_of_three {
                pairing.run_length
            } else {
                0
            },
            token,
            open: pairing.open,
            close: pairing.close,
            end: None,
            pairing,
        });
    }

    Ok(())
}

fn validate_delimiter(
    source: &SourceView,
    start: usize,
    end: usize,
    pairing: Pairing,
) -> Result<(), ParseError> {
    if pairing.width == 0 {
        return Err(ParseError::InternalError);
    }

    if !(end - start).is_multiple_of(pairing.width)
        || !source.text.as_bytes()[start..end]
            .iter()
            .all(|byte| *byte == pairing.marker)
    {
        return Err(ParseError::InternalError);
    }

    Ok(())
}

fn open_bracket(
    state: &mut State<'_, '_>,
    start: usize,
    end: usize,
    tag: &'static str,
    inhibit_on_inner: bool,
) -> Result<(), ParseError> {
    state.brackets.push(Bracket {
        token: state.tokens.len(),
        bottom: state.delimiters.len(),
        info: BracketInfo {
            label_start: end,
            tag,
            active: true,
        },
        inhibit_on_inner,
    });

    state.push(
        start,
        end,
        TokenKind::Marker(state.source.text[start..end].into()),
    )
}
