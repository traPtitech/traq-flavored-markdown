use serde::{Deserialize, Serialize};

#[markdown_definitions::node(role = Inline)]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Stamp {
    pub literal: String,
    pub kind: StampKind,
    pub effects: StampEffects,
}

/// Syntax and display data are parsed once, before any host renders the stamp.
#[markdown_definitions::payload]
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
        #[constraint(range(min = 0, max = 16_777_215))]
        rgb: u32,
    },
    HslColor {
        #[constraint(range(min = 0, max = 359))]
        hue: u16,
        #[constraint(range(min = 0.0, max = 100.0))]
        saturation: f64,
        #[constraint(range(min = 0.0, max = 100.0))]
        lightness: f64,
    },
}

#[markdown_definitions::payload]
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct StampEffects {
    #[constraint(length(max = 5))]
    pub animations: Vec<StampAnimation>,
    pub size: StampSize,
}

macro_rules! animations {
    ($($variant:ident => $name:literal),+ $(,)?) => {
        #[markdown_definitions::payload]
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

#[markdown_definitions::payload]
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
