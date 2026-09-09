use super::{destination::destination, url};
use crate::references;
use markdown_commonmark_contracts::LinkForm;

use markdown_parser::{
    Node, NodeKind, ParseError,
    engine::{
        Budget,
        inline::{InlineAction, InlineInput, InlineMatch},
    },
};

#[derive(Clone, Copy)]
pub struct LinkOptions {
    pub direct_images: bool,
    pub nested_autolinks: bool,
    pub normalize: fn(&str) -> Option<String>,
}

impl Default for LinkOptions {
    fn default() -> Self {
        Self {
            direct_images: true,
            nested_autolinks: false,
            normalize: |value| Some(url::encode(value)),
        }
    }
}

pub fn link(
    input: &InlineInput<'_>,
    budget: &mut Budget,
    options: LinkOptions,
) -> Result<Option<InlineMatch>, ParseError> {
    let source = &input.source.text();
    let pos = input.position;
    let image = input.tail().starts_with("![");

    if source.as_bytes()[pos] == b'[' || image {
        return Ok(Some(InlineMatch {
            end: pos + if image { 2 } else { 1 },
            action: InlineAction::OpenBracket {
                tag: if image { "image" } else { "link" },
                inhibit_on_inner: !image || !options.direct_images,
            },
        }));
    }

    if source.as_bytes()[pos] != b']' {
        return Ok(None);
    }

    let discard = || {
        Some(InlineMatch {
            end: pos + 1,
            action: InlineAction::DiscardBracket,
        })
    };

    let Some(bracket) = input.bracket.filter(|b| b.active) else {
        return Ok(discard());
    };

    let direct = destination(source, pos + 1, budget, options.normalize)?;
    let image = bracket.tag == "image" && (options.direct_images || direct.is_none());

    let (end, target, title) = if let Some(direct) = direct {
        direct
    } else {
        let Some(reference) = reference_target(input, source, pos, bracket.label_start) else {
            return Ok(discard());
        };
        reference
    };

    let kind = if image {
        NodeKind::new(markdown_commonmark_contracts::Image {
            destination: target,
            title,
            label_source: source[bracket.label_start..pos].into(),
        })
    } else {
        NodeKind::new(markdown_commonmark_contracts::Link {
            destination: target,
            title,
            form: LinkForm::Explicit,
        })
    };

    Ok(Some(InlineMatch {
        end,
        action: InlineAction::CloseBracket {
            kind,
            prefix: usize::from(bracket.tag == "image" && !image),
            inhibit_brackets: !image,
        },
    }))
}

fn reference_target(
    input: &InlineInput<'_>,
    source: &str,
    pos: usize,
    label_start: usize,
) -> Option<(usize, String, Option<String>)> {
    let mut label = &source[label_start..pos];
    let mut end = pos + 1;

    if let Some(close) = references::label_end(&source[end..]) {
        let explicit = &source[end + 1..end + close];

        if !explicit.is_empty() {
            label = explicit;
        }

        end += close + 1;
    }

    let (target, title) = input.reference(&references::key(label))?;
    Some((end, target.clone(), title.clone()))
}

pub fn autolink(
    input: &InlineInput<'_>,
    budget: &mut Budget,
    options: LinkOptions,
) -> Result<Option<InlineMatch>, ParseError> {
    let source = &input.source.text();
    let pos = input.position;

    let mut end = pos + 1;

    while end < source.len() && source.as_bytes()[end] != b'>' {
        budget.spend(1)?;

        if source.as_bytes()[end] <= 32 || source.as_bytes()[end] == b'<' {
            return Ok(None);
        }

        end += 1;
    }

    if end == source.len() {
        return Ok(None);
    }

    let value = &source[pos + 1..end];
    let email = email(value);

    if !email && !valid_scheme(value) {
        return Ok(None);
    }

    let Some(destination) = (options.normalize)(&if email {
        format!("mailto:{value}")
    } else {
        value.into()
    }) else {
        return Ok(None);
    };

    let children = vec![Node::leaf(
        input.source.span_for(pos + 1..end)?,
        markdown_commonmark_contracts::Text {
            value: url::label(value),
        },
    )];

    Ok(Some(InlineMatch {
        end: end + 1,
        action: InlineAction::Node {
            kind: NodeKind::new(markdown_commonmark_contracts::Link {
                destination,
                title: None,
                form: LinkForm::Autolink,
            }),
            children,
            inhibit_brackets: !options.nested_autolinks,
        },
    }))
}

fn valid_scheme(value: &str) -> bool {
    let Some((scheme, _)) = value.split_once(':') else {
        return false;
    };

    (2..=32).contains(&scheme.len())
        && scheme.as_bytes()[0].is_ascii_alphabetic()
        && scheme
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"+.-".contains(&b))
}

fn email(value: &str) -> bool {
    static EMAIL: std::sync::LazyLock<regex::Regex> = std::sync::LazyLock::new(|| {
        regex::Regex::new(r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$").unwrap()
    });
    EMAIL.is_match(value)
}
