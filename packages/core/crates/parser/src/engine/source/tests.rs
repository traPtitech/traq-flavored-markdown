use super::SourceView;
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};

#[derive(Debug, PartialEq)]
struct ParentState(&'static str);

#[derive(Debug, PartialEq)]
struct OtherExtension(u32);

#[test]
fn context_is_inherited_across_views_without_changing_parent_or_siblings() {
    let mut source = SourceView::new("a\tb\r\n");
    source.set_context(ParentState("outer"));
    source.set_context(OtherExtension(42));

    let mut child = source
        .join(&[source.range(0..4).unwrap()])
        .unwrap()
        .expand_tabs()
        .restore_tabs();
    let sibling = source.join(&[source.range(2..4).unwrap()]).unwrap();
    child.set_context(ParentState("inner"));

    let nested = child
        .join(&[child.range(0..1).unwrap(), child.range(2..4).unwrap()])
        .unwrap();

    assert_eq!(source.context::<ParentState>(), Some(&ParentState("outer")));

    assert_eq!(
        sibling.context::<ParentState>(),
        Some(&ParentState("outer"))
    );

    assert_eq!(nested.context::<ParentState>(), Some(&ParentState("inner")));

    assert_eq!(
        nested.context::<OtherExtension>(),
        Some(&OtherExtension(42))
    );

    assert_eq!(child.context.len(), 2);
    assert_eq!(nested.text(), "ab\n");

    assert_eq!(
        nested.span_for(nested.range(1..3).unwrap()).unwrap(),
        crate::Span { start: 2, end: 5 }
    );

    assert!(
        SourceView::new("next parse")
            .context::<ParentState>()
            .is_none()
    );
}

#[test]
fn context_lives_until_the_last_view_and_can_be_read_on_another_thread() {
    struct State(Arc<AtomicUsize>);
    impl Drop for State {
        fn drop(&mut self) {
            self.0.fetch_add(1, Ordering::SeqCst);
        }
    }

    let drops = Arc::new(AtomicUsize::new(0));
    let mut parent = SourceView::new("body");
    parent.set_context(State(drops.clone()));

    let child = parent.join(&[parent.range(0..4).unwrap()]).unwrap();
    drop(parent);
    assert_eq!(drops.load(Ordering::SeqCst), 0);

    std::thread::spawn(move || {
        assert!(child.context::<State>().is_some());
        drop(child);
    })
    .join()
    .unwrap();

    assert_eq!(drops.load(Ordering::SeqCst), 1);
}

#[test]
fn contiguous_views_share_mapping_and_partial_tabs_remain_literal_spaces() {
    let source = SourceView::new("α\r\n\t\0z");
    assert_eq!(source.text(), "α\n\t�z");
    let expanded = source.expand_tabs();
    let whole = expanded
        .join(&[
            expanded.range(3..7).unwrap(),
            expanded.range(7..11).unwrap(),
        ])
        .unwrap();
    let partial = expanded.join(&[expanded.range(4..11).unwrap()]).unwrap();
    assert!(Arc::ptr_eq(&expanded.backing, &whole.backing));
    assert!(Arc::ptr_eq(&expanded.backing, &partial.backing));
    assert_eq!(whole.restore_tabs().text(), "\t�z");
    assert_eq!(partial.restore_tabs().text(), "   �z");
    assert_eq!(
        source
            .source_offset(source.offset(3).unwrap())
            .unwrap()
            .get(),
        4
    );
    assert!(source.offset(1).is_err());
    assert!(source.offset(5).is_err());
    assert!(source.range(0..1).is_err());
    assert!(source.range(std::ops::Range { start: 4, end: 3 }).is_err());
    assert!(source.range(0..usize::MAX).is_err());
    let nul = source.range(4..7).unwrap();
    assert_eq!(&source[nul.clone()], "�");
    assert_eq!(
        source.span_for(nul).unwrap(),
        crate::Span { start: 5, end: 6 }
    );
    let start = source.offset(0).unwrap();
    assert!(source.span_for(start..start + 1).is_err());
    let disjoint = expanded
        .join(&[
            expanded.range(0..3).unwrap(),
            expanded.range(7..11).unwrap(),
        ])
        .unwrap();
    assert!(!Arc::ptr_eq(&expanded.backing, &disjoint.backing));
    assert_eq!(disjoint.text(), "α\n�z");
    assert_eq!(
        disjoint.span_for(disjoint.range(3..7).unwrap()).unwrap(),
        crate::Span { start: 5, end: 7 }
    );
}

#[test]
fn cursor_rejects_invalid_boundaries_and_charges_utf8_bytes_without_moving_on_error() {
    use crate::engine::{Budget, Limits, ParseError};
    let source = SourceView::new("αx!");
    let mut budget = Budget::new(Limits {
        work: 3,
        ..Limits::default()
    });
    let mut cursor = source
        .cursor(source.offset(0).unwrap(), &mut budget)
        .unwrap();
    assert_eq!(cursor.advance(1), Err(ParseError::InternalError));
    assert_eq!(cursor.position().get(), 0);
    assert_eq!(cursor.next_char().unwrap(), Some('α'));
    assert_eq!(cursor.next_char().unwrap(), Some('x'));
    assert!(
        matches!(cursor.next_char(), Err(ParseError::ResourceLimit { resource }) if resource == "work")
    );
    assert_eq!(cursor.position().get(), 3);
}

#[test]
#[ignore = "manual representation benchmark; prints storage and construction timings"]
fn benchmark_shared_views() {
    use std::{hint::black_box, time::Instant};
    let source = SourceView::new(&"a".repeat(65_536));
    let ranges: Vec<_> = (0..128)
        .map(|index| index * 512..(index + 1) * 512)
        .collect();
    let materialize = |range: &std::ops::Range<usize>| {
        SourceView::mapped(
            vec![],
            source.text()[range.clone()].to_owned(),
            source.offsets()[range.start..=range.end].to_vec(),
            vec![],
        )
    };
    let backing_bytes =
        source.backing.text.len() + source.backing.offsets.len() * std::mem::size_of::<usize>();
    let copied_bytes: usize = ranges
        .iter()
        .map(|range| range.len() + (range.len() + 1) * std::mem::size_of::<usize>())
        .sum();
    let start = Instant::now();
    for _ in 0..500 {
        for range in &ranges {
            black_box(materialize(range));
        }
    }
    let copied_time = start.elapsed();
    let start = Instant::now();
    for _ in 0..500 {
        for range in &ranges {
            black_box(
                source
                    .join(&[source.range(range.clone()).unwrap()])
                    .unwrap(),
            );
        }
    }
    let shared_time = start.elapsed();
    println!(
        "128 contiguous 512-byte views: materialized backing bytes={}, shared backing bytes={backing_bytes}; 64000 constructions: materialized={copied_time:?}, shared={shared_time:?}",
        backing_bytes + copied_bytes
    );
    for range in &ranges {
        assert!(Arc::ptr_eq(
            &source.backing,
            &source
                .join(&[source.range(range.clone()).unwrap()])
                .unwrap()
                .backing
        ));
    }
}
