use super::{
    apply::children_budget,
    rules::TextRule,
    scan::TextInput,
    token::{Token, TokenKind},
};

use crate::{
    ParseError,
    engine::{Budget, Grammar, ParsePhase, source::SourceView},
};

pub(super) fn process(
    tokens: Vec<Token>,
    source: &SourceView,
    grammar: &Grammar,
    budget: &mut Budget,
) -> Result<Vec<Token>, ParseError> {
    let mut joined = join_text_tokens(tokens);

    for entry in &grammar.data.text {
        joined = process_rule(joined, source, entry, budget)?;
    }

    Ok(joined)
}

fn join_text_tokens(tokens: Vec<Token>) -> Vec<Token> {
    let mut joined = vec![];

    for mut token in tokens {
        if let TokenKind::Marker(value) = token.kind {
            token.kind = TokenKind::Text(value);
        }

        if matches!(token.kind, TokenKind::Empty) {
            continue;
        }

        if let TokenKind::Text(value) = &token.kind
            && let Some(Token {
                end,
                kind: TokenKind::Text(previous),
                ..
            }) = joined.last_mut()
            && *end == token.start
        {
            previous.push_str(value);
            *end = token.end;
            continue;
        }

        joined.push(token);
    }

    joined
}

fn process_rule(
    tokens: Vec<Token>,
    source: &SourceView,
    entry: &TextRule,
    budget: &mut Budget,
) -> Result<Vec<Token>, ParseError> {
    let mut result = vec![];
    let mut special = false;

    for token in tokens {
        let TokenKind::Text(ref value) = token.kind else {
            special = matches!(token.kind, TokenKind::Decoded(_));
            result.push(token);
            continue;
        };
        budget.spend(value.len())?;

        let input = TextInput {
            source,
            range: source.range(token.start..token.end)?,
            after_decoded_text: special,
        };

        let position = source.source_offset(input.range.start)?.get();
        let matches = (entry.data.implementation.parse)(&input, budget)
            .map_err(|error| error.at_rule(ParsePhase::Text, entry.name(), position))?;
        let mut begin = token.start;

        for found in matches {
            let start = found.start.get();
            let end = found.end.get();
            if start < begin
                || start >= end
                || end > token.end
                || !source.text().is_char_boundary(start)
                || !source.text().is_char_boundary(end)
            {
                return Err(ParseError::invalid_rule(
                    ParsePhase::Text,
                    entry.name(),
                    position,
                    format!(
                        "text match {}..{} must follow {begin}, stay within {}, and use UTF-8 boundaries",
                        start, end, token.end
                    ),
                ));
            }

            if start > begin {
                budget.token()?;
                result.push(Token {
                    start: begin,
                    end: start,
                    kind: TokenKind::Text(source.text()[begin..start].into()),
                });
            }

            budget.token()?;
            children_budget(&found.children, budget)?;

            result.push(Token {
                start,
                end,
                kind: TokenKind::Atom(found.payload, found.children),
            });

            begin = end;
        }

        if begin < token.end {
            result.push(Token {
                start: begin,
                end: token.end,
                kind: TokenKind::Text(source.text()[begin..token.end].into()),
            });
        }

        special = false;
    }

    Ok(result)
}
