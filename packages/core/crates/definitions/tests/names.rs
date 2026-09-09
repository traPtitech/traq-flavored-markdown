use markdown_definitions::{NameCollision, Plugin, validate_names};

#[test]
fn selected_declarations_share_groups_but_not_sibling_names() {
    let generic = Plugin::group("generic");
    let first = generic.new("math");
    let other = generic.new("math");
    let marks = generic.new("marks");

    assert!(validate_names([&first, &marks]).is_ok());
    assert!(validate_names([&other]).is_ok());

    assert_eq!(
        validate_names([&first, &other]),
        Err(NameCollision {
            scope: "generic".into(),
            name: "math".into()
        }),
    );

    assert_eq!(
        validate_names([&first, &first]),
        validate_names([&first, &other])
    );

    assert!(validate_names([]).is_ok());
}

#[test]
fn scope_uses_parent_identity_not_a_joined_display_path() {
    let root = Plugin::group("generic");
    let one = root.group("one");
    let two = root.group("two");
    let left = one.new("math");
    let right = two.new("math");

    assert!(validate_names([&left, &right]).is_ok());
    assert!(validate_names([&left, &Plugin::new("generic/one/math")]).is_ok());

    assert_eq!(
        validate_names([&left, &one.new("math")]),
        Err(NameCollision {
            scope: "generic/one".into(),
            name: "math".into()
        }),
    );

    // Distinct group instances with equal names collide when both are selected.
    let unrelated = Plugin::group("generic").new("other");
    assert_eq!(
        validate_names([&left, &unrelated]),
        Err(NameCollision {
            scope: "<root>".into(),
            name: "generic".into()
        }),
    );

    // Groups and plugins occupy the same display namespace.
    assert_eq!(
        validate_names([&left, &root.new("one")]),
        Err(NameCollision {
            scope: "generic".into(),
            name: "one".into()
        }),
    );
}
