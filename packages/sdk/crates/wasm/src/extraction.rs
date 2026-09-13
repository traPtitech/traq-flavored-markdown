use crate::buffers::IO;
use std::cell::RefCell;
use traq_markdown_processing::extraction::{Extractor, ExtractorOptions};

thread_local! { static EXTRACTOR: RefCell<Option<Extractor>> = const { RefCell::new(None) }; }

#[unsafe(no_mangle)]
pub extern "C" fn configure_extractor() -> u32 {
    IO.with_borrow_mut(|io| {
        let result = (|| -> Result<_, String> {
            let source = io.source().map_err(|error| error.to_string())?;
            let options: ExtractorOptions =
                serde_json::from_str(source).map_err(|error| error.to_string())?;
            let extractor = Extractor::new(options)?;
            EXTRACTOR.set(Some(extractor));
            Ok(env!("MARKDOWN_BUILD_ID"))
        })();
        io.reply("configured", &result);
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
                    .ok_or_else(|| "extractor is not configured".to_owned())?
                    .extract(&document)
            })
        });
        io.reply("result", &result);
        io.output.len() as u32
    })
}
