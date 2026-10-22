//! A Rust-owned parser with a small, language-neutral host ABI.
mod abi;
mod buffers;
mod contract;
mod extraction;
mod grammar;
mod limits;
mod pipeline;
mod rendering;
#[macro_use]
mod node_catalog;
mod nodes;

use abi::Error;
use buffers::IO;

/// mode: 0=document, 1=inline. Configure the instance before parsing.
#[unsafe(no_mangle)]
pub extern "C" fn parse(mode: u32) -> u32 {
    IO.with_borrow_mut(|io| {
        let result = io.source().and_then(|source| {
            let grammar = grammar::get().ok_or_else(Error::not_configured)?;
            grammar::parse(&grammar, source, mode)
        });
        io.reply_document(&result);
        io.output.len() as u32
    })
}
