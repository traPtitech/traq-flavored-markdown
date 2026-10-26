use super::{apply, delimiters, text, token::*, tree};

use crate::{
    AnyPayload, Node,
    engine::{
        Budget, Grammar, ParseError, ParsePhase, ParseState,
        source::{SourceView, ViewOffset, ViewRange},
    },
};

use std::any::Any;

pub struct InlineInput<'a> {
    pub source: &'a SourceView,
    pub position: ViewOffset,
    pub bracket: Option<BracketInfo>,
    pub inside_brackets: bool,
    pub trailing_text: &'a str,
    pub(crate) state: &'a ParseState,
}

impl InlineInput<'_> {
    pub fn tail(&self) -> &str {
        &self.source.text()[self.position.get()..]
    }

    pub fn state<T: Any>(&self) -> Option<&T> {
        self.state.get::<T>()
    }
}

pub struct TextInput<'a> {
    pub source: &'a SourceView,
    pub range: ViewRange,
    pub after_decoded_text: bool,
}

impl TextInput<'_> {
    pub fn text(&self) -> &str {
        &self.source[self.range.clone()]
    }
}

pub struct TextMatch {
    pub start: ViewOffset,
    pub end: ViewOffset,
    pub payload: AnyPayload,
    pub children: Vec<Node>,
}

pub(super) struct State<'a, 'b> {
    pub source: &'a SourceView,
    pub make_text: &'a crate::engine::plugin::TextFactory,
    pub budget: &'b mut Budget,
    pub position: usize,
    pub tokens: Vec<Token>,
    pub delimiters: Vec<Delimiter>,
    pub brackets: Vec<Bracket>,
}

impl State<'_, '_> {
    pub fn push(&mut self, start: usize, end: usize, kind: TokenKind) -> Result<(), ParseError> {
        self.budget.token()?;
        self.tokens.push(Token { start, end, kind });
        Ok(())
    }

    pub fn literal(&mut self, end: usize) -> Result<(), ParseError> {
        let value = &self.source.text()[self.position..end];

        if let Some(Token {
            end: previous_end,
            kind: TokenKind::Text(previous),
            ..
        }) = self.tokens.last_mut()
        {
            previous.push_str(value);
            *previous_end = end;
        } else {
            self.push(self.position, end, TokenKind::Text(value.into()))?;
        }

        Ok(())
    }
}

pub(crate) fn parse(
    source: &SourceView,
    grammar: &Grammar,
    budget: &mut Budget,
    parse_state: &ParseState,
) -> Result<Vec<Node>, ParseError> {
    let mut state = State {
        source,
        make_text: &grammar.data.make_text,
        budget,
        position: 0,
        tokens: vec![],
        delimiters: vec![],
        brackets: vec![],
    };

    while state.position < source.text().len() {
        state.budget.spend(1)?;
        let (key, result) = find_match(&mut state, grammar, parse_state)?;
        let rule = key.map(|key| &grammar.data.inline[key]);
        let position = source.source_offset(source.offset(state.position)?)?.get();
        validate_match(source, state.position, &result).map_err(|reason| {
            ParseError::invalid_rule(
                ParsePhase::Inline,
                rule.and_then(|rule| rule.name()),
                position,
                reason,
            )
        })?;

        apply::matched(&mut state, key.unwrap_or(0), result).map_err(|error| {
            error.at_rule(
                ParsePhase::Inline,
                rule.and_then(|rule| rule.name()),
                position,
            )
        })?;
    }

    delimiters::balance(&mut state.tokens, &mut state.delimiters, state.budget)?;

    let tokens = text::process(state.tokens, source, grammar, state.budget)?;
    tree::build(tokens, source, state.make_text, state.budget)
}

fn find_match(
    state: &mut State<'_, '_>,
    grammar: &Grammar,
    parse_state: &ParseState,
) -> Result<(Option<usize>, InlineMatch), ParseError> {
    let candidates =
        &grammar.data.dispatch[state.source.text().as_bytes()[state.position] as usize];

    for &key in candidates {
        state.budget.spend(1)?;
        let rule = &grammar.data.inline[key];

        let input = InlineInput {
            source: state.source,
            position: state.source.offset(state.position)?,
            state: parse_state,
            bracket: state.brackets.last().map(|b| b.info),
            inside_brackets: !state.brackets.is_empty(),
            trailing_text: match state.tokens.last() {
                Some(Token {
                    kind: TokenKind::Text(value),
                    ..
                }) => value,
                _ => "",
            },
        };

        let position = state
            .source
            .source_offset(state.source.offset(state.position)?)?
            .get();
        if let Some(result) = (rule.data.implementation.parse)(&input, state.budget)
            .map_err(|error| error.at_rule(ParsePhase::Inline, rule.name(), position))?
        {
            return Ok((Some(key), result));
        }
    }

    let end = state.position
        + state.source.text()[state.position..]
            .chars()
            .next()
            .expect("position is within source")
            .len_utf8();

    Ok((None, InlineMatch::literal(state.source.offset(end)?)))
}

fn validate_match(
    source: &SourceView,
    position: usize,
    result: &InlineMatch,
) -> Result<(), String> {
    if result.end.get() <= position {
        return Err(format!(
            "match end {} must advance beyond {position}",
            result.end
        ));
    }
    if result.end.get() > source.text().len() {
        return Err(format!(
            "match end {} exceeds view length {}",
            result.end,
            source.text().len()
        ));
    }
    if !source.text().is_char_boundary(result.end.get()) {
        return Err(format!("match end {} is not a UTF-8 boundary", result.end));
    }

    Ok(())
}
