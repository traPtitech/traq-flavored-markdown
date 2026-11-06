use markdown_definitions::PluginDeclaration;
use markdown_parser::{Parser, Span, SyntaxPlugin, rules::inline::InlineRule};
use std::sync::{Arc, Mutex};
use traq_markdown_grammar::presets;

#[test]
fn rules_can_read_exact_origins_after_real_container_and_table_transformations() {
    for (source, view, pieces) in [
        ("> **a\n> ^b**", "**a\n^b**", vec!["**a\n", "^b**"]),
        ("> **a\r\n> ^b**", "**a\n^b**", vec!["**a\r\n", "^b**"]),
        ("> **a\r> ^b**", "**a\n^b**", vec!["**a\r", "^b**"]),
        ("> - a\r\n>   ^b", "a\n^b", vec!["a\r\n", "^b"]),
        ("| a\\|^b |\n| --- |", "a|^b", vec!["a", "|^b"]),
        ("- a\n\t^b", "a\n  ^b", vec!["a\n\t^b"]),
    ] {
        let observations = Arc::new(Mutex::new(Vec::<(String, Vec<Span>)>::new()));
        let captured = observations.clone();
        let mut observer = SyntaxPlugin::new(&PluginDeclaration::new("source-observer"));
        observer.add(InlineRule::new(b"^", move |input, _| {
            captured.lock().unwrap().push((
                input.source.text().into(),
                input
                    .source
                    .source_spans(input.source.range(0..input.source.text().len())?)?,
            ));
            // Observe without claiming syntax or changing the parsed document.
            Ok(None)
        }));
        let mut builder = presets::traq::v1::builder();
        builder.add(&observer).unwrap();
        let parsed = Parser::new(&builder.build().unwrap())
            .parse(source)
            .unwrap();
        let baseline = presets::traq::v1::parser().parse(source).unwrap();
        assert_eq!(parsed.children, baseline.children, "{source:?}");

        let observations = observations.lock().unwrap();
        assert_eq!(observations.len(), 1, "{source:?}");
        assert_eq!(observations[0].0, view, "{source:?}");
        let slices: Vec<_> = observations[0]
            .1
            .iter()
            .map(|span| &source[span.start..span.end])
            .collect();
        assert_eq!(slices, pieces, "{source:?}");
    }
}
