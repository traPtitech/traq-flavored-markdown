use markdown_definitions::PluginDeclaration;
use markdown_definitions::WireTypeKey;

#[derive(WireTypeKey)]
#[wire_type(key = "example.list")]
struct List;
type Alias = List;

mod other {
    #[derive(markdown_definitions::WireTypeKey)]
    #[wire_type(key = "example.other_list")]
    pub struct List;
}

#[derive(WireTypeKey)]
#[wire_type(key = "example.wrapper")]
struct Wrapper<T, const N: usize>([T; N]);

#[derive(WireTypeKey)]
#[wire_type(key = "example.characters")]
struct Characters<const A: char, const B: char>;

#[derive(WireTypeKey)]
#[wire_type(key = "example.stable")]
struct Stable<T>(T);

#[test]
fn keys_follow_types_and_distinguish_arguments() {
    assert_eq!(List::wire_key(), "example.list");
    assert_eq!(List::wire_key(), Alias::wire_key());
    assert_ne!(List::wire_key(), other::List::wire_key());
    assert_ne!(Wrapper::<u8, 1>::wire_key(), Wrapper::<u16, 1>::wire_key());
    assert_ne!(Wrapper::<u8, 1>::wire_key(), Wrapper::<u8, 2>::wire_key());
    assert_eq!(Stable::<u8>::wire_key(), "example.stable<2:u8>");

    assert_ne!(
        Characters::<',', '>'>::wire_key(),
        Characters::<'<', ','>::wire_key()
    );
    assert!(
        !Characters::<'\n', '\0'>::wire_key()
            .chars()
            .any(char::is_control)
    );
}

#[test]
fn names_are_required_labels_and_identity_is_shared_only_by_cloning() {
    let group = PluginDeclaration::group("CommonMark / Markdown");
    let nested = group.group("HTML @ syntax");
    let plugin = nested.plugin("Core");

    assert_eq!(group.name(), "CommonMark / Markdown");
    assert_eq!(nested.name(), "HTML @ syntax");
    assert_eq!(plugin.name(), "Core");
    assert_eq!(plugin, plugin.clone());
    assert_ne!(plugin, nested.plugin("Core"));
    assert_ne!(group, PluginDeclaration::group(group.name()));
    assert_eq!(plugin.namespace(), Some(&nested));
    assert_eq!(nested.parent(), Some(&group));
    assert!(group.parent().is_none());
    assert!(PluginDeclaration::new("Root").namespace().is_none());

    drop(group);
    drop(nested);

    assert_eq!(
        plugin.namespace().unwrap().parent().unwrap().name(),
        "CommonMark / Markdown"
    );

    assert!(format!("{plugin:?}").contains("CommonMark / Markdown"));
    assert_eq!(List::wire_key(), "example.list");
}
