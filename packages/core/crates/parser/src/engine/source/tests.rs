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

    let mut child = source.join(&[0..4]).unwrap().expand_tabs().restore_tabs();
    let sibling = source.join(&[2..4]).unwrap();
    child.set_context(ParentState("inner"));

    let nested = child.join(&[0..1, 2..4]).unwrap();

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
        nested.span_for(1..3).unwrap(),
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

    let child = parent.join(&[0..4]).unwrap();
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
