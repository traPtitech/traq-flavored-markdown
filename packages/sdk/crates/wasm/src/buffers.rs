use serde::{Serialize, ser::SerializeMap};
use std::{
    cell::RefCell,
    io::{self, Write},
};
use traq_markdown_grammar::ParseError;

use crate::limits::{MAX_INPUT, MAX_OUTPUT};

#[derive(Default)]
pub struct Buffers {
    input: Vec<u8>,
    pub output: Vec<u8>,
    valid: bool,
}
thread_local! { pub static IO: RefCell<Buffers> = RefCell::default(); }

impl Buffers {
    pub fn document(&self) -> Result<markdown_ast::Document, String> {
        let source = self.source().map_err(|error| error.to_string())?;
        crate::nodes::codec()
            .decode_with_limits(
                source.as_bytes(),
                markdown_codec::DecodeLimits {
                    json_bytes: MAX_INPUT,
                    ..Default::default()
                },
            )
            .map_err(|error| error.to_string())
    }

    pub fn reply_document(&mut self, result: &Result<markdown_ast::Document, ParseError>) {
        let result = match result {
            Ok(document) => self.encode_document(document),
            Err(error) => Err(error.clone()),
        };
        match result {
            Ok(bytes) => self.write_document(&bytes),
            Err(error) => self.reply_document_error(&error),
        }
    }

    fn encode_document(&self, document: &markdown_ast::Document) -> Result<Vec<u8>, ParseError> {
        let bytes = crate::nodes::codec().encode(document).map_err(|error| {
            if error.is_io() {
                ParseError::ResourceLimit {
                    resource: "output_bytes".into(),
                }
            } else {
                ParseError::InternalError
            }
        })?;
        if bytes.len() + 13 > MAX_OUTPUT {
            return Err(ParseError::ResourceLimit {
                resource: "output_bytes".into(),
            });
        }
        Ok(bytes)
    }

    fn write_document(&mut self, bytes: &[u8]) {
        self.output.clear();
        self.output.extend_from_slice(b"{\"document\":");
        self.output.extend_from_slice(bytes);
        self.output.push(b'}');
    }

    fn reply_document_error(&mut self, error: &ParseError) {
        self.reply::<(), _>("document", &Err(error));
    }

    pub fn source(&self) -> Result<&str, ParseError> {
        if !self.valid {
            return Err(ParseError::InternalError);
        }
        std::str::from_utf8(&self.input).map_err(|_| ParseError::InvalidUtf8)
    }

    pub fn reply<T: Serialize, E: Serialize>(
        &mut self,
        field: &'static str,
        result: &Result<T, E>,
    ) -> bool {
        self.output.clear();
        let success =
            serde_json::to_writer(LimitedOutput(&mut self.output), &Reply(field, result)).is_ok();
        if !success {
            self.output.clear();
            self.output.extend_from_slice(
                b"{\"error\":{\"code\":\"resource_limit\",\"resource\":\"output_bytes\"}}",
            );
        }
        success
    }
}

struct Reply<'a, T, E>(&'static str, &'a Result<T, E>);

impl<T: Serialize, E: Serialize> Serialize for Reply<'_, T, E> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut map = serializer.serialize_map(Some(1))?;
        match self.1 {
            Ok(value) => map.serialize_entry(self.0, value)?,
            Err(error) => map.serialize_entry("error", error)?,
        }
        map.end()
    }
}

struct LimitedOutput<'a>(&'a mut Vec<u8>);

impl Write for LimitedOutput<'_> {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        if bytes.len() > MAX_OUTPUT.saturating_sub(self.0.len()) {
            return Err(io::ErrorKind::FileTooLarge.into());
        }
        self.0.extend_from_slice(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn input_ptr(len: u32) -> u32 {
    IO.with_borrow_mut(|io| {
        io.output.clear();
        io.input.clear();
        io.valid = false;
        if len as usize > MAX_INPUT {
            return 0;
        }
        io.input.reserve((len as usize).max(1));
        io.input.resize(len as usize, 0);
        io.valid = true;
        io.input.as_mut_ptr() as u32
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn output_ptr() -> u32 {
    IO.with_borrow(|io| io.output.as_ptr() as u32)
}
