use serde::{Deserialize, Serialize};

macro_rules! identifier {
    ($name:ident) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
        #[serde(transparent)]
        pub struct $name(pub usize);
    };
}
identifier!(GroupId);
identifier!(PluginId);
identifier!(RuleId);
identifier!(PresetId);
