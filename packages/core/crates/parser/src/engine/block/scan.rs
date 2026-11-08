use super::{
    BlockBatch, BlockInput, DraftContent, DraftNode, Following, LineIndex, Lines, ResolvedBlock,
    ResolvedContent,
};

use crate::{
    ParseError,
    engine::{
        Budget, Grammar, ParsePhase, ParseState, inline,
        source::{SourceView, ViewOffset, ViewRange},
    },
};

fn blank(text: &str) -> bool {
    text.bytes().all(|b| b == b' ' || b == b'\t')
}

fn lines(text: &str) -> Vec<ViewRange> {
    let mut position = 0;

    text.split_inclusive('\n')
        .map(|line| {
            let range = position..position + line.len();
            position = range.end;
            range
        })
        .filter(|range| text[range.clone()].ends_with('\n') || !blank(&text[range.clone()]))
        .map(|range| ViewOffset(range.start)..ViewOffset(range.end))
        .collect()
}

pub(crate) fn parse(
    source: &SourceView,
    grammar: &Grammar,
    budget: &mut Budget,
    state: &mut ParseState,
) -> Result<crate::engine::syntax::ParsedNodes, ParseError> {
    let expanded;

    let source = if source.text().contains('\t') {
        budget.spend(source.text().len())?;
        expanded = source.expand_tabs();
        &expanded
    } else {
        source
    };

    let batch = tokenize(source, grammar, budget, state, 0)?;

    resolve_inlines(
        batch.nodes,
        grammar,
        budget,
        state,
        0,
        source.captures_syntax(),
    )
}

fn tokenize(
    source: &SourceView,
    grammar: &Grammar,
    budget: &mut Budget,
    state: &mut ParseState,
    depth: usize,
) -> Result<BlockBatch, ParseError> {
    budget.nesting(depth)?;
    budget.spend(source.work_len())?;

    let lines = lines(source.text());
    let (mut position, mut nodes) = (LineIndex::new(0), vec![]);
    let mut metadata = ParseState::default();

    while position < LineIndex::new(lines.len()) {
        budget.token()?;

        let input = BlockInput {
            source,
            lines: Lines(&lines),
            start: position,
            grammar,
        };

        let found = match_block(&input, budget)?;

        if source.captures_syntax() {
            budget.spend(found.syntax.len())?;
            budget.detached_syntax.extend(found.syntax);
        }

        for commit in found.commits {
            commit(state, budget)?;
        }

        for node in found.nodes {
            nodes.push(resolve_blocks(node, grammar, budget, state, depth)?);
        }

        position = found.end;

        if found.following == Following::Policy
            && let Some(policy) = &grammar.data.block_policy
        {
            let next = policy.after_match(&input, position, &mut metadata)?;
            if next < position || next > LineIndex::new(lines.len()) {
                return Err(ParseError::InternalError);
            }

            position = next;
        }
    }

    Ok(BlockBatch { nodes, metadata })
}

fn match_block(
    input: &BlockInput<'_>,
    budget: &mut Budget,
) -> Result<super::BlockMatch, ParseError> {
    for entry in &input.grammar.data.block {
        budget.spend(1)?;

        let position = input
            .source
            .span_for(input.lines[input.start].start..input.lines[input.start].start)?
            .start;
        if let Some(found) = (entry.data.implementation.parse)(input, budget)
            .map_err(|error| error.at_rule(ParsePhase::Block, entry.name(), position))?
        {
            validate_match(&found, input.start, input.lines.end()).map_err(|reason| {
                ParseError::invalid_rule(ParsePhase::Block, entry.name(), position, reason)
            })?;

            return Ok(found);
        }
    }

    Err(ParseError::InternalError)
}

fn validate_match(
    found: &super::BlockMatch,
    start: LineIndex,
    line_count: LineIndex,
) -> Result<(), String> {
    if found.end <= start || found.end > line_count {
        return Err(format!(
            "block match must advance from {start:?} within {line_count:?}; got {:?}",
            found.end
        ));
    }

    Ok(())
}

fn resolve_blocks(
    draft: DraftNode,
    grammar: &Grammar,
    budget: &mut Budget,
    state: &mut ParseState,
    depth: usize,
) -> Result<ResolvedBlock, ParseError> {
    budget.nesting(depth)?;
    let mut metadata = ParseState::default();
    let mut syntax = draft.syntax;

    let content = match draft.content {
        DraftContent::Leaf => ResolvedContent::Leaf,

        DraftContent::Inline(source) => {
            if syntax.is_none() {
                syntax = source.syntax(&[source.range(0..source.text().len())?], &[], budget)?;
            }

            ResolvedContent::Inline(source)
        }

        DraftContent::Blocks(source) => {
            if syntax.is_none() {
                syntax = source.syntax(&[source.range(0..source.text().len())?], &[], budget)?;
            }

            let batch = tokenize(&source, grammar, budget, state, depth + 1)?;
            metadata = batch.metadata;
            ResolvedContent::Nodes(batch.nodes)
        }

        DraftContent::Nodes(children) => {
            let mut resolved = Vec::with_capacity(children.len());

            for child in children {
                resolved.push(resolve_blocks(child, grammar, budget, state, depth + 1)?);
            }

            ResolvedContent::Nodes(resolved)
        }
    };

    let mut node = ResolvedBlock {
        span: draft.span,
        payload: draft.payload,
        content,
        metadata,
        syntax,
    };

    if let Some(finish) = draft.finish {
        finish(&mut node);
    }

    Ok(node)
}

fn resolve_inlines(
    drafts: Vec<ResolvedBlock>,
    grammar: &Grammar,
    budget: &mut Budget,
    state: &ParseState,
    depth: usize,
    capture: bool,
) -> Result<crate::engine::syntax::ParsedNodes, ParseError> {
    budget.nesting(depth)?;

    let mut nodes = crate::engine::syntax::ParsedNodes::new(capture);

    for draft in drafts {
        let children = match draft.content {
            ResolvedContent::Leaf => crate::engine::syntax::ParsedNodes::new(capture),

            ResolvedContent::Inline(source) => {
                inline::parse(&source.restore_tabs(), grammar, budget, state)?
            }

            ResolvedContent::Nodes(children) => {
                resolve_inlines(children, grammar, budget, state, depth + 1, capture)?
            }
        };

        budget.node()?;
        nodes.push(draft.span, draft.payload, children, draft.syntax)?;
    }

    Ok(nodes)
}
