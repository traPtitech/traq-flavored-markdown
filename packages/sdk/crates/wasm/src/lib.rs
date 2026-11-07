//! A Rust-owned parser with a small, language-neutral host ABI.
mod abi;
mod buffers;
mod contract;
mod extraction;
mod grammar;
mod limits;
mod node_catalog;
mod nodes;
mod pipeline;
mod rendering;
mod source_syntax;

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

/// mode: 0=document, 1=inline. Source facts share this parse's validated document.
#[unsafe(no_mangle)]
pub extern "C" fn parse_with_syntax(mode: u32) -> u32 {
    IO.with_borrow_mut(|io| {
        let result = (|| {
            let grammar = grammar::get().ok_or_else(Error::not_configured)?;
            let parser = traq_markdown_grammar::Parser::new(&grammar);

            let parsed = match mode {
                0 => parser.parse_with_syntax(io.source()?),
                1 => parser.parse_inline_with_syntax(io.source()?),

                _ => {
                    return Err(Error::new(
                        abi::ErrorCode::InvalidMode,
                        "parse mode must be 0 or 1",
                    ));
                }
            }
            .map_err(Error::from)?;

            Ok((
                parsed.document,
                source_syntax::SyntaxRecords::try_from(parsed.syntax)?,
            ))
        })();

        match result {
            Ok((document, syntax)) => {
                let reply = crate::nodes::codec()
                    .serialization_view(&document, Default::default())
                    .map_err(Error::encoding)
                    .map(|document| source_syntax::ParsedSyntaxReply { document, syntax });

                io.reply(&reply);
            }

            Err(error) => {
                io.reply::<()>(&Err(error));
            }
        }

        io.output.len() as u32
    })
}
