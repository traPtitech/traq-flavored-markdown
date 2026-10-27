use markdown_parser::ParseError;
use markdown_parser::rules::Budget;
use markdown_parser::source::{SourceView, ViewRange};
use std::collections::HashSet;

/// Original byte positions of the first nonspace character on lines without `>`.
/// This identity survives indentation removal in nested container views.
#[derive(Clone)]
struct LazyLines(HashSet<usize>);

pub(super) fn content_start(view: &SourceView, line: ViewRange) -> Result<usize, ParseError> {
    let text = &view[line.clone()];
    let start = line.start + text.len() - text.trim_start_matches([' ', '\t']).len();
    Ok(view.span_for(start..start)?.start)
}

pub(super) fn is_lazy(view: &SourceView, line: ViewRange) -> Result<bool, ParseError> {
    let Some(lines) = view.context::<LazyLines>() else {
        return Ok(false);
    };
    Ok(lines.0.contains(&content_start(view, line)?))
}

pub(super) fn mark_lazy(
    view: &mut SourceView,
    lines: Vec<usize>,
    budget: &mut Budget,
) -> Result<(), ParseError> {
    if lines.is_empty() {
        return Ok(());
    }

    budget.spend(lines.len())?;
    let mut state = if let Some(inherited) = view.context::<LazyLines>() {
        budget.spend(inherited.0.len())?;
        inherited.clone()
    } else {
        LazyLines(HashSet::with_capacity(lines.len()))
    };
    state.0.extend(lines);

    view.set_context(state);

    Ok(())
}
