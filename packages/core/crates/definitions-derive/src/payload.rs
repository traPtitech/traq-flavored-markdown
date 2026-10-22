use proc_macro2::TokenStream;
use quote::{format_ident, quote};
use syn::{
    Data, DeriveInput, Expr, Fields, Ident, LitStr, Meta, Path, Token, parse_quote,
    punctuated::Punctuated,
};

fn ast_path() -> syn::Result<TokenStream> {
    use proc_macro_crate::{FoundCrate, crate_name};
    match crate_name("markdown-ast") {
        Ok(FoundCrate::Itself) => Ok(quote!(::markdown_ast)),
        Ok(FoundCrate::Name(name)) => {
            let name = Ident::new(&name, proc_macro2::Span::call_site());
            Ok(quote!(::#name))
        }
        Err(error) => Err(syn::Error::new(proc_macro2::Span::call_site(), error)),
    }
}

#[derive(Default)]
pub struct NodeOptions {
    role: Option<Path>,
    children: Option<Path>,
    child_type: Option<Path>,
    structure: Option<Path>,
    nonempty: bool,
}
impl syn::parse::Parse for NodeOptions {
    fn parse(input: syn::parse::ParseStream<'_>) -> syn::Result<Self> {
        let mut options = Self::default();
        for argument in Punctuated::<Meta, Token![,]>::parse_terminated(input)? {
            match argument {
                Meta::Path(path) if path.is_ident("nonempty") => options.nonempty = true,
                Meta::NameValue(value) => {
                    let Expr::Path(path) = value.value else {
                        return Err(syn::Error::new_spanned(
                            value,
                            "expected a role, child type, or structure function path",
                        ));
                    };
                    let target = if value.path.is_ident("role") {
                        &mut options.role
                    } else if value.path.is_ident("children") {
                        &mut options.children
                    } else if value.path.is_ident("child_type") {
                        &mut options.child_type
                    } else if value.path.is_ident("structure") {
                        &mut options.structure
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
        if options.structure.is_some() {
            if options.role.is_some()
                || options.children.is_some()
                || options.child_type.is_some()
                || options.nonempty
            {
                return Err(input.error("a custom structure function owns all structural options"));
            }
        } else if options.role.is_none() {
            return Err(input.error("node requires role or structure"));
        }
        if options.children.is_some() && options.child_type.is_some() {
            return Err(input.error("choose children roles or a child_type"));
        }
        if options.nonempty && options.child_type.is_none() {
            return Err(input.error("nonempty requires child_type"));
        }
        Ok(options)
    }
}

pub fn expand(mut item: DeriveInput, options: Option<NodeOptions>) -> syn::Result<TokenStream> {
    let ast = ast_path()?;
    let name = &item.ident;
    let (heap, validation) = match &mut item.data {
        Data::Struct(data) => field_operations(&mut data.fields, &ast, None)?,
        Data::Enum(data) => {
            let mut heaps = vec![];
            let mut validations = vec![];
            for variant in &mut data.variants {
                let name = &variant.ident;
                let (heap, validation) = field_operations(&mut variant.fields, &ast, Some(name))?;
                heaps.push(heap);
                validations.push(validation);
            }
            (
                quote!(match self { #(#heaps),* }),
                quote!(match self { #(#validations),* }),
            )
        }
        Data::Union(_) => return Err(syn::Error::new_spanned(name, "payloads cannot be unions")),
    };
    let mut generics = item.generics.clone();
    for parameter in generics.type_params_mut() {
        parameter.bounds.push(parse_quote!(#ast::PayloadFields));
    }
    let (implementation, arguments, clause) = generics.split_for_impl();
    let fields = quote! {
        impl #implementation #ast::PayloadFields for #name #arguments #clause {
            fn heap_bytes(&self) -> usize { #heap }
            fn validate_fields(&self) -> ::core::result::Result<(), #ast::PayloadError> { #validation }
        }
    };
    let node = if let Some(options) = options {
        let mut node_generics = generics.clone();
        node_generics.make_where_clause().predicates.push(parse_quote!(
            #name #arguments: ::core::any::Any + ::core::clone::Clone + ::core::cmp::PartialEq + ::core::fmt::Debug + ::core::marker::Send + ::core::marker::Sync
        ));
        let (node_implementation, node_arguments, node_clause) = node_generics.split_for_impl();
        let structure = if let Some(path) = options.structure {
            quote!(#path())
        } else {
            let role = options.role.expect("validated role");
            let value = if let Some(child) = options.child_type {
                let nonempty = options.nonempty;
                quote!(#ast::NodeStructure::children::<#child>(#ast::NodeRole::#role, #nonempty))
            } else if let Some(child) = options.children {
                if child.is_ident("Any") {
                    quote!(#ast::NodeStructure { role: #ast::NodeRole::#role, children: #ast::ChildStructure::Any })
                } else {
                    quote!(#ast::NodeStructure::roles(#ast::NodeRole::#role, #ast::NodeRole::#child))
                }
            } else {
                quote!(#ast::NodeStructure::leaf(#ast::NodeRole::#role))
            };
            quote! {
                static STRUCTURE: ::std::sync::LazyLock<#ast::NodeStructure> = ::std::sync::LazyLock::new(|| #value);
                &STRUCTURE
            }
        };
        quote! {
            impl #node_implementation #ast::NodeData for #name #node_arguments #node_clause {
                fn structure() -> &'static #ast::NodeStructure { #structure }
                fn payload_bytes(&self) -> usize { #ast::PayloadFields::heap_bytes(self) }
                fn validate_payload(&self, _: &[#ast::Node]) -> ::core::result::Result<(), #ast::PayloadError> { #ast::PayloadFields::validate_fields(self) }
            }
        }
    } else {
        TokenStream::new()
    };
    Ok(quote!(#item #fields #node))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn conflicting_or_unknown_structural_options_are_rejected() {
        for invalid in [
            "",
            "role = Inline, role = Block",
            "role = Inline, unknown = Block",
            "structure = custom, role = Inline",
            "role = Inline, children = Inline, child_type = Text",
            "role = Inline, nonempty",
        ] {
            assert!(syn::parse_str::<NodeOptions>(invalid).is_err(), "{invalid}");
        }
        for valid in [
            "role = Inline",
            "role = Block, children = Inline",
            "role = Block, child_type = Item, nonempty",
            "structure = custom",
        ] {
            assert!(syn::parse_str::<NodeOptions>(valid).is_ok(), "{valid}");
        }
    }

    #[test]
    fn unsupported_and_duplicate_field_constraints_are_rejected() {
        for input in [
            quote!(
                struct Value {
                    #[constraint(regex(pattern = "x"))]
                    value: String,
                }
            ),
            quote!(
                struct Value {
                    #[constraint(range())]
                    value: u8,
                }
            ),
            quote!(
                struct Value {
                    #[constraint(range(min = 0, min = 1))]
                    value: u8,
                }
            ),
        ] {
            let item: DeriveInput = syn::parse2(input).unwrap();
            let Data::Struct(mut data) = item.data else {
                unreachable!()
            };
            assert!(field_operations(&mut data.fields, &quote!(::markdown_ast), None).is_err());
        }
    }
}

fn field_operations(
    fields: &mut Fields,
    ast: &TokenStream,
    variant: Option<&Ident>,
) -> syn::Result<(TokenStream, TokenStream)> {
    let named = matches!(fields, Fields::Named(_));
    let unit = matches!(fields, Fields::Unit);
    let mut bindings = vec![];
    let mut accesses = vec![];
    let mut checks = vec![];
    for (index, field) in fields.iter_mut().enumerate() {
        let binding = format_ident!("__payload_field_{index}");
        let member = field.ident.as_ref().map_or_else(
            || syn::Member::Unnamed(index.into()),
            |name| syn::Member::Named(name.clone()),
        );
        let access = if variant.is_some() {
            quote!(#binding)
        } else {
            quote!(&self.#member)
        };
        bindings.push(if named {
            quote!(#member: #binding)
        } else {
            quote!(#binding)
        });
        checks.extend(field_constraints(field, &access, ast)?);
        checks.push(quote!(#ast::PayloadFields::validate_fields(#access)?;));
        accesses.push(access);
    }
    let heap = quote!(0usize #(.saturating_add(#ast::PayloadFields::heap_bytes(#accesses)))*);
    let validation = quote!({ #(#checks)* Ok(()) });
    if let Some(variant) = variant {
        let pattern = if unit {
            quote!(Self::#variant)
        } else if named {
            quote!(Self::#variant { #(#bindings),* })
        } else {
            quote!(Self::#variant(#(#bindings),*))
        };
        Ok((quote!(#pattern => #heap), quote!(#pattern => #validation)))
    } else {
        Ok((heap, validation))
    }
}

fn field_constraints(
    field: &mut syn::Field,
    value: &TokenStream,
    ast: &TokenStream,
) -> syn::Result<Vec<TokenStream>> {
    let mut retained = vec![];
    let mut checks = vec![];
    for attribute in std::mem::take(&mut field.attrs) {
        if !attribute.path().is_ident("constraint") {
            retained.push(attribute);
            continue;
        }
        attribute.parse_nested_meta(|meta| {
            let length = meta.path.is_ident("length");
            if !length && !meta.path.is_ident("range") { return Err(meta.error("supported constraints are range and length")); }
            let mut min: Option<Expr> = None;
            let mut max: Option<Expr> = None;
            meta.parse_nested_meta(|bound| {
                let target = if bound.path.is_ident("min") { &mut min } else if bound.path.is_ident("max") { &mut max }
                    else { return Err(bound.error("expected min or max")); };
                if target.replace(bound.value()?.parse()?).is_some() { return Err(bound.error("duplicate constraint bound")); }
                Ok(())
            })?;
            if min.is_none() && max.is_none() { return Err(meta.error("constraint requires min or max")); }
            let kind = &meta.path;
            let schema_bounds = min.iter().map(|min| quote!(min = #min)).chain(max.iter().map(|max| quote!(max = #max))).collect::<Vec<_>>();
            retained.push(parse_quote!(#[cfg_attr(feature = "contracts", schemars(#kind(#(#schema_bounds),*)))]));
            let checked = if length { quote!((#value).len()) } else { quote!(*(#value)) };
            let valid = match (&min, &max) {
                (Some(min), Some(max)) => quote!((#min..=#max).contains(&#checked)),
                (Some(min), None) => quote!(#checked >= #min),
                (None, Some(max)) => quote!(#checked <= #max),
                (None, None) => unreachable!(),
            };
            let field_name = field.ident.as_ref().map_or_else(|| "field".into(), ToString::to_string);
            let description = LitStr::new(&format!("{field_name} {} {}", if length { "length" } else { "value" }, quote!(#(#schema_bounds),*)), proc_macro2::Span::call_site());
            checks.push(quote! { if !(#valid) { return Err(#ast::PayloadError::new(#description).actual(::std::format!("{:?}", #checked))); } });
            Ok(())
        })?;
    }
    field.attrs = retained;
    Ok(checks)
}
