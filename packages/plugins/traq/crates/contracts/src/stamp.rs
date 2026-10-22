use markdown_ast::NodeRole;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Stamp {
    pub literal: String,
    pub kind: StampKind,
    pub effects: StampEffects,
}

impl markdown_ast::NodeData for Stamp {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| markdown_ast::NodeStructure::leaf(NodeRole::Inline));
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        let kind = match &self.kind {
            StampKind::Normal { name } | StampKind::User { name } => name.len(),
            StampKind::HexColor { .. } | StampKind::HslColor { .. } => 0,
        };
        self.literal.len().saturating_add(kind).saturating_add(
            self.effects
                .animations
                .len()
                .saturating_mul(std::mem::size_of::<StampAnimation>()),
        )
    }
    fn validate_payload(
        &self,
        _children: &[markdown_ast::Node],
    ) -> Result<(), markdown_ast::PayloadError> {
        if self.effects.animations.len() > 5 {
            return Err(
                markdown_ast::PayloadError::new("at most 5 stamp animations")
                    .actual(self.effects.animations.len().to_string()),
            );
        }
        match self.kind {
            StampKind::HexColor { rgb } if rgb > 0xffffff => {
                return Err(markdown_ast::PayloadError::new("RGB color 0..=0xffffff")
                    .actual(rgb.to_string()));
            }
            StampKind::HslColor {
                hue,
                saturation,
                lightness,
            } => {
                if hue >= 360 {
                    return Err(
                        markdown_ast::PayloadError::new("hue 0..=359").actual(hue.to_string())
                    );
                }
                for (field, value) in [("saturation", saturation), ("lightness", lightness)] {
                    if !value.is_finite() || !(0.0..=100.0).contains(&value) {
                        return Err(markdown_ast::PayloadError::new("finite percentage 0..=100")
                            .actual(format!("{field}: {value}")));
                    }
                }
            }
            _ => {}
        }
        Ok(())
    }
}

/// Syntax and display data are parsed once, before any host renders the stamp.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum StampKind {
    Normal {
        name: String,
    },
    User {
        name: String,
    },
    HexColor {
        #[cfg_attr(feature = "contracts", schemars(range(min = 0, max = 16_777_215)))]
        rgb: u32,
    },
    HslColor {
        #[cfg_attr(feature = "contracts", schemars(range(min = 0, max = 359)))]
        hue: u16,
        #[cfg_attr(feature = "contracts", schemars(range(min = 0, max = 100)))]
        saturation: f64,
        #[cfg_attr(feature = "contracts", schemars(range(min = 0, max = 100)))]
        lightness: f64,
    },
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct StampEffects {
    #[cfg_attr(feature = "contracts", schemars(length(max = 5)))]
    pub animations: Vec<StampAnimation>,
    pub size: StampSize,
}

macro_rules! animations {
    ($($variant:ident => $name:literal),+ $(,)?) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
        #[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
        pub enum StampAnimation {
            $(#[serde(rename = $name)] $variant),+
        }
        impl StampAnimation {
            /// Canonical contract name; input-only aliases belong to syntax.
            pub fn from_name(name: &str) -> Option<Self> {
                match name { $($name => Some(Self::$variant),)+ _ => None }
            }
            pub fn name(self) -> &'static str {
                match self { $(Self::$variant => $name),+ }
            }
        }
    };
}

animations! {
    Rotate => "rotate", RotateInv => "rotate-inv", Wiggle => "wiggle",
    Parrot => "parrot", Zoom => "zoom", Inversion => "inversion",
    Turn => "turn", TurnV => "turn-v", Happa => "happa", Pyon => "pyon",
    Flashy => "flashy", Pull => "pull", Atsumori => "atsumori",
    Stretch => "stretch", StretchV => "stretch-v", Conga => "conga",
    CongaInv => "conga-inv", Rainbow => "rainbow", Ascension => "ascension",
    Shake => "shake", Party => "party", Attract => "attract",
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "kebab-case")]
pub enum StampSize {
    #[default]
    None,
    ExLarge,
    Large,
    Small,
}
