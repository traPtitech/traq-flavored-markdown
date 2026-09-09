use super::{apply, delimiters, text, token::*, tree};

use crate::{
    Node, NodeKind,
    engine::{Budget, Grammar, ParseError, block::References, source::SourceView},
};

use std::ops::Range;

pub struct InlineInput<'a> {
    pub source: &'a SourceView,
    pub position: usize,
    pub bracket: Option<BracketInfo>,
    pub inside_brackets: bool,
    pub trailing_text: &'a str,
    pub(crate) references: &'a References,
}

impl InlineInput<'_> {
    pub fn tail(&self) -> &str {
        &self.source.text[self.position..]
    }

    pub fn reference(&self, key: &str) -> Option<&(String, Option<String>)> {
        self.references.get(key)
    }
}

pub struct TextInput<'a> {
    pub source: &'a SourceView,
    pub range: Range<usize>,
    pub after_decoded_text: bool,
}

impl TextInput<'_> {
    pub fn text(&self) -> &str {
        &self.source.text[self.range.clone()]
    }
}

pub struct TextMatch {
    pub start: usize,
    pub end: usize,
    pub kind: NodeKind,
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
        let value = &self.source.text[self.position..end];

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
    references: &References,
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

    while state.position < source.text.len() {
        state.budget.spend(1)?;
        let (key, result) = find_match(&mut state, grammar, references)?;
        validate_match(source, state.position, &result)?;

        apply::matched(&mut state, key, result)?;
    }

    delimiters::balance(&mut state.tokens, &mut state.delimiters, state.budget)?;

    let tokens = text::process(state.tokens, source, grammar, state.budget)?;
    tree::build(tokens, source, state.make_text, state.budget)
}

fn find_match(
    state: &mut State<'_, '_>,
    grammar: &Grammar,
    references: &References,
) -> Result<(usize, InlineMatch), ParseError> {
    let candidates = &grammar.data.dispatch[state.source.text.as_bytes()[state.position] as usize];

    for &key in candidates {
        let rule = &grammar.data.inline[key];

        let input = InlineInput {
            source: state.source,
            position: state.position,
            references,
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

        if let Some(result) = (rule.data.implementation.parse)(&input, state.budget)? {
            return Ok((key, result));
        }
    }

    let end = state.position
        + state.source.text[state.position..]
            .chars()
            .next()
            .expect("position is within source")
            .len_utf8();

    Ok((0, InlineMatch::literal(end)))
}

fn validate_match(
    source: &SourceView,
    position: usize,
    result: &InlineMatch,
) -> Result<(), ParseError> {
    if result.end <= position
        || result.end > source.text.len()
        || !source.text.is_char_boundary(result.end)
    {
        return Err(ParseError::InternalError);
    }

    Ok(())
}
