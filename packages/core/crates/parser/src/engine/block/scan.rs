use super::{BlockBatch, BlockInput, DraftContent, DraftNode, References};

use crate::{
    Node, ParseError,
    engine::{Budget, Grammar, inline, source::SourceView},
};

use std::ops::Range;

fn blank(text: &str) -> bool {
    text.bytes().all(|b| b == b' ' || b == b'\t')
}

fn lines(text: &str) -> Vec<Range<usize>> {
    let mut position = 0;

    text.split_inclusive('\n')
        .map(|line| {
            let range = position..position + line.len();
            position = range.end;
            range
        })
        .filter(|range| text[range.clone()].ends_with('\n') || !blank(&text[range.clone()]))
        .collect()
}

pub(crate) fn parse(
    source: &SourceView,
    grammar: &Grammar,
    budget: &mut Budget,
) -> Result<Vec<Node>, ParseError> {
    let expanded;

    let source = if source.text.contains('\t') {
        budget.spend(source.text.len())?;
        expanded = source.expand_tabs();
        &expanded
    } else {
        source
    };

    let mut references = References::new();
    let batch = tokenize(source, grammar, budget, &mut references, 0)?;

    resolve_inlines(batch.nodes, grammar, budget, &references, 0)
}

fn tokenize(
    source: &SourceView,
    grammar: &Grammar,
    budget: &mut Budget,
    references: &mut References,
    depth: usize,
) -> Result<BlockBatch, ParseError> {
    budget.depth(depth)?;
    budget.spend(source.work_len())?;

    let lines = lines(&source.text);
    let last_nonblank = lines
        .iter()
        .rposition(|line| !blank(source.text[line.clone()].trim_end_matches('\n')))
        .unwrap_or(0);

    let (mut position, mut loose, mut nodes) = (0, false, vec![]);

    while position < lines.len() {
        budget.token()?;
        let input = BlockInput {
            source,
            lines: &lines,
            start: position,
            grammar,
        };

        let found = match_block(&input, budget)?;
        validate_match(&found, position, lines.len())?;

        for definition in found.definitions {
            references
                .entry(definition.key)
                .or_insert((definition.destination, definition.title));
        }

        for mut node in found.nodes {
            resolve_blocks(&mut node, grammar, budget, references, depth)?;
            nodes.push(node);
        }

        position = found.end;

        consume_separator(
            &input,
            found.consume_separator,
            last_nonblank,
            &mut position,
            &mut loose,
        );
    }

    Ok(BlockBatch { nodes, loose })
}

fn match_block(
    input: &BlockInput<'_>,
    budget: &mut Budget,
) -> Result<super::BlockMatch, ParseError> {
    for entry in &input.grammar.data.block {
        if let Some(found) = (entry.data.implementation.parse)(input, budget)? {
            return Ok(found);
        }
    }

    Err(ParseError::InternalError)
}

fn validate_match(
    found: &super::BlockMatch,
    start: usize,
    line_count: usize,
) -> Result<(), ParseError> {
    if found.end <= start || found.end > line_count {
        return Err(ParseError::InternalError);
    }

    Ok(())
}

fn consume_separator(
    input: &BlockInput<'_>,
    consume: bool,
    last_nonblank: usize,
    position: &mut usize,
    loose: &mut bool,
) {
    if consume && *position < input.lines.len() && blank(input.line(*position)) {
        *loose |= *position < last_nonblank;
        *position += 1;
    }
}

fn resolve_blocks(
    node: &mut DraftNode,
    grammar: &Grammar,
    budget: &mut Budget,
    references: &mut References,
    depth: usize,
) -> Result<(), ParseError> {
    budget.depth(depth)?;

    match &mut node.content {
        DraftContent::Blocks(source) => {
            let batch = tokenize(source, grammar, budget, references, depth + 1)?;
            node.resolve_blocks(batch);
        }

        DraftContent::Nodes(children) => {
            for child in children {
                resolve_blocks(child, grammar, budget, references, depth + 1)?;
            }
        }

        _ => {}
    }

    if let Some(finish) = node.finish {
        finish(node);
    }

    Ok(())
}

fn resolve_inlines(
    drafts: Vec<DraftNode>,
    grammar: &Grammar,
    budget: &mut Budget,
    references: &References,
    depth: usize,
) -> Result<Vec<Node>, ParseError> {
    budget.depth(depth)?;

    let mut nodes = Vec::with_capacity(drafts.len());

    for draft in drafts {
        let children = match draft.content {
            DraftContent::Leaf => vec![],

            DraftContent::Inline(source) => {
                inline::parse(&source.restore_tabs(), grammar, budget, references)?
            }

            DraftContent::Nodes(children) => {
                resolve_inlines(children, grammar, budget, references, depth + 1)?
            }

            DraftContent::Blocks(_) => return Err(ParseError::InternalError),
        };

        nodes.push(Node::new(draft.span, draft.kind, children));
    }

    Ok(nodes)
}
