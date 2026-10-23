use super::buffers::IO;
use crate::abi::{self, Error, ErrorCode};
use std::cell::RefCell;
use traq_markdown_grammar::Grammar;
use traq_markdown_grammar::bindings;

thread_local! { static GRAMMAR: RefCell<Option<Grammar>> = const { RefCell::new(None) }; }

pub fn get() -> Option<Grammar> {
    GRAMMAR.with_borrow(Clone::clone)
}

pub fn parse(grammar: &Grammar, source: &str, mode: u32) -> Result<markdown_ast::Document, Error> {
    let parser = traq_markdown_grammar::Parser::new(grammar);
    match mode {
        0 => parser.parse(source).map_err(Error::from),
        1 => parser.parse_inline(source).map_err(Error::from),
        _ => Err(Error::new(
            ErrorCode::InvalidMode,
            "parse mode must be 0 or 1",
        )),
    }
}

/// Resolve the version in the Rust distribution, then configure this parser.
#[unsafe(no_mangle)]
pub extern "C" fn configure() -> u32 {
    IO.with_borrow_mut(|io| {
        let result = (|| -> Result<_, Error> {
            let source = io.source()?;
            let grammar = bindings::grammar(source)
                .map_err(|error| Error::new(ErrorCode::UnknownPreset, error))?;
            GRAMMAR.set(Some(grammar));
            Ok(abi::configured())
        })();
        io.reply(&result);
        io.output.len() as u32
    })
}
