use markdown_parser::ParseError;
use markdown_parser::rules::Budget;
use markdown_parser::source::SourceView;
use std::collections::HashSet;

/// Original byte positions of paragraph continuation lines without `>`.
#[derive(Clone)]
struct LazyLines(HashSet<usize>);

pub(super) fn is_lazy(view: &SourceView, original: usize) -> bool {
    view.context::<LazyLines>()
        .is_some_and(|lines| lines.0.contains(&original))
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
