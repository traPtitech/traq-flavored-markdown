use crate::abi::{self, Error};
use crate::buffers::IO;
use std::cell::RefCell;
use traq_markdown_processing::extraction::{Extractor, ExtractorOptions};

thread_local! { static EXTRACTOR: RefCell<Option<Extractor>> = const { RefCell::new(None) }; }

#[unsafe(no_mangle)]
pub extern "C" fn configure_extractor() -> u32 {
    IO.with_borrow_mut(|io| {
        let result = (|| -> Result<_, Error> {
            let source = io.source()?;
            let options: ExtractorOptions = serde_json::from_str(source).map_err(Error::request)?;
            let extractor = Extractor::new(options).map_err(Error::processing)?;
            EXTRACTOR.set(Some(extractor));
            Ok(abi::configured())
        })();
        io.reply(&result);
        io.output.len() as u32
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn extract() -> u32 {
    IO.with_borrow_mut(|io| {
        let result = io.document().and_then(|document| {
            EXTRACTOR.with_borrow(|extractor| {
                extractor
                    .as_ref()
                    .ok_or_else(Error::not_configured)?
                    .extract_validated(document.validated())
                    .map_err(Error::processing)
            })
        });
        io.reply(&result);
        io.output.len() as u32
    })
}
