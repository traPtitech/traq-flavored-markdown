/// Wire identity used by codecs and generated host contracts.
///
/// PluginDeclaration catalogs assign explicit stable keys to public payloads. Standalone
/// extensions must declare `#[wire_type(key = "vendor.node")]` on their derive.
pub trait WireTypeKey {
    /// Used by codec and binding registration, never for native type identity.
    #[doc(hidden)]
    fn wire_key() -> String;
}

/// Implement stable wire kinds from a plugin-owned node catalog.
#[macro_export]
macro_rules! implement_wire_kinds {
    ($group:literal; $($payload:ty => $kind:literal),+ $(,)?) => {
        $(impl $crate::WireTypeKey for $payload {
            fn wire_key() -> String { $kind.into() }
        })+
    };
}

macro_rules! primitives {
    ($($ty:ty => $key:literal),* $(,)?) => { $(
        impl WireTypeKey for $ty {
            fn wire_key() -> String { $key.into() }
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
        impl<T: WireTypeKey> WireTypeKey for $ty<T> {
            fn wire_key() -> String { format!(concat!($key, "<{}>"), T::wire_key()) }
        }
    )* };
}

containers! { Vec => "std::vec::Vec", Option => "core::option::Option", Box => "std::boxed::Box" }

impl<T: WireTypeKey, const N: usize> WireTypeKey for [T; N] {
    fn wire_key() -> String {
        format!("[{};{}]", T::wire_key(), N)
    }
}
