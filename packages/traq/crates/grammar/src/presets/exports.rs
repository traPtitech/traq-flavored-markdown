use crate::{
    bindings::Catalog,
    syntax::{commonmark, extensions, trap},
};
use serde_json::json;

/// Export members are SDK API names. Display labels never resolve these members.
pub(crate) fn catalog() -> Catalog {
    let mut catalog = Catalog::default();
    let core = catalog.plugin(&super::commonmark::syntax().plugin);
    let html = catalog.plugin(commonmark::html::plugin());
    let math = catalog.plugin(extensions::math::plugin());
    let mark = catalog.plugin(extensions::mark::plugin());
    let strikethrough = catalog.plugin(extensions::strikethrough::plugin());
    let table = catalog.plugin(extensions::table::plugin());
    let linkify = catalog.plugin(extensions::linkify::plugin());
    let spoiler = catalog.plugin(trap::spoiler::plugin());
    let references = catalog.plugin(trap::references::plugin());
    let stamp = catalog.plugin(trap::stamp::plugin());
    let compat = catalog.plugin(trap::compat::plugin());

    let commonmark = catalog
        .preset(&super::commonmark::builder())
        .expect("valid CommonMark preset");
    let v1 = catalog
        .preset(&super::traq::v1::builder())
        .expect("valid traQ preset");

    catalog.exports = json!({
        "plugins": {
            "commonmark": { "core": core, "html": html },
            "generic": {
                "math": math,
                "mark": mark,
                "strikethrough": strikethrough,
                "table": table,
                "linkify": linkify,
            },
            "trap": {
                "spoiler": spoiler,
                "references": references,
                "stamp": stamp,
                "compat": compat,
            }
        },
        "presets": { "commonmark": commonmark, "traq": { "v1": v1 } }
    });
    catalog
}
