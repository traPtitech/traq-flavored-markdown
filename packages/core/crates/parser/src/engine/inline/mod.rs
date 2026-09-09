mod rules;
pub use rules::{InlineRule, TextRule};
mod apply;
mod brackets;
mod delimiters;
mod scan;
mod text;
mod token;
mod tree;

pub(crate) use scan::parse;
pub use scan::{InlineInput, TextInput, TextMatch};
pub use token::{BracketInfo, InlineAction, InlineMatch, Pairing};
