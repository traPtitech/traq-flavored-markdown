use markdown_ast::{Document, Node, NodeData, NodeKind, Span};

#[derive(Debug, Clone, PartialEq)]
struct Score(f64);

impl NodeData for Score {
    fn validate(&self, children: &[Node]) -> bool {
        children.is_empty()
    }
}
#[derive(Debug, Clone, PartialEq)]
struct Container;

impl NodeData for Container {
    fn validate(&self, children: &[Node]) -> bool {
        children.iter().all(|child| child.get::<Score>().is_some())
    }
}

#[test]
fn native_borrow_clone_validation_and_partial_equality() {
    fn send_sync<T: Send + Sync>() {}
    send_sync::<Document>();

    let span = Span { start: 0, end: 1 };
    let original = Node::new(span, Container, vec![Node::leaf(span, Score(1.5))]);

    assert!(original.validate());

    let mut copy = original.clone();
    copy.children[0].get_mut::<Score>().unwrap().0 = 2.5;

    assert_ne!(original, copy);
    assert_eq!(original.children[0].get::<Score>(), Some(&Score(1.5)));
    assert!(original.get::<Score>().is_none());

    copy.children.push(Node::leaf(span, Container));
    assert!(!copy.validate());

    let nan = Node::leaf(span, Score(f64::NAN));
    assert_ne!(nan, nan.clone());

    let boxed = NodeKind::new(Score(1.5));
    assert_eq!(Node::leaf(span, boxed), original.children[0]);
}
