use markdown_ast::ValidationLimits;

/// JSON framing and document limits shared by encoding and decoding.
#[derive(Clone, Copy)]
pub struct CodecLimits {
    pub json_bytes: usize,
    pub document: ValidationLimits,
}

impl Default for CodecLimits {
    fn default() -> Self {
        Self {
            json_bytes: 8 * 1024 * 1024,
            document: ValidationLimits::default(),
        }
    }
}
