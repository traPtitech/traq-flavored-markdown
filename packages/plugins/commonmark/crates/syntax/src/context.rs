use markdown_parser::engine::{Budget, ParseError, source::SourceView};

/// Original byte positions of paragraph continuation lines without `>`.
#[derive(Clone)]
struct LazyLines(Vec<usize>);

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

    let state = if let Some(inherited) = view.context::<LazyLines>() {
        budget.spend(inherited.0.len() + lines.len())?;
        let mut state = inherited.clone();
        state.0.extend(lines);
        state
    } else {
        LazyLines(lines)
    };

    view.set_context(state);

    Ok(())
}
