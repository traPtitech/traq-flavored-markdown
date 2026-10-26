use markdown_parser::ParseError;
use markdown_parser::grammar::SyntaxPlugin;
use markdown_parser::rules::inline::InlineMatch;
use markdown_parser::rules::inline::InlineRule;
pub use markdown_traq_contracts::Stamp;
use markdown_traq_contracts::{StampAnimation, StampEffects, StampKind, StampSize};
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
        } else if let Some(color) = hex_color(name) {
            color
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

fn hex_color(name: &str) -> Option<StampKind> {
    let digits = name.strip_prefix("0x")?;
    if !matches!(digits.len(), 3 | 4 | 6 | 8) || !digits.bytes().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    let value = u32::from_str_radix(digits, 16).ok()?;
    let value = if digits.len() <= 4 {
        (0..digits.len()).rev().fold(0, |expanded, offset| {
            (expanded << 8) | (((value >> (offset * 4)) & 0xf) * 0x11)
        })
    } else {
        value
    };
    Some(if matches!(digits.len(), 3 | 6) {
        StampKind::HexColor { rgb: value }
    } else {
        StampKind::HexRgbaColor { rgba: value }
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
        let mut plugin = SyntaxPlugin::new(&markdown_traq_contracts::declarations().stamp);
        plugin.add(inline_rule());
        plugin
    });
    &PLUGIN
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_colors_expand_short_notation_and_preserve_alpha() {
        for (digits, expected) in [
            ("f00", StampKind::HexColor { rgb: 0xff0000 }),
            ("0aF", StampKind::HexColor { rgb: 0x00aaff }),
            ("123", StampKind::HexColor { rgb: 0x112233 }),
            ("ff0000", StampKind::HexColor { rgb: 0xff0000 }),
            ("f008", StampKind::HexRgbaColor { rgba: 0xff000088 }),
            ("0aF0", StampKind::HexRgbaColor { rgba: 0x00aaff00 }),
            ("0000", StampKind::HexRgbaColor { rgba: 0 }),
            ("ffff", StampKind::HexRgbaColor { rgba: u32::MAX }),
            ("ff000080", StampKind::HexRgbaColor { rgba: 0xff000080 }),
            ("00000001", StampKind::HexRgbaColor { rgba: 1 }),
            ("FFFFFFFF", StampKind::HexRgbaColor { rgba: u32::MAX }),
        ] {
            let literal = format!(":0x{digits}.rotate.small:");
            let stamp = parse_stamp(&literal).unwrap();
            assert_eq!(stamp.kind, expected, "{literal}");
            assert_eq!(stamp.literal, literal);
            assert_eq!(stamp.effects.animations, vec![StampAnimation::Rotate]);
            assert_eq!(stamp.effects.size, StampSize::Small);
        }
        for name in [
            "0x",
            "0xf",
            "0xff",
            "0x12345",
            "0xff7383f",
            "0x123456789",
            "0x12g",
            "0x1234567z",
            "foo0xf00",
        ] {
            let stamp = parse_stamp(&format!(":{name}:")).unwrap();
            assert_eq!(stamp.kind, StampKind::Normal { name: name.into() });
        }
    }

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
