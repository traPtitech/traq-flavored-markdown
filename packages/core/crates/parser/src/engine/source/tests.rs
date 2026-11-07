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
        matches!(cursor.next_char(), Err(ParseError::ResourceLimit { resource }) if resource.as_str() == "work")
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
        let mut origins = super::SourceMap::default();
        source.copy_origins(range.clone(), 0, &mut origins);

        SourceView::mapped(
            vec![],
            source.text()[range.clone()].to_owned(),
            source.offsets()[range.start..=range.end].to_vec(),
            vec![],
            origins,
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
        "128 contiguous 512-byte views: materialized text/boundary bytes={}, shared text/boundary bytes={backing_bytes}; 64000 constructions: materialized={copied_time:?}, shared={shared_time:?}",
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

fn source_spans(view: &SourceView, range: std::ops::Range<usize>) -> Vec<crate::Span> {
    view.source_spans(view.range(range).unwrap()).unwrap()
}

#[test]
fn exact_origins_exclude_removed_quote_prefixes_without_changing_ast_envelopes() {
    for newline in ["\n", "\r\n", "\r"] {
        let original = format!("> **a{newline}> b**");
        let source = SourceView::new(&original);

        let joined = source
            .join(&[source.range(2..6).unwrap(), source.range(8..11).unwrap()])
            .unwrap();

        assert_eq!(joined.text(), "**a\nb**");

        assert_eq!(
            joined.span_for(joined.range(3..4).unwrap()).unwrap(),
            crate::Span {
                start: 5,
                end: 7 + newline.len()
            }
        );

        assert_eq!(
            source_spans(&joined, 3..4),
            [crate::Span {
                start: 5,
                end: 5 + newline.len()
            }]
        );

        let spans = source_spans(&joined, 2..5);

        let slices: Vec<_> = spans
            .iter()
            .map(|span| &original[span.start..span.end])
            .collect();

        assert_eq!(slices, [format!("a{newline}"), "b".into()]);

        let nested = joined
            .join(&[joined.range(0..1).unwrap(), joined.range(2..5).unwrap()])
            .unwrap();

        assert_eq!(nested.text(), "*a\nb");
        let spans = source_spans(&nested, 0..4);

        let slices: Vec<_> = spans
            .iter()
            .map(|span| &original[span.start..span.end])
            .collect();

        assert_eq!(slices, ["*".into(), format!("a{newline}"), "b".into()]);
    }
}

#[test]
fn exact_origins_survive_removed_table_escapes_and_shared_subviews() {
    let source = SourceView::new("| a\\|b |");

    let cell = source
        .join(&[source.range(2..3).unwrap(), source.range(4..6).unwrap()])
        .unwrap();

    assert_eq!(cell.text(), "a|b");

    assert_eq!(
        source_spans(&cell, 0..3),
        [
            crate::Span { start: 2, end: 3 },
            crate::Span { start: 4, end: 6 }
        ]
    );

    let slice = cell.join(&[cell.range(0..2).unwrap()]).unwrap();

    assert!(Arc::ptr_eq(&cell.backing, &slice.backing));

    assert_eq!(
        source_spans(&slice, 0..2),
        [
            crate::Span { start: 2, end: 3 },
            crate::Span { start: 4, end: 5 }
        ]
    );

    assert_eq!(
        source_spans(&slice.expand_tabs().restore_tabs(), 1..2),
        [crate::Span { start: 4, end: 5 }]
    );
}

#[test]
fn normalized_characters_map_to_their_whole_original_spelling() {
    let original = "\u{feff}α\r\n\0😀";
    let source = SourceView::new(original);

    assert_eq!(source.text(), "\u{feff}α\n�😀");

    for (range, expected) in [
        (0..3, "\u{feff}"),
        (3..5, "α"),
        (5..6, "\r\n"),
        (6..9, "\0"),
        (9..13, "😀"),
    ] {
        let spans = source_spans(&source, range);

        assert_eq!(spans.len(), 1);
        assert_eq!(&original[spans[0].start..spans[0].end], expected);
    }

    assert_eq!(
        source_spans(&source, 0..13),
        [crate::Span {
            start: 0,
            end: original.len()
        }]
    );

    for offset in [0, 3, 5, 6, 9, 13] {
        assert!(source_spans(&source, offset..offset).is_empty());
    }

    for range in [
        1..3,
        6..7,
        10..13,
        0..14,
        std::ops::Range { start: 9, end: 5 },
    ] {
        assert!(
            source
                .source_spans(super::ViewOffset(range.start)..super::ViewOffset(range.end))
                .is_err()
        );
    }
}

#[test]
fn partially_selected_tabs_retain_their_origin_through_further_transformations() {
    let source = SourceView::new("a\tb");
    let expanded = source.expand_tabs();

    assert_eq!(expanded.text(), "a   b");

    for position in 1..4 {
        assert_eq!(
            source_spans(&expanded, position..position + 1),
            [crate::Span { start: 1, end: 2 }]
        );
    }

    let partial = expanded
        .join(&[expanded.range(2..5).unwrap()])
        .unwrap()
        .restore_tabs();

    assert_eq!(partial.text(), "  b");

    assert_eq!(
        source_spans(&partial, 0..1),
        [crate::Span { start: 1, end: 2 }]
    );

    assert_eq!(
        source_spans(&partial.expand_tabs(), 0..3),
        [crate::Span { start: 1, end: 3 }]
    );

    let whole = expanded
        .join(&[expanded.range(1..5).unwrap()])
        .unwrap()
        .restore_tabs();

    assert_eq!(whole.text(), "\tb");
    let expanded_again = whole.expand_tabs();

    assert_eq!(expanded_again.text(), "    b");

    for position in 0..4 {
        assert_eq!(
            source_spans(&expanded_again, position..position + 1),
            [crate::Span { start: 1, end: 2 }]
        );
    }

    assert_eq!(
        source_spans(&expanded_again.restore_tabs(), 0..2),
        [crate::Span { start: 1, end: 3 }]
    );
}

#[test]
fn unicode_normalization_and_multiple_tabs_keep_origins_across_nested_views() {
    let source = SourceView::new("😀\tα\r\n>\t\0z");
    let expanded = source.expand_tabs();

    assert_eq!(expanded.text(), "😀   α\n>   �z");

    let selected = expanded
        .join(&[
            expanded.range(0..10).unwrap(),
            expanded.range(12..18).unwrap(),
        ])
        .unwrap()
        .restore_tabs();

    assert_eq!(selected.text(), "😀\tα\n  �z");

    let expected = [
        ("😀", 0..4),
        ("\t", 4..5),
        ("α", 5..7),
        ("\r\n", 7..9),
        ("\t", 10..11),
        ("\t", 10..11),
        ("\0", 11..12),
        ("z", 12..13),
    ];

    let original = "😀\tα\r\n>\t\0z";

    for ((position, ch), (spelling, range)) in selected.text().char_indices().zip(expected) {
        let spans = source_spans(&selected, position..position + ch.len_utf8());

        assert_eq!(
            spans,
            [crate::Span {
                start: range.start,
                end: range.end
            }]
        );

        assert_eq!(&original[range], spelling);
    }

    let reexpanded = selected.expand_tabs();

    assert_eq!(reexpanded.text(), "😀   α\n  �z");

    for view in [&selected, &reexpanded, &reexpanded.clone().restore_tabs()] {
        assert_eq!(
            source_spans(view, 0..view.text().len()),
            [
                crate::Span { start: 0, end: 9 },
                crate::Span { start: 10, end: 13 }
            ]
        );
    }
}

#[test]
fn source_spans_preserve_view_order_and_empty_selections_have_no_origin() {
    let source = SourceView::new("abcde");

    let reordered = source
        .join(&[source.range(3..5).unwrap(), source.range(0..2).unwrap()])
        .unwrap();

    assert_eq!(reordered.text(), "deab");

    assert_eq!(
        source_spans(&reordered, 0..4),
        [
            crate::Span { start: 3, end: 5 },
            crate::Span { start: 0, end: 2 }
        ]
    );

    for empty in [
        source.join(&[]).unwrap(),
        source.join(&[source.range(2..2).unwrap()]).unwrap(),
    ] {
        assert_eq!(empty.text(), "");
        assert!(source_spans(&empty.expand_tabs().restore_tabs(), 0..0).is_empty());
    }

    assert_eq!(source.backing.origins.segment_count(0..5), 1);
}

#[test]
fn syntax_mapping_charges_every_visited_origin_before_coalescing() {
    use crate::{Limits, ParseError, ParseResource, engine::Budget, syntax::MarkerKind};

    let mut source = SourceView::new("\0\0x");
    source.set_context(crate::engine::syntax::CaptureSyntax);
    let range = source.range(0..source.text().len()).unwrap();

    assert_eq!(
        source.backing.origins.segment_count(0..source.text().len()),
        3
    );

    for mode in ["content", "marker", "prefix"] {
        let mut budget = Budget::new(Limits {
            work: 6,
            ..Limits::default()
        });

        let mut capture = || match mode {
            "content" => source.syntax(std::slice::from_ref(&range), &[], &mut budget),
            "marker" => source.syntax(&[], &[(MarkerKind::Open, range.clone())], &mut budget),
            "prefix" => source.prefix_syntax(&[], [range.clone()], &mut budget),
            _ => unreachable!(),
        };

        for _ in 0..2 {
            let facts = capture().unwrap().unwrap();

            let spans = if mode == "content" {
                &facts.content
            } else {
                &facts.markers[0].spans
            };

            assert_eq!(spans, &[crate::Span { start: 0, end: 3 }]);
        }

        assert_eq!(
            capture(),
            Err(ParseError::ResourceLimit {
                resource: ParseResource::Work
            })
        );
    }
}

#[test]
fn syntax_mapping_spends_no_work_when_capture_is_disabled() {
    use crate::{Limits, engine::Budget, syntax::MarkerKind};

    let source = SourceView::new("\0\0x");
    let range = source.range(0..source.text().len()).unwrap();

    let mut budget = Budget::new(Limits {
        work: 0,
        ..Limits::default()
    });

    assert_eq!(
        source
            .syntax(
                std::slice::from_ref(&range),
                &[(MarkerKind::Open, range.clone())],
                &mut budget
            )
            .unwrap(),
        None
    );

    assert_eq!(
        source.prefix_syntax(&[], [range], &mut budget).unwrap(),
        None
    );
}
