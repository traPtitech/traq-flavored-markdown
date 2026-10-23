use markdown_ast::{MutableDocument, Node, Span};
use markdown_extractor::{AnalysisContext, Collector, Error, Extractor, Plugin, PresetBuilder};

#[markdown_definitions::node(role = Opaque, children = Any)]
#[derive(Debug, Clone, PartialEq)]
struct Item;

#[derive(Default)]
struct Depths(Vec<(usize, usize)>);
impl<'a> Collector<'a> for Depths {
    type Scope = usize;
    type Error = Error;
    fn initial(&self) -> usize {
        0
    }
    fn observe(&mut self, context: AnalysisContext<'a>, inherited: &usize) -> Result<usize, Error> {
        self.0.push((context.visit.node.span.start, *inherited));
        Ok(inherited + 1)
    }
}

#[test]
fn typed_handlers_and_scoped_collectors_share_source_and_location() {
    let document = MutableDocument {
        source: "abc".into(),
        children: vec![
            Node::new(
                Span { start: 0, end: 2 },
                Item,
                vec![Node::leaf(Span { start: 1, end: 2 }, Item)],
            ),
            Node::leaf(Span { start: 2, end: 3 }, Item),
        ],
    }
    .finish()
    .unwrap();
    let mut plugin = Plugin::<Vec<String>>::new(&markdown_definitions::Plugin::new("source"));
    plugin
        .on::<Item>(|_, context, result| {
            let span = context.visit.node.span;
            result.push(context.source[span.start..span.end].into());
            Ok(())
        })
        .unwrap();
    let mut builder = PresetBuilder::new();
    builder.add(&plugin).unwrap();
    let extractor = Extractor::new(&builder.build().unwrap());
    let mut collectors = (Depths::default(), extractor.collector::<Error>());
    markdown_extractor::collect(&document, &mut collectors).unwrap();
    assert_eq!(collectors.0.0, [(0, 0), (1, 1), (2, 0)]);
    assert_eq!(collectors.1.finish(), ["ab", "b", "c"]);
}
