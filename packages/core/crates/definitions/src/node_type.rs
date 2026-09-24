/// Wire identity used by codecs and generated host contracts.
///
/// Plugin catalogs assign explicit stable keys to public payloads. Standalone
/// extensions must declare `#[node_type(key = "vendor.node")]` on their derive.
pub trait NodeType {
    /// Used by codec and binding registration, never for native type identity.
    #[doc(hidden)]
    fn type_key() -> String;
}

/// Implement stable wire kinds from a plugin-owned node catalog.
#[macro_export]
macro_rules! implement_wire_kinds {
    ($group:literal; $($payload:ty => $kind:literal),+ $(,)?) => {
        $(impl $crate::NodeType for $payload {
            fn type_key() -> String { $kind.into() }
        })+
    };
}

macro_rules! primitives {
    ($($ty:ty => $key:literal),* $(,)?) => { $(
        impl NodeType for $ty {
            fn type_key() -> String { $key.into() }
        }
    )* };
}

primitives! {
    () => "()", bool => "bool", char => "char", str => "str",
    u8 => "u8", u16 => "u16", u32 => "u32", u64 => "u64", u128 => "u128", usize => "usize",
    i8 => "i8", i16 => "i16", i32 => "i32", i64 => "i64", i128 => "i128", isize => "isize",
    f32 => "f32", f64 => "f64", String => "std::string::String",
}

macro_rules! containers {
    ($($ty:ident => $key:literal),* $(,)?) => { $(
        impl<T: NodeType> NodeType for $ty<T> {
            fn type_key() -> String { format!(concat!($key, "<{}>"), T::type_key()) }
        }
    )* };
}

containers! { Vec => "std::vec::Vec", Option => "core::option::Option", Box => "std::boxed::Box" }

impl<T: NodeType, const N: usize> NodeType for [T; N] {
    fn type_key() -> String {
        format!("[{};{}]", T::type_key(), N)
    }
}
