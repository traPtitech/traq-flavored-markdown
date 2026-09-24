use super::labels;
use crate::links::Links;
use markdown_commonmark_contracts::{Link, LinkForm};
use markdown_commonmark_text::{ExplicitLinkStyle, Options as CommonmarkOptions};
use markdown_generic_text::math::{Options as MathOptions, Style as MathStyle};
use markdown_renderer::{Preset, PresetBuilder, Result};
use markdown_trap_contracts::EmbeddingData;

/// Build editable plain-text rules. An empty origin leaves URLs as text.
/// Block separators are retained; single-line formatting belongs to the caller.
pub fn builder(origin: &str) -> Result<PresetBuilder> {
    crate::links::validate_origin(origin)?;

    let explicit_links = ExplicitLinkStyle::LabelAndDestination;
    let mut commonmark =
        markdown_commonmark_text::plugin_with_options(CommonmarkOptions { explicit_links });
    let links = Links::new(origin);
    commonmark.replace::<Link>(move |link, nodes, ctx| {
        if link.form != LinkForm::Explicit
            && let Some(target) = links.classify(&link.destination)
        {
            return Ok(labels::for_target(&target).into());
        }
        explicit_links.render(link, nodes, ctx)
    })?;

    let mut references = markdown_trap_text::references::plugin();
    references.replace::<EmbeddingData>(|embedding, _, _| {
        if markdown_trap_extraction::normalize_reference_id(&embedding.id).is_none() {
            return Ok(embedding.literal.clone());
        }
        Ok(labels::for_embedding(embedding.target).into())
    })?;
    let mut builder = PresetBuilder::new();
    builder.add(&commonmark)?;
    builder.add(&markdown_commonmark_text::html::plugin())?;
    for plugin in [
        markdown_generic_text::math::plugin_with_options(MathOptions {
            style: MathStyle::DelimitedTex,
        }),
        markdown_generic_text::mark::plugin(),
        markdown_generic_text::strikethrough::plugin(),
        markdown_generic_text::table::plugin(),
        references,
        markdown_trap_text::stamp::plugin(),
        markdown_trap_text::spoiler::plugin(),
        markdown_trap_text::compat::plugin(),
    ] {
        builder.add(&plugin)?;
    }
    Ok(builder)
}

pub fn preset(origin: &str) -> Result<Preset> {
    builder(origin)?.build()
}
