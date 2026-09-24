use markdown_codec::Codec;
use std::sync::LazyLock;

pub(crate) fn codec() -> &'static Codec {
    static CODEC: LazyLock<Codec> = LazyLock::new(|| {
        let mut codec = Codec::default();

        macro_rules! register {
            ($group:literal; $($ty:ty => $kind:literal),+ $(,)?) => {
                $(
                    codec
                        .register::<$ty>()
                        .expect("unique node contract");
                )*
            };
        }

        selected_node_catalogs!(register);

        codec
    });
    &CODEC
}
