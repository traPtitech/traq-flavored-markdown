use proc_macro2::TokenStream;
use quote::{format_ident, quote};
use syn::{Data, DeriveInput, Fields, Ident, parse_quote};

mod constraints;
mod options;

use constraints::field_constraints;
pub use options::NodeOptions;

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
            fn dynamic_payload_bytes(&self) -> usize { #heap }
            fn validate_fields(&self) -> ::core::result::Result<(), #ast::PayloadError> { #validation }
        }
    };

    let node = if let Some(options) = options {
        let mut node_generics = generics.clone();

        node_generics.make_where_clause().predicates.push(parse_quote!(
            #name #arguments: ::core::any::Any + ::core::clone::Clone + ::core::cmp::PartialEq + ::core::fmt::Debug + ::core::marker::Send + ::core::marker::Sync
        ));

        // Concrete children are checked in the method body. Add a bound for
        // generic children, but never make a recursive node's implementation
        // depend on the very NodeData implementation being generated.
        if let Some(child) = options.child_type()
            && !item.generics.params.is_empty()
            && !child.is_ident("Self")
            && child
                .segments
                .last()
                .is_some_and(|segment| segment.ident != *name)
        {
            node_generics
                .make_where_clause()
                .predicates
                .push(parse_quote!(#child: #ast::NodeData));
        }

        let (node_implementation, node_arguments, node_clause) = node_generics.split_for_impl();

        let structure = options.structure(&ast);

        quote! {
            impl #node_implementation #ast::NodeData for #name #node_arguments #node_clause {
                fn structure() -> &'static #ast::NodeStructure { #structure }
                fn payload_bytes(&self) -> usize { #ast::PayloadFields::dynamic_payload_bytes(self) }
                fn validate_payload(&self, _: &[#ast::Node]) -> ::core::result::Result<(), #ast::PayloadError> { #ast::PayloadFields::validate_fields(self) }
            }
        }
    } else {
        TokenStream::new()
    };

    Ok(quote!(#item #fields #node))
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

    let heap =
        quote!(0usize #(.saturating_add(#ast::PayloadFields::dynamic_payload_bytes(#accesses)))*);

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
