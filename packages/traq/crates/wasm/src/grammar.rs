use super::buffers::IO;
use std::cell::RefCell;
use traq_markdown_grammar::{Grammar, bindings};

thread_local! { static GRAMMAR: RefCell<Option<Grammar>> = const { RefCell::new(None) }; }

pub fn get() -> Option<Grammar> {
    GRAMMAR.with_borrow(Clone::clone)
}

/// Resolve the version in the Rust distribution, then configure this parser.
#[unsafe(no_mangle)]
pub extern "C" fn configure() -> u32 {
    IO.with_borrow_mut(|io| {
        let result = (|| -> Result<_, String> {
            let source = io.source().map_err(|error| error.to_string())?;
            let grammar = bindings::grammar(source).map_err(|error| error.to_string())?;
            GRAMMAR.set(Some(grammar));
            Ok(env!("MARKDOWN_BUILD_ID"))
        })();
        io.reply("configured", &result);
        io.output.len() as u32
    })
}
