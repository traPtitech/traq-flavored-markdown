//! Distribution-owned node selection.
macro_rules! node_types {
    ($register:ident) => {
        $register! { "commonmark", markdown_commonmark_contracts,
            Paragraph, Heading, Blockquote, List, ListItem, CodeBlock, ThematicBreak,
            Text, Softbreak, Hardbreak, InlineCode, Emphasis, Strong, Link, Image,
            HtmlInline, HtmlBlock,
        }
        $register! { "generic", markdown_generic_contracts,
            InlineMathData, BlockMathData, TableData, RowData, CellData,
            MarkData, StrikethroughData,
        }
        $register! { "trap", markdown_trap_contracts,
            StampData, ReferenceData, EmbeddingData, SpoilerData, BlankLineData,
        }
    };
}
