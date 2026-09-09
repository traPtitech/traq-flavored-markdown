//! Implementation of markdown_definitions::NodeType; use that crate's re-export.
#![forbid(unsafe_code)]
use proc_macro::TokenStream;
use proc_macro_crate::{FoundCrate, crate_name};
use quote::quote;
use syn::{DeriveInput, GenericParam, ext::IdentExt, parse_macro_input, parse_quote};

#[proc_macro_derive(NodeType)]
pub fn node_type(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);

    expand(input)
        .unwrap_or_else(syn::Error::into_compile_error)
        .into()
}

fn expand(input: DeriveInput) -> syn::Result<proc_macro2::TokenStream> {
    let path = match crate_name("markdown-definitions") {
        Ok(FoundCrate::Itself) => quote!(::markdown_definitions),
        Ok(FoundCrate::Name(name)) => {
            let name = syn::Ident::new(&name, proc_macro2::Span::call_site());
            quote!(::#name)
        }
        Err(error) => return Err(syn::Error::new_spanned(&input.ident, error)),
    };

    let name = &input.ident;
    let label = name.unraw().to_string();

    let arguments: Vec<_> = input
        .generics
        .params
        .iter()
        .filter_map(|parameter| generic_argument(parameter, &path))
        .collect();

    let body = if arguments.is_empty() {
        quote!(::std::string::String::from(
            ::core::concat!(::core::module_path!(), "::", #label)
        ))
    } else {
        // Length framing keeps const characters and nested arguments unambiguous.
        quote! {
            let arguments = [#(#arguments),*];
            let mut key = ::std::string::String::from(::core::concat!(::core::module_path!(), "::", #label, "<"));

            for (index, argument) in arguments.iter().enumerate() {
                if index != 0 { key.push(','); }
                key.push_str(&::std::format!("{}:{}", argument.len(), argument));
            }

            key.push('>');
            key
        }
    };

    let mut generics = input.generics.clone();
    for parameter in generics.type_params_mut() {
        parameter.bounds.push(parse_quote!(#path::NodeType));
    }

    let (implementation, arguments_type, clause) = generics.split_for_impl();
    Ok(quote! {
        impl #implementation #path::NodeType for #name #arguments_type #clause {
            fn type_key() -> ::std::string::String { #body }
        }
    })
}

fn generic_argument(
    parameter: &GenericParam,
    path: &proc_macro2::TokenStream,
) -> Option<proc_macro2::TokenStream> {
    match parameter {
        GenericParam::Type(parameter) => {
            let ty = &parameter.ident;
            Some(quote!(<#ty as #path::NodeType>::type_key()))
        }

        GenericParam::Const(parameter) => {
            let value = &parameter.ident;
            Some(quote!(::std::string::ToString::to_string(&#value)
                .chars().flat_map(::core::primitive::char::escape_default).collect::<::std::string::String>()))
        }

        GenericParam::Lifetime(_) => None,
    }
}
