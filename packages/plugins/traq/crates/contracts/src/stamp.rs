use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, markdown_definitions::NodeType)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct StampData {
    pub literal: String,
    pub kind: StampKind,
    pub effects: StampEffects,
}

impl markdown_ast::NodeData for StampData {}

/// Syntax and display data are parsed once, before any host renders the stamp.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum StampKind {
    Normal {
        name: String,
    },
    User {
        name: String,
    },
    HexColor {
        name: String,
        rgb: u32,
    },
    HslColor {
        name: String,
        hue: String,
        saturation: String,
        lightness: String,
    },
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct StampEffects {
    pub animations: Vec<StampAnimation>,
    pub size: StampSize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(rename_all = "kebab-case")]
pub enum StampAnimation {
    Rotate,
    RotateInv,
    Wiggle,
    Parrot,
    Zoom,
    Inversion,
    Turn,
    TurnV,
    Happa,
    Pyon,
    Flashy,
    Pull,
    Atsumori,
    Stretch,
    StretchV,
    Conga,
    CongaInv,
    Rainbow,
    Ascension,
    Shake,
    Party,
    Attract,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(rename_all = "kebab-case")]
pub enum StampSize {
    #[default]
    None,
    ExLarge,
    Large,
    Small,
}
