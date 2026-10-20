use crate::abi::{self, Error};
use crate::buffers::IO;
use std::cell::RefCell;
use traq_markdown_processing::rendering::{PlainTextRenderer, RendererOptions};

thread_local! { static RENDERER: RefCell<Option<PlainTextRenderer>> = const { RefCell::new(None) }; }

#[unsafe(no_mangle)]
pub extern "C" fn configure_renderer() -> u32 {
    IO.with_borrow_mut(|io| {
        let result = (|| -> Result<_, Error> {
            let source = io.source()?;
            let options: RendererOptions = serde_json::from_str(source).map_err(Error::request)?;
            let renderer = PlainTextRenderer::new(options).map_err(Error::processing)?;
            RENDERER.set(Some(renderer));
            Ok(abi::configured())
        })();
        io.reply(&result);
        io.output.len() as u32
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn render() -> u32 {
    IO.with_borrow_mut(|io| {
        let result = io.document().and_then(|document| {
            RENDERER.with_borrow(|renderer| {
                renderer
                    .as_ref()
                    .ok_or_else(Error::not_configured)?
                    .render_validated(document.validated())
                    .map_err(Error::processing)
            })
        });
        io.reply(&result);
        io.output.len() as u32
    })
}
