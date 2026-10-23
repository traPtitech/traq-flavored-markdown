//! A configured pipeline keeps parsing and related consumers on one native tree.
use crate::{
    abi::{self, Error, ErrorCode, ProcessorConfiguration},
    buffers::IO,
    grammar,
};
use serde::Serialize;
use std::cell::RefCell;
use traq_markdown_grammar::{Grammar, bindings};
use traq_markdown_processing::pipeline::{ProcessingResult, Processor};

struct Pipeline {
    grammar: Grammar,
    processor: Processor,
}
thread_local! { static PIPELINE: RefCell<Option<Pipeline>> = const { RefCell::new(None) }; }

#[derive(Serialize)]
struct ProcessedDocument {
    document: serde_json::Value,
    #[serde(flatten)]
    processing: ProcessingResult,
}

#[unsafe(no_mangle)]
pub extern "C" fn configure_processor() -> u32 {
    IO.with_borrow_mut(|io| {
        let result = (|| {
            let config: ProcessorConfiguration =
                serde_json::from_str(io.source()?).map_err(Error::request)?;
            let grammar = bindings::grammar(&config.preset)
                .map_err(|error| Error::new(ErrorCode::UnknownPreset, error))?;
            let processor = Processor::new(config.options).map_err(Error::processing)?;
            PIPELINE.set(Some(Pipeline { grammar, processor }));
            Ok::<_, Error>(abi::configured())
        })();
        io.reply(&result);
        io.output.len() as u32
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn process(mode: u32) -> u32 {
    IO.with_borrow_mut(|io| {
        let result = (|| {
            let source = io.source()?;
            PIPELINE.with_borrow(|pipeline| {
                let pipeline = pipeline.as_ref().ok_or_else(Error::not_configured)?;
                let document = grammar::parse(&pipeline.grammar, source, mode)?;
                let processing = pipeline
                    .processor
                    .process(document.as_view())
                    .map_err(Error::processing)?;
                // Encode the original validated tree once for host HTML and editing consumers.
                let document = serde_json::from_slice(&io.encode_document(&document)?)
                    .map_err(|error| Error::new(ErrorCode::InternalError, error))?;
                Ok::<_, Error>(ProcessedDocument {
                    document,
                    processing,
                })
            })
        })();
        io.reply(&result);
        io.output.len() as u32
    })
}
