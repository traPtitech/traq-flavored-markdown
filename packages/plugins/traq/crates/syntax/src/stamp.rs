use markdown_parser::{
    ParseError,
    engine::{
        Plugin,
        inline::{InlineMatch, InlineRule},
    },
};
pub use markdown_trap_contracts::StampData;
use markdown_trap_contracts::{StampAnimation, StampEffects, StampKind, StampSize};
use regex::Regex;
use std::sync::LazyLock;

pub fn inline_rule() -> &'static InlineRule {
    static RULE: std::sync::LazyLock<InlineRule> =
        std::sync::LazyLock::new(|| InlineRule::new(b":", parse).named("stamp"));
    &RULE
}

fn parse(
    input: &markdown_parser::engine::inline::InlineInput<'_>,
    budget: &mut markdown_parser::engine::Budget,
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
        markdown_parser::NodeKind::new(data),
    )))
}

fn parse_stamp(literal: &str) -> Option<StampData> {
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
                name: name.into(),
                hue: captures["hue"].into(),
                saturation: captures["saturation"].into(),
                lightness: captures["lightness"].into(),
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
                name: name.into(),
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

    Some(StampData {
        literal: literal.into(),
        kind,
        effects: parse_effects(suffix)?,
    })
}

fn parse_effects(suffix: &str) -> Option<StampEffects> {
    let mut effects = StampEffects::default();
    if suffix.is_empty() {
        return Some(effects);
    }

    for effect in suffix.strip_prefix('.')?.split('.') {
        use StampAnimation as Animation;
        match effect {
            "ex-large" => effects.size = StampSize::ExLarge,
            "large" => effects.size = StampSize::Large,
            "small" => effects.size = StampSize::Small,
            "rotate" => effects.animations.push(Animation::Rotate),
            "rotate-inv" => effects.animations.push(Animation::RotateInv),
            "wiggle" => effects.animations.push(Animation::Wiggle),
            "parrot" => effects.animations.push(Animation::Parrot),
            "zoom" => effects.animations.push(Animation::Zoom),
            "inversion" => effects.animations.push(Animation::Inversion),
            "turn" => effects.animations.push(Animation::Turn),
            "turn-v" => effects.animations.push(Animation::TurnV),
            "happa" => effects.animations.push(Animation::Happa),
            "pyon" => effects.animations.push(Animation::Pyon),
            "flashy" => effects.animations.push(Animation::Flashy),
            "pull" => effects.animations.push(Animation::Pull),
            "atsumori" => effects.animations.push(Animation::Atsumori),
            "stretch" => effects.animations.push(Animation::Stretch),
            "stretch-v" => effects.animations.push(Animation::StretchV),
            "conga" | "marquee" => effects.animations.push(Animation::Conga),
            "conga-inv" | "marquee-inv" => effects.animations.push(Animation::CongaInv),
            "rainbow" => effects.animations.push(Animation::Rainbow),
            "ascension" => effects.animations.push(Animation::Ascension),
            "shake" => effects.animations.push(Animation::Shake),
            "party" => effects.animations.push(Animation::Party),
            "attract" => effects.animations.push(Animation::Attract),
            _ => return None,
        }
        if effects.animations.len() > 5 {
            return None;
        }
    }
    Some(effects)
}

pub fn plugin() -> &'static Plugin {
    static PLUGIN: std::sync::LazyLock<Plugin> = std::sync::LazyLock::new(|| {
        let mut plugin = Plugin::new(&markdown_trap_contracts::preset().stamp);
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
            StampKind::HexColor {
                name: "0x123456".into(),
                rgb: 0x123456
            }
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
                name: "hsl(0, 20.5%, 30%)".into(),
                hue: "0".into(),
                saturation: "20.5".into(),
                lightness: "30".into()
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
}
