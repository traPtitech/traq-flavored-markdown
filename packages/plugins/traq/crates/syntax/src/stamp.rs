use markdown_parser::ParseError;
use markdown_parser::grammar::SyntaxPlugin;
use markdown_parser::rules::inline::InlineMatch;
use markdown_parser::rules::inline::InlineRule;
pub use markdown_trap_contracts::Stamp;
use markdown_trap_contracts::{StampAnimation, StampEffects, StampKind, StampSize};
use regex::Regex;
use std::sync::LazyLock;

pub fn inline_rule() -> &'static InlineRule {
    static RULE: std::sync::LazyLock<InlineRule> =
        std::sync::LazyLock::new(|| InlineRule::new(b":", parse).named("stamp"));
    &RULE
}

fn parse(
    input: &markdown_parser::rules::inline::InlineInput<'_>,
    budget: &mut markdown_parser::rules::Budget,
) -> Result<Option<InlineMatch>, ParseError> {
    let tail = input.tail();
    let limit = tail[1..].find(':').map_or(tail.len(), |n| n + 2);
    budget.spend(limit)?;
    if !tail[..limit].ends_with(':') {
        return Ok(None);
    }

    let Some(data) = parse_stamp(&tail[..limit]) else {
        return Ok(None);
    };

    Ok(Some(InlineMatch::leaf(
        input.position + limit,
        markdown_parser::AnyPayload::new(data),
    )))
}

fn parse_stamp(literal: &str) -> Option<Stamp> {
    let inner = literal.strip_prefix(':')?.strip_suffix(':')?;

    let (kind, suffix) = if inner.starts_with("hsl(") {
        static HSL: LazyLock<Regex> = LazyLock::new(|| {
            Regex::new(
                r"^hsl\((?<hue>[0-9]+),\s*(?<saturation>[0-9]+(?:\.[0-9]+)?)%,\s*(?<lightness>[0-9]+(?:\.[0-9]+)?)%\)$",
            )
            .expect("valid HSL stamp pattern")
        });
        let end = inner.find(')')? + 1;
        let name = &inner[..end];
        let captures = HSL.captures(name)?;
        (
            StampKind::HslColor {
                hue: captures["hue"].bytes().fold(0u16, |value, digit| {
                    (value * 10 + u16::from(digit - b'0')) % 360
                }),
                saturation: percentage(&captures["saturation"]),
                lightness: percentage(&captures["lightness"]),
            },
            &inner[end..],
        )
    } else {
        let split = inner.find('.').unwrap_or(inner.len());
        let name = &inner[..split];
        let suffix = &inner[split..];
        let kind = if let Some(user) = name.strip_prefix('@') {
            let bare = user.strip_prefix("Webhook#").unwrap_or(user);
            if bare.is_empty()
                || !bare
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'_' | b'-'))
            {
                return None;
            }
            StampKind::User { name: user.into() }
        } else if name.len() == 8
            && name.starts_with("0x")
            && name[2..].bytes().all(|c| c.is_ascii_hexdigit())
        {
            StampKind::HexColor {
                rgb: u32::from_str_radix(&name[2..], 16).ok()?,
            }
        } else if (1..=32).contains(&name.len())
            && name
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'+' | b'_' | b'-'))
        {
            StampKind::Normal { name: name.into() }
        } else {
            return None;
        };
        (kind, suffix)
    };

    Some(Stamp {
        literal: literal.into(),
        kind,
        effects: parse_effects(suffix)?,
    })
}

fn percentage(decimal: &str) -> f64 {
    // CSS percentages clamp to this interval. Overflowing positive decimal
    // notation still has the same clamped meaning; the literal stays untouched.
    decimal.parse::<f64>().unwrap_or(f64::INFINITY).min(100.0)
}

fn parse_effects(suffix: &str) -> Option<StampEffects> {
    let mut effects = StampEffects::default();
    if suffix.is_empty() {
        return Some(effects);
    }

    for effect in suffix.strip_prefix('.')?.split('.') {
        match effect {
            "ex-large" => effects.size = StampSize::ExLarge,
            "large" => effects.size = StampSize::Large,
            "small" => effects.size = StampSize::Small,
            animation => {
                let canonical = match animation {
                    "marquee" => "conga",
                    "marquee-inv" => "conga-inv",
                    name => name,
                };
                effects
                    .animations
                    .push(StampAnimation::from_name(canonical)?);
            }
        }
        if effects.animations.len() > 5 {
            return None;
        }
    }
    Some(effects)
}

pub fn plugin() -> &'static SyntaxPlugin {
    static PLUGIN: std::sync::LazyLock<SyntaxPlugin> = std::sync::LazyLock::new(|| {
        let mut plugin = SyntaxPlugin::new(&markdown_trap_contracts::declarations().stamp);
        plugin.add(inline_rule());
        plugin
    });
    &PLUGIN
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_complete_stamp_kinds_without_color_substrings() {
        assert_eq!(
            parse_stamp(":wave:").unwrap().kind,
            StampKind::Normal {
                name: "wave".into()
            }
        );
        assert_eq!(
            parse_stamp(":@Webhook#alice:").unwrap().kind,
            StampKind::User {
                name: "Webhook#alice".into()
            }
        );
        assert_eq!(
            parse_stamp(":0x123456:").unwrap().kind,
            StampKind::HexColor { rgb: 0x123456 }
        );
        for name in ["foo0x123456", "0x1234567"] {
            assert_eq!(
                parse_stamp(&format!(":{name}:")).unwrap().kind,
                StampKind::Normal { name: name.into() }
            );
        }
        assert_eq!(
            parse_stamp(":hsl(0, 20.5%, 30%):").unwrap().kind,
            StampKind::HslColor {
                hue: 0,
                saturation: 20.5,
                lightness: 30.0
            }
        );
        assert!(parse_stamp(":foohsl(0, 20%, 30%):").is_none());
        assert!(parse_stamp(":hsl(0, 20%, 30%)junk:").is_none());
    }

    #[test]
    fn parses_and_normalizes_effects_before_rendering() {
        let stamp = parse_stamp(":wave.marquee.large.rotate.small:").unwrap();
        assert_eq!(
            stamp.effects,
            StampEffects {
                animations: vec![StampAnimation::Conga, StampAnimation::Rotate],
                size: StampSize::Small
            }
        );
        assert_eq!(
            parse_stamp(":hsl(0, 20%, 30%).rotate-inv:")
                .unwrap()
                .effects
                .animations,
            vec![StampAnimation::RotateInv]
        );
        for invalid in [
            ":wave.unknown:",
            ":wave..rotate:",
            ":wave.rotate.:",
            ":wave.rotate.rotate.rotate.rotate.rotate.rotate:",
        ] {
            assert!(parse_stamp(invalid).is_none(), "{invalid}");
        }
    }

    #[test]
    fn color_values_are_canonical_but_authored_notation_is_retained() {
        let literal = ":hsl(0000720, 200.5%, 030.25%).rotate:";
        let stamp = parse_stamp(literal).unwrap();
        assert_eq!(stamp.literal, literal);
        assert_eq!(
            stamp.kind,
            StampKind::HslColor {
                hue: 0,
                saturation: 100.0,
                lightness: 30.25
            }
        );
        let huge = format!(":hsl({}, {}%, 0%):", "9".repeat(1000), "9".repeat(1000));
        let stamp = parse_stamp(&huge).unwrap();
        assert_eq!(
            stamp.kind,
            StampKind::HslColor {
                hue: 279,
                saturation: 100.0,
                lightness: 0.0
            }
        );
    }
}
