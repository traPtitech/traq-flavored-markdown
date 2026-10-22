use super::{
    destination::{ParsedDestination, destination},
    url,
};
use crate::references;
use markdown_commonmark_contracts::LinkForm;

use markdown_parser::{
    Node, NodeKind, ParseError,
    engine::{
        Budget,
        inline::{InlineAction, InlineInput, InlineMatch},
    },
};

pub fn link(
    input: &InlineInput<'_>,
    budget: &mut Budget,
) -> Result<Option<InlineMatch>, ParseError> {
    let source = &input.source.text();
    let pos = input.position;
    let image = input.tail().starts_with("![");

    if source.as_bytes()[pos.get()] == b'[' || image {
        return Ok(Some(InlineMatch {
            end: pos + if image { 2 } else { 1 },
            action: InlineAction::OpenBracket {
                tag: if image { "image" } else { "link" },
                inhibit_on_inner: !image,
            },
        }));
    }

    if source.as_bytes()[pos.get()] != b']' {
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

    let direct = destination(source, (pos + 1).get(), budget)?;
    let image = bracket.tag == "image";

    let ParsedDestination { end, target, title } = if let Some(direct) = direct {
        direct
    } else {
        let Some(reference) = reference_target(input, source, pos.get(), bracket.label_start.get())
        else {
            return Ok(discard());
        };
        reference
    };

    let kind = if image {
        NodeKind::new(markdown_commonmark_contracts::Image {
            destination: target,
            title,
            label_source: source[bracket.label_start.get()..pos.get()].into(),
        })
    } else {
        NodeKind::new(markdown_commonmark_contracts::Link {
            destination: target,
            title,
            form: LinkForm::Explicit,
        })
    };

    Ok(Some(InlineMatch {
        end: input.source.offset(end)?,
        action: InlineAction::CloseBracket {
            kind,
            inhibit_brackets: !image,
        },
    }))
}

fn reference_target(
    input: &InlineInput<'_>,
    source: &str,
    pos: usize,
    label_start: usize,
) -> Option<ParsedDestination> {
    let mut label = &source[label_start..pos];
    let mut end = pos + 1;

    if let Some(close) = references::label_end(&source[end..]) {
        let explicit = &source[end + 1..end + close];

        if !explicit.is_empty() {
            label = explicit;
        }

        end += close + 1;
    }

    let (target, title) = input
        .state::<references::ReferenceMap>()?
        .0
        .get(&references::key(label))?;
    Some(ParsedDestination {
        end,
        target: target.clone(),
        title: title.clone(),
    })
}

pub fn autolink(
    input: &InlineInput<'_>,
    budget: &mut Budget,
) -> Result<Option<InlineMatch>, ParseError> {
    let source = &input.source.text();
    let pos = input.position;

    let mut end = pos + 1;

    while end.get() < source.len() && source.as_bytes()[end.get()] != b'>' {
        budget.spend(1)?;

        if source.as_bytes()[end.get()] <= 32 || source.as_bytes()[end.get()] == b'<' {
            return Ok(None);
        }

        end += 1;
    }

    if end.get() == source.len() {
        return Ok(None);
    }

    let value = &source[(pos + 1).get()..end.get()];
    let email = email(value);

    if !email && !valid_scheme(value) {
        return Ok(None);
    }

    let destination = url::encode(&if email {
        format!("mailto:{value}")
    } else {
        value.into()
    });

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
            inhibit_brackets: true,
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
