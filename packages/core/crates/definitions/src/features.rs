use crate::{PluginDeclaration, WireTypeKey};
use std::any::TypeId;

/// A plugin-owned native payload identity paired with its persisted key.
#[derive(Debug, Clone)]
pub struct PayloadContract {
    pub native: TypeId,
    pub kind: String,
}
impl PayloadContract {
    pub fn of<T: WireTypeKey + 'static>() -> Self {
        Self {
            native: TypeId::of::<T>(),
            kind: T::wire_key(),
        }
    }
}

/// Contracts describe available payloads independently of syntax and rendering.
#[derive(Debug)]
pub struct FeatureContract {
    pub declaration: &'static PluginDeclaration,
    pub payloads: Vec<PayloadContract>,
}

#[doc(hidden)]
#[macro_export]
macro_rules! nodes_from_features {
    ($consumer:ident; $group:literal; $( $feature:ident => $declaration:expr; [ $($payload:ty => $kind:literal),* $(,)? ] ),+ $(,)?) => {
        $consumer! { $group; $($($payload => $kind,)*)+ }
    };
}

/// Define a plugin's typed feature contracts from its sole payload catalog.
#[macro_export]
macro_rules! define_feature_contracts {
    ($group:literal; $( $feature:ident => $declaration:expr; [ $($payload:ty => $kind:literal),* $(,)? ] ),+ $(,)?) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq)]
        pub enum Feature { $( $feature ),+ }
        impl Feature {
            pub fn contract(self) -> &'static $crate::FeatureContract {
                match self { $( Self::$feature => {
                    static CONTRACT: std::sync::LazyLock<$crate::FeatureContract> = std::sync::LazyLock::new(|| $crate::FeatureContract {
                        declaration: $declaration,
                        payloads: vec![$($crate::PayloadContract::of::<$payload>()),*],
                    });
                    &CONTRACT
                }),+ }
            }
        }
        $($( impl $crate::WireTypeKey for $payload {
            fn wire_key() -> String { $kind.into() }
        } )*)+
    };
}
