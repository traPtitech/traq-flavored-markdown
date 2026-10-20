//! A Rust-owned parser with a small, language-neutral host ABI.
mod abi;
mod buffers;
mod contract;
mod extraction;
mod grammar;
mod limits;
mod rendering;
#[macro_use]
mod node_catalog;
mod nodes;

use abi::{Error, ErrorCode};
use buffers::IO;
use traq_markdown_grammar::Parser;

/// mode: 0=document, 1=inline. Configure the instance before parsing.
#[unsafe(no_mangle)]
pub extern "C" fn parse(mode: u32) -> u32 {
    IO.with_borrow_mut(|io| {
        let result = io.source().and_then(|source| {
            let grammar = grammar::get().ok_or_else(Error::not_configured)?;
            let parser = Parser::new(&grammar);
            match mode {
                0 => parser.parse_validated(source).map_err(Error::from),
                1 => parser.parse_inline_validated(source).map_err(Error::from),
                _ => Err(Error::new(
                    ErrorCode::InvalidMode,
                    "parse mode must be 0 or 1",
                )),
            }
        });
        io.reply_document(&result);
        io.output.len() as u32
    })
}
