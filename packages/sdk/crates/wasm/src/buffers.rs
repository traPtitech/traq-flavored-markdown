use crate::abi::{Error, ErrorCode};
use serde::{Serialize, ser::SerializeMap};
use std::cell::RefCell;

use crate::limits::{MAX_INPUT, MAX_OUTPUT};

#[derive(Default)]
pub struct Buffers {
    input: Vec<u8>,
    pub output: Vec<u8>,
    valid: bool,
}
thread_local! { pub static IO: RefCell<Buffers> = RefCell::default(); }

impl Buffers {
    pub fn document(&self) -> Result<markdown_ast::Document, Error> {
        let source = self.source()?;
        crate::nodes::codec()
            .decode_with_limits(
                source.as_bytes(),
                markdown_codec::CodecLimits {
                    json_bytes: MAX_INPUT,
                    ..Default::default()
                },
            )
            .map_err(Error::document)
    }

    pub fn reply_document(&mut self, result: &Result<markdown_ast::Document, Error>) {
        let result = result.as_ref().map_err(Clone::clone).and_then(|document| {
            crate::nodes::codec()
                .serialization_view(document, Default::default())
                .map_err(Error::encoding)
        });
        self.reply(&result);
    }

    pub fn source(&self) -> Result<&str, Error> {
        if !self.valid {
            return Err(Error::new(
                ErrorCode::InvalidRequest,
                "input buffer is not initialized",
            ));
        }
        std::str::from_utf8(&self.input).map_err(|invalid| {
            let mut error = Error::new(ErrorCode::InvalidUtf8, "input is not valid UTF-8");
            error.offset = Some(invalid.valid_up_to() as u32);
            error
        })
    }

    pub fn reply<T: Serialize>(&mut self, result: &Result<T, Error>) -> bool {
        self.output.clear();
        match markdown_codec::write_json(&mut self.output, &Reply(result), MAX_OUTPUT) {
            Ok(()) => true,
            Err(error) => {
                self.output.clear();
                // The fallback has bounded, static text even for custom serializers.
                let error = if error.resource() == Some("json_bytes") {
                    Error::limit("output_bytes")
                } else {
                    Error::new(ErrorCode::InternalError, "response serialization failed")
                };
                let fallback = Err::<(), _>(error);
                if markdown_codec::write_json(&mut self.output, &Reply(&fallback), MAX_OUTPUT)
                    .is_err()
                {
                    self.output.clear();
                }
                false
            }
        }
    }
}

struct Reply<'a, T>(&'a Result<T, Error>);

impl<T: Serialize> Serialize for Reply<'_, T> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut map = serializer.serialize_map(Some(1))?;
        match self.0 {
            Ok(value) => map.serialize_entry("ok", value)?,
            Err(error) => map.serialize_entry("error", error)?,
        }
        map.end()
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn replies_have_one_typed_outcome_and_bounded_output() {
        let mut io = Buffers::default();
        assert!(io.reply(&Ok("text")));
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&io.output).unwrap(),
            json!({"ok":"text"})
        );
        assert!(io.reply::<()>(&Err(Error::not_configured())));
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&io.output).unwrap()["error"]["code"],
            "not_configured"
        );
        assert!(!io.reply(&Ok("x".repeat(MAX_OUTPUT))));
        let reply: serde_json::Value = serde_json::from_slice(&io.output).unwrap();
        assert_eq!(reply["error"]["resource"], "output_bytes");
        assert!(reply["error"]["message"].is_string());
        assert!(io.output.len() <= MAX_OUTPUT);
    }

    #[test]
    fn invalid_utf8_retains_its_byte_offset() {
        let io = Buffers {
            input: vec![b'a', 0xff],
            valid: true,
            ..Default::default()
        };
        let error = io.source().unwrap_err();
        assert!(matches!(error.code, ErrorCode::InvalidUtf8));
        assert_eq!(error.offset, Some(1));
    }

    #[test]
    fn serialization_failures_are_not_reported_as_resource_limits() {
        struct Broken;
        impl Serialize for Broken {
            fn serialize<S: serde::Serializer>(&self, _: S) -> Result<S::Ok, S::Error> {
                Err(serde::ser::Error::custom("broken payload serializer"))
            }
        }
        let mut io = Buffers::default();
        assert!(!io.reply(&Ok(Broken)));
        let reply: serde_json::Value = serde_json::from_slice(&io.output).unwrap();
        assert_eq!(reply["error"]["code"], "internal_error");
        assert!(reply["error"].get("resource").is_none());
    }

    #[test]
    fn parsed_documents_reuse_the_validated_owner() {
        let parser = traq_markdown_grammar::presets::traq::v1::parser();
        let result = parser.parse("\u{feff}é\r\n\0😀").map_err(Error::from);
        let mut io = Buffers::default();
        io.reply_document(&result);
        let reply: serde_json::Value = serde_json::from_slice(&io.output).unwrap();
        assert_eq!(reply["ok"]["source"], "\u{feff}é\r\n\0😀");
    }
}
