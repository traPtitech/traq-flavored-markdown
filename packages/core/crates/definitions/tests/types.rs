use markdown_definitions::{NodeType, Plugin};

#[derive(NodeType)]
struct List;
type Alias = List;

mod other {
    #[derive(markdown_definitions::NodeType)]
    pub struct List;
}

#[derive(NodeType)]
struct Wrapper<T, const N: usize>([T; N]);

#[derive(NodeType)]
struct Characters<const A: char, const B: char>;

#[test]
fn keys_follow_types_and_distinguish_arguments() {
    assert_eq!(List::type_key(), "types::List");
    assert_eq!(List::type_key(), Alias::type_key());
    assert_ne!(List::type_key(), other::List::type_key());
    assert_ne!(Wrapper::<u8, 1>::type_key(), Wrapper::<u16, 1>::type_key());
    assert_ne!(Wrapper::<u8, 1>::type_key(), Wrapper::<u8, 2>::type_key());

    assert_ne!(
        Characters::<',', '>'>::type_key(),
        Characters::<'<', ','>::type_key()
    );
    assert!(
        !Characters::<'\n', '\0'>::type_key()
            .chars()
            .any(char::is_control)
    );
}

#[test]
fn names_are_required_labels_and_identity_is_shared_only_by_cloning() {
    let group = Plugin::group("CommonMark / Markdown");
    let nested = group.group("HTML @ syntax");
    let plugin = nested.new("Core");

    assert_eq!(group.name(), "CommonMark / Markdown");
    assert_eq!(nested.name(), "HTML @ syntax");
    assert_eq!(plugin.name(), "Core");
    assert_eq!(plugin, plugin.clone());
    assert_ne!(plugin, nested.new("Core"));
    assert_ne!(group, Plugin::group(group.name()));
    assert_eq!(plugin.namespace(), Some(&nested));
    assert_eq!(nested.parent(), Some(&group));
    assert!(group.parent().is_none());
    assert!(Plugin::new("Root").namespace().is_none());

    drop(group);
    drop(nested);

    assert_eq!(
        plugin.namespace().unwrap().parent().unwrap().name(),
        "CommonMark / Markdown"
    );

    assert!(format!("{plugin:?}").contains("CommonMark / Markdown"));
    assert_eq!(List::type_key(), "types::List");
}
