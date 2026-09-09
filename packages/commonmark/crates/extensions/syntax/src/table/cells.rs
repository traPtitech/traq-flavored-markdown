use super::Alignment;
use std::ops::Range;

pub(super) fn cells(raw: &str, origin: usize) -> Vec<Range<usize>> {
    let start = raw.len() - raw.trim_start().len();
    let end = raw.trim_end().len().max(start);

    let mut cells = vec![];
    let mut begin = start;

    for pos in start..end {
        if raw.as_bytes()[pos] == b'|' && (pos == start || raw.as_bytes()[pos - 1] != b'\\') {
            cells.push(origin + begin..origin + pos);
            begin = pos + 1;
        }
    }

    cells.push(origin + begin..origin + end);
    if cells.first().is_some_and(Range::is_empty) {
        cells.remove(0);
    }
    if cells.last().is_some_and(Range::is_empty) {
        cells.pop();
    }
    cells
}

pub(super) fn alignment(header: &str, delimiter: &str) -> Option<Vec<Option<Alignment>>> {
    let line = delimiter.trim();

    if !header.contains('|')
        || header.starts_with("    ")
        || delimiter.starts_with("    ")
        || line.len() < 2
        || line.starts_with("- ")
    {
        return None;
    }

    let columns = cells(delimiter, 0);
    if columns.len() != cells(header, 0).len() || columns.is_empty() {
        return None;
    }

    columns
        .into_iter()
        .map(|range| alignment_cell(delimiter, range))
        .collect()
}

fn alignment_cell(delimiter: &str, range: Range<usize>) -> Option<Option<Alignment>> {
    let cell = delimiter[range].trim();
    let dashes = cell.trim_start_matches(':').trim_end_matches(':');

    if dashes.is_empty()
        || !dashes.bytes().all(|b| b == b'-')
        || cell.starts_with("::")
        || cell.ends_with("::")
    {
        return None;
    }

    Some(match (cell.starts_with(':'), cell.ends_with(':')) {
        (true, true) => Some(Alignment::Center),
        (true, false) => Some(Alignment::Left),
        (false, true) => Some(Alignment::Right),
        _ => None,
    })
}
