use crate::buffers::IO;
use std::cell::RefCell;
use traq_markdown_processing::rendering::{PlainTextRenderer, RendererOptions};

thread_local! { static RENDERER: RefCell<Option<PlainTextRenderer>> = const { RefCell::new(None) }; }

#[unsafe(no_mangle)]
pub extern "C" fn configure_renderer() -> u32 {
    IO.with_borrow_mut(|io| {
        let result = (|| -> Result<_, String> {
            let source = io.source().map_err(|error| error.to_string())?;
            let options: RendererOptions =
                serde_json::from_str(source).map_err(|error| error.to_string())?;
            let renderer = PlainTextRenderer::new(options)?;
            RENDERER.set(Some(renderer));
            Ok(env!("MARKDOWN_BUILD_ID"))
        })();
        io.reply("configured", &result);
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
                    .ok_or_else(|| "renderer is not configured".to_owned())?
                    .render(&document)
                    .map_err(str::to_owned)
            })
        });
        io.reply("result", &result);
        io.output.len() as u32
    })
}
