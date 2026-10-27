use markdown_commonmark::Syntax;
use markdown_commonmark_contracts::{CodeBlock, List, Paragraph, Text};
use markdown_parser::rules::block::{BlockMatch, BlockRule};
use markdown_parser::{GrammarBuilder, Limits, ParseError, ParseResource, Parser};

fn parser() -> Parser {
    let syntax = Syntax::default();
    let mut builder = GrammarBuilder::new();
    builder.add(&syntax.plugin).unwrap();
    Parser::new(&builder.build().unwrap())
}

fn assert_work_limit(result: Result<markdown_parser::Document, ParseError>) {
    assert!(matches!(
        result,
        Err(ParseError::ResourceLimit {
            resource: ParseResource::Work,
        })
    ));
}

#[test]
fn blank_line_lookahead_spends_work_before_accepting_a_continuation() {
    for source in [
        format!("    a\n{}    b\n", "\n".repeat(4_000)),
        // An empty list item looks ahead without parsing the skipped blank
        // lines again, so later parser stages cannot hide uncharged lookahead.
        format!("-\n{}  b\n", "\n".repeat(4_000)),
    ] {
        let work = source.len() + 100;
        assert_work_limit(
            parser()
                .with_limits(Limits {
                    work,
                    ..Limits::default()
                })
                .parse(&source),
        );
    }
}

#[test]
fn rejected_blank_line_lookahead_still_spends_work() {
    // Consume the remaining blank lines in one test rule. Otherwise the work
    // they spend after the rejected lookahead could mask a missing charge.
    let mut syntax = Syntax::default();
    let drain = BlockRule::new(|input, _| {
        Ok(input
            .current()
            .is_empty()
            .then(|| BlockMatch::ignore(input.lines.end())))
    });
    syntax.plugin.add(&drain);
    let mut builder = GrammarBuilder::new();
    builder.add(&syntax.plugin).unwrap();
    builder.before(&drain, &syntax.block.blank).unwrap();
    let grammar = builder.build().unwrap();

    for suffix in ["outside\n", ""] {
        let source = format!("    a\n{}{suffix}", "\n".repeat(4_000));
        assert_work_limit(
            Parser::new(&grammar)
                .with_limits(Limits {
                    work: source.len() + 100,
                    ..Limits::default()
                })
                .parse(&source),
        );
    }
}

#[test]
fn large_code_block_blank_run_fits_a_linear_work_budget() {
    let blanks = "\n".repeat(64_000);
    let source = format!("    a\n{blanks}    b\n");
    let document = parser()
        .with_limits(Limits {
            work: source.len() * 8,
            ..Limits::default()
        })
        .parse(&source)
        .unwrap();
    assert_eq!(document.children.len(), 1);
    let code = document.children[0].payload::<CodeBlock>().unwrap();
    assert_eq!(code.literal, format!("a\n{blanks}b\n"));
}

#[test]
fn large_list_blank_run_keeps_both_paragraphs_with_linear_work() {
    let source = format!("- a\n{}  b\n", "\n".repeat(8_000));
    let document = parser()
        .with_limits(Limits {
            work: source.len() * 16,
            ..Limits::default()
        })
        .parse(&source)
        .unwrap();
    assert_eq!(document.children.len(), 1);
    let list = &document.children[0];
    assert!(!list.payload::<List>().unwrap().tight);
    let paragraphs = &list.children[0].children;
    assert_eq!(paragraphs.len(), 2);
    for (paragraph, expected) in paragraphs.iter().zip(["a", "b"]) {
        assert!(paragraph.payload::<Paragraph>().is_some());
        assert_eq!(
            paragraph.children[0].payload::<Text>().unwrap().value,
            expected
        );
    }
}

#[test]
fn long_lazy_quote_continuations_do_not_turn_into_setext_headings() {
    let source = format!("> a\n{}===\n", "a\n".repeat(4_000));
    let document = parser().parse(&source).unwrap();
    let paragraph = &document.children[0].children[0];
    assert!(paragraph.payload::<Paragraph>().is_some());
    assert_eq!(
        paragraph
            .children
            .last()
            .unwrap()
            .payload::<Text>()
            .unwrap()
            .value,
        "==="
    );
}
