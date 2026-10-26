use markdown_commonmark_contracts::{CodeBlock, Paragraph};
use markdown_extensions_syntax::math::{self, BlockMath};
use markdown_parser::{GrammarBuilder, Parser};

fn parser() -> Parser {
    let commonmark = markdown_commonmark::Syntax::new();
    let mut builder = GrammarBuilder::new();
    builder.add(&commonmark.plugin).unwrap();
    builder.add(math::plugin()).unwrap();
    builder
        .before(math::block_rule(), &commonmark.block.fence)
        .unwrap();
    Parser::new(&builder.build().unwrap())
}

#[test]
fn trailing_whitespace_closes_a_single_line_formula_before_following_text() {
    let parser = parser();
    for indent in 0..=3 {
        for suffix in ["", " ", "\t", " \t  "] {
            let source = format!(
                "説明\n{}$$x^2 + y^2$${suffix}\n続く説明",
                " ".repeat(indent)
            );
            let document = parser.parse(&source).unwrap();
            assert_eq!(document.children.len(), 3, "{source:?}");
            assert!(document.children[0].payload::<Paragraph>().is_some());
            let math = &document.children[1];
            assert_eq!(math.payload::<BlockMath>().unwrap().tex, "x^2 + y^2");
            assert_eq!(
                &source[math.span.start..math.span.end],
                format!("{}$$x^2 + y^2$${suffix}\n", " ".repeat(indent))
            );
            assert!(document.children[2].payload::<Paragraph>().is_some());
        }
    }
}

#[test]
fn indented_multiline_formulas_preserve_body_text_and_stop_at_the_closing_line() {
    let parser = parser();
    for indent in 0..=3 {
        let source = format!("{}$$a +\n  b\t$$ \t\n続く説明", " ".repeat(indent));
        let document = parser.parse(&source).unwrap();
        assert_eq!(document.children.len(), 2, "{source:?}");
        assert_eq!(
            document.children[0].payload::<BlockMath>().unwrap().tex,
            "a +\n  b\t"
        );
        assert!(document.children[1].payload::<Paragraph>().is_some());
    }
}

#[test]
fn math_indentation_is_relative_to_list_and_quote_containers() {
    let parser = parser();
    for source in [
        "- 項目\n\n     $$x$$ \t\n\n- 次の項目",
        ">    $$x$$ \t\n> 説明",
    ] {
        let document = parser.parse(source).unwrap();
        let container = &document.children[0];
        let math = if source.starts_with('-') {
            &container.children[0].children[1]
        } else {
            &container.children[0]
        };
        assert_eq!(math.payload::<BlockMath>().unwrap().tex, "x", "{source:?}");
    }
}

#[test]
fn code_blocks_keep_precedence_over_math_with_four_columns_of_indentation() {
    let parser = parser();
    for prefix in ["    ", "     ", "\t", " \t"] {
        let source = format!("{prefix}$$x$$");
        let document = parser.parse(&source).unwrap();
        assert_eq!(document.children.len(), 1);
        assert!(
            document.children[0].payload::<CodeBlock>().is_some(),
            "{source:?}"
        );
        let source = format!("文章\n{prefix}$$x$$");
        let document = parser.parse(&source).unwrap();
        assert_eq!(document.children.len(), 1);
        assert!(
            document.children[0].payload::<Paragraph>().is_some(),
            "{source:?}"
        );
    }
    let document = parser.parse("```\n   $$x$$\n```").unwrap();
    assert!(document.children[0].payload::<CodeBlock>().is_some());
}
