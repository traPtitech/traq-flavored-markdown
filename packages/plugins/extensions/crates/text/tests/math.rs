use markdown_ast::{Document, Node, Span};
use markdown_extensions_contracts::{BlockMath, InlineMath};
use markdown_extensions_text::math::{self, Options, Style};
use markdown_renderer::{Plugin, PresetBuilder, Renderer};

fn renderer(plugin: &Plugin) -> Renderer {
    let mut builder = PresetBuilder::new();
    builder.add(plugin).unwrap();
    Renderer::new(&builder.build().unwrap())
}

fn document() -> Document {
    Document {
        source: String::new(),
        children: vec![
            Node::leaf(Span { start: 0, end: 0 }, InlineMath { tex: "x".into() }),
            Node::leaf(Span { start: 0, end: 0 }, BlockMath { tex: "y".into() }),
        ],
    }
}

#[test]
fn options_select_plain_or_delimited_tex() {
    assert_eq!(
        renderer(&math::plugin()).render(&document()).unwrap(),
        "xy\n"
    );
    assert_eq!(
        renderer(&math::plugin_with_options(Options {
            style: Style::DelimitedTex,
        }))
        .render(&document())
        .unwrap(),
        "$x$$$y$$\n"
    );
}
