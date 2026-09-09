use super::InlineMathData;

use markdown_parser::{
    ParseError,
    engine::{
        Budget,
        inline::{InlineInput, InlineMatch},
    },
};

pub(super) fn parse(
    input: &InlineInput<'_>,
    budget: &mut Budget,
) -> Result<Option<InlineMatch>, ParseError> {
    let pos = input.position;
    let bytes = input.source.text().as_bytes();

    if matches!(bytes.get(pos + 1), Some(b' ' | b'\t')) {
        return Ok(Some(InlineMatch::literal(pos + 1)));
    }

    let (mut end, mut slashes) = (pos + 1, 0);

    while end < bytes.len() {
        budget.spend(1)?;
        let byte = bytes[end];

        if byte == b'$' && slashes % 2 == 0 {
            if end == pos + 1 {
                return Ok(Some(InlineMatch::literal(pos + 2)));
            }

            if matches!(bytes[end - 1], b' ' | b'\t')
                || bytes.get(end + 1).is_some_and(u8::is_ascii_digit)
            {
                return Ok(Some(InlineMatch::literal(pos + 1)));
            }

            let data = InlineMathData {
                tex: input.source.text()[pos + 1..end].into(),
            };

            return Ok(Some(InlineMatch::leaf(
                end + 1,
                markdown_parser::NodeKind::new(data),
            )));
        }

        slashes = if byte == b'\\' { slashes + 1 } else { 0 };
        end += 1;
    }

    Ok(Some(InlineMatch::literal(pos + 1)))
}
