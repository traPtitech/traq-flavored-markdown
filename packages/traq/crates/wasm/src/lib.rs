//! A Rust-owned parser with a small, language-neutral host ABI.
mod buffers;
mod contract;
mod extraction;
mod grammar;
mod limits;
mod rendering;
#[macro_use]
mod node_types;
mod nodes;

use buffers::IO;
use traq_markdown_grammar::{ParseError, Parser};

#[unsafe(no_mangle)]
pub extern "C" fn abi_version() -> u32 {
    3
}

#[unsafe(no_mangle)]
pub extern "C" fn ast_version() -> u32 {
    4
}

/// mode: 0=document, 1=inline. Configure the instance before parsing.
#[unsafe(no_mangle)]
pub extern "C" fn parse(mode: u32) -> u32 {
    IO.with_borrow_mut(|io| {
        let result = io.source().and_then(|source| {
            let grammar = grammar::get().ok_or(ParseError::InternalError)?;
            let parser = Parser::new(&grammar);
            match mode {
                0 => parser.parse(source),
                1 => parser.parse_inline(source),
                _ => Err(ParseError::InternalError),
            }
        });
        io.reply_document(&result);
        io.output.len() as u32
    })
}
