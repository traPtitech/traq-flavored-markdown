use proc_macro2::TokenStream;
use quote::quote;
use syn::{Expr, Meta, Path, Token, punctuated::Punctuated};

pub enum NodeOptions {
    Custom(Path),
    Declared { role: Path, children: Children },
}

pub enum Children {
    Leaf,
    Any,
    Role(Path),
    Type { path: Path, nonempty: bool },
}

impl NodeOptions {
    pub fn child_type(&self) -> Option<&Path> {
        match self {
            Self::Declared {
                children: Children::Type { path, .. },
                ..
            } => Some(path),
            _ => None,
        }
    }

    pub fn structure(&self, ast: &TokenStream) -> TokenStream {
        let (role, children) = match self {
            Self::Declared { role, children } => (role, children),
            Self::Custom(path) => return quote!(#path()),
        };

        let children = match children {
            Children::Leaf => {
                return quote!(const { &#ast::NodeStructure::leaf(#ast::NodeRole::#role) });
            }
            Children::Any => quote!(#ast::ChildStructure::Any),

            Children::Role(child) => quote!(#ast::ChildStructure::Roles {
                roles: ::std::borrow::Cow::Borrowed(&[#ast::NodeRole::#child]),
                nonempty: false,
            }),

            Children::Type { path, nonempty } => quote!(#ast::ChildStructure::Types {
                types: ::std::borrow::Cow::Borrowed(&[#ast::PayloadType::of::<#path>()]),
                nonempty: #nonempty,
            }),
        };

        quote!(const { &#ast::NodeStructure { role: #ast::NodeRole::#role, children: #children } })
    }
}

impl syn::parse::Parse for NodeOptions {
    fn parse(input: syn::parse::ParseStream<'_>) -> syn::Result<Self> {
        let mut role = None;
        let mut children = None;
        let mut child_type = None;
        let mut structure = None;
        let mut nonempty = false;

        for argument in Punctuated::<Meta, Token![,]>::parse_terminated(input)? {
            match argument {
                Meta::Path(path) if path.is_ident("nonempty") => {
                    if nonempty {
                        return Err(syn::Error::new_spanned(path, "duplicate node option"));
                    }

                    nonempty = true;
                }

                Meta::NameValue(value) => {
                    let Expr::Path(path) = value.value else {
                        return Err(syn::Error::new_spanned(
                            value,
                            "expected a role, child type, or structure function path",
                        ));
                    };

                    let target = if value.path.is_ident("role") {
                        &mut role
                    } else if value.path.is_ident("children") {
                        &mut children
                    } else if value.path.is_ident("child_type") {
                        &mut child_type
                    } else if value.path.is_ident("structure") {
                        &mut structure
                    } else {
                        return Err(syn::Error::new_spanned(value.path, "unknown node option"));
                    };

                    if target.replace(path.path).is_some() {
                        return Err(syn::Error::new_spanned(value.path, "duplicate node option"));
                    }
                }

                other => return Err(syn::Error::new_spanned(other, "unknown node option")),
            }
        }

        if let Some(structure) = structure {
            if role.is_some() || children.is_some() || child_type.is_some() || nonempty {
                return Err(input.error("a custom structure function owns all structural options"));
            }

            return Ok(Self::Custom(structure));
        }

        let role = role.ok_or_else(|| input.error("node requires role or structure"))?;

        if nonempty && child_type.is_none() {
            return Err(input.error("nonempty requires child_type"));
        }

        let children = match (children, child_type) {
            (Some(_), Some(_)) => return Err(input.error("choose children roles or a child_type")),
            (None, Some(path)) => Children::Type { path, nonempty },
            (Some(path), None) if path.is_ident("Any") => Children::Any,
            (Some(path), None) => Children::Role(path),
            (None, None) => Children::Leaf,
        };

        Ok(Self::Declared { role, children })
    }
}
