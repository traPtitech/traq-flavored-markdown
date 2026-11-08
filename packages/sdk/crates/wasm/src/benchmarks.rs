use std::{hint::black_box, time::Instant};
use traq_markdown_processing::pipeline::{Processor, ProcessorOptions};

fn measure<T>(name: &str, iterations: u32, mut operation: impl FnMut() -> T) {
    black_box(operation());
    let start = Instant::now();

    for _ in 0..iterations {
        black_box(operation());
    }

    eprintln!(
        "{name}: {:?}/iteration ({iterations} iterations)",
        start.elapsed() / iterations
    );
}

#[test]
#[ignore = "manual native pipeline benchmark; run in release mode"]
fn benchmark_pipeline_stages() {
    let parser = traq_markdown_grammar::presets::traq::v1::parser();
    let processor = Processor::new(ProcessorOptions::default()).unwrap();
    let codec = crate::nodes::codec();
    let source =
        "## 日😀\n\n> **bold** and [link](https://example.com) :stamp:\n\n- a\n- b\n\n".repeat(40);
    let document = parser.parse(&source).unwrap();
    let bytes = codec.encode(&document).unwrap();

    measure("parse", 200, || parser.parse(black_box(&source)).unwrap());

    measure("parse with syntax", 200, || {
        parser.parse_with_syntax(black_box(&source)).unwrap()
    });

    measure("encode", 200, || {
        codec.encode(black_box(&document)).unwrap()
    });

    measure("decode", 200, || codec.decode(black_box(&bytes)).unwrap());

    measure("process existing document", 200, || {
        processor.process(black_box(document.as_view())).unwrap()
    });

    measure("parse and process native document", 200, || {
        let parsed = parser.parse(black_box(&source)).unwrap();
        processor.process(parsed.as_view()).unwrap()
    });
}
