use proc_macro2::TokenStream;
use quote::quote;
use syn::{Attribute, Expr, LitStr, parse_quote};

enum Bounds {
    Minimum(Expr),
    Maximum(Expr),
    Inclusive { min: Expr, max: Expr },
}

impl Bounds {
    fn parse(meta: &syn::meta::ParseNestedMeta<'_>) -> syn::Result<Self> {
        let mut min = None;
        let mut max = None;

        meta.parse_nested_meta(|bound| {
            let target = if bound.path.is_ident("min") {
                &mut min
            } else if bound.path.is_ident("max") {
                &mut max
            } else {
                return Err(bound.error("expected min or max"));
            };

            if target.replace(bound.value()?.parse()?).is_some() {
                return Err(bound.error("duplicate constraint bound"));
            }

            Ok(())
        })?;

        match (min, max) {
            (Some(min), Some(max)) => Ok(Self::Inclusive { min, max }),
            (Some(min), None) => Ok(Self::Minimum(min)),
            (None, Some(max)) => Ok(Self::Maximum(max)),
            (None, None) => Err(meta.error("constraint requires min or max")),
        }
    }

    fn schema(&self) -> TokenStream {
        match self {
            Self::Minimum(min) => quote!(min = #min),
            Self::Maximum(max) => quote!(max = #max),
            Self::Inclusive { min, max } => quote!(min = #min, max = #max),
        }
    }

    fn predicate(&self, value: &TokenStream) -> TokenStream {
        match self {
            Self::Minimum(min) => quote!(#value >= #min),
            Self::Maximum(max) => quote!(#value <= #max),
            Self::Inclusive { min, max } => quote!((#min..=#max).contains(&#value)),
        }
    }
}

enum Constraint {
    Range(Bounds),
    Length(Bounds),
}

impl Constraint {
    fn parse(meta: syn::meta::ParseNestedMeta<'_>) -> syn::Result<Self> {
        if meta.path.is_ident("range") {
            Ok(Self::Range(Bounds::parse(&meta)?))
        } else if meta.path.is_ident("length") {
            Ok(Self::Length(Bounds::parse(&meta)?))
        } else {
            Err(meta.error("supported constraints are range and length"))
        }
    }

    fn bounds(&self) -> &Bounds {
        match self {
            Self::Range(bounds) | Self::Length(bounds) => bounds,
        }
    }

    fn schema_attribute(&self) -> Attribute {
        let bounds = self.bounds().schema();

        match self {
            Self::Range(_) => {
                parse_quote!(#[cfg_attr(feature = "contracts", schemars(range(#bounds)))])
            }

            Self::Length(_) => {
                parse_quote!(#[cfg_attr(feature = "contracts", schemars(length(#bounds)))])
            }
        }
    }

    fn validation(&self, field: &str, value: &TokenStream, ast: &TokenStream) -> TokenStream {
        let (checked, kind) = match self {
            Self::Range(_) => (quote!(*(#value)), "value"),
            Self::Length(_) => (
                quote!(#ast::PayloadLength::payload_length(#value)),
                "length",
            ),
        };

        let valid = self.bounds().predicate(&checked);
        let description = LitStr::new(
            &format!("{field} {kind} {}", self.bounds().schema()),
            proc_macro2::Span::call_site(),
        );

        quote! {
            if !(#valid) {
                return Err(#ast::PayloadError::new(#description)
                    .actual(::std::format!("{:?}", #checked)));
            }
        }
    }
}

pub(super) fn field_constraints(
    field: &mut syn::Field,
    value: &TokenStream,
    ast: &TokenStream,
) -> syn::Result<Vec<TokenStream>> {
    let mut constraints = vec![];
    let mut retained = vec![];

    for attribute in std::mem::take(&mut field.attrs) {
        if attribute.path().is_ident("constraint") {
            attribute.parse_nested_meta(|meta| {
                constraints.push(Constraint::parse(meta)?);
                Ok(())
            })?;
        } else {
            retained.push(attribute);
        }
    }

    retained.extend(constraints.iter().map(Constraint::schema_attribute));
    field.attrs = retained;

    let field_name = field
        .ident
        .as_ref()
        .map_or_else(|| "field".into(), ToString::to_string);

    Ok(constraints
        .iter()
        .map(|constraint| constraint.validation(&field_name, value, ast))
        .collect())
}
