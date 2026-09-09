use markdown_codec::Codec;
use std::sync::LazyLock;

pub(crate) fn codec() -> &'static Codec {
    static CODEC: LazyLock<Codec> = LazyLock::new(|| {
        let mut codec = Codec::default();

        macro_rules! register {
            ($group:literal, $module:ident, $($ty:ident),* $(,)?) => {
                $(
                    codec
                        .register::<$module::$ty>()
                        .expect("unique node contract");
                )*
            };
        }

        node_types!(register);

        codec
    });
    &CODEC
}
