use super::token::{Token, TokenKind};

use crate::{
    Node, ParseError,
    engine::{Budget, plugin::TextFactory, source::SourceView},
};

/// Join strings before creating payloads. Opaque nodes always form a boundary.
pub(super) fn build(
    tokens: Vec<Token>,
    source: &SourceView,
    make_text: &TextFactory,
    budget: &mut Budget,
) -> Result<Vec<Node>, ParseError> {
    let mut stack = vec![];
    let mut children = vec![];
    let mut text: Option<(usize, usize, String)> = None;

    for token in tokens {
        budget.spend(1)?;
        let kind = match token.kind {
            TokenKind::Empty => continue,

            TokenKind::Text(value) | TokenKind::Decoded(value) | TokenKind::Marker(value) => {
                if !value.is_empty() {
                    if let Some((_, end, previous)) = &mut text {
                        previous.push_str(&value);
                        *end = token.end;
                    } else {
                        text = Some((token.start, token.end, value));
                    }
                }
                continue;
            }

            kind => kind,
        };

        flush(&mut text, &mut children, source, make_text);

        match kind {
            TokenKind::Atom(kind, nested) => {
                children.push(Node::new(source.span(token.start, token.end), kind, nested));
            }

            TokenKind::Open(make, combined) => {
                budget.depth(stack.len() + 1)?;
                stack.push((make, combined, token.start, std::mem::take(&mut children)));
            }

            TokenKind::Close => {
                let (make, combined, start, previous) =
                    stack.pop().ok_or(ParseError::InternalError)?;
                let nested = std::mem::replace(&mut children, previous);
                children.push(Node::new(
                    source.span(start, token.end),
                    make(combined),
                    nested,
                ));
            }

            _ => unreachable!("text and empty tokens handled above"),
        }
    }

    flush(&mut text, &mut children, source, make_text);

    if !stack.is_empty() {
        return Err(ParseError::InternalError);
    }

    Ok(children)
}

fn flush(
    text: &mut Option<(usize, usize, String)>,
    children: &mut Vec<Node>,
    source: &SourceView,
    make_text: &TextFactory,
) {
    if let Some((start, end, value)) = text.take() {
        children.push(Node::leaf(source.span(start, end), make_text(value)));
    }
}
