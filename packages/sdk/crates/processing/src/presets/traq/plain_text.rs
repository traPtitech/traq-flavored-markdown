use super::labels;
use crate::Result;
use crate::links::TraqUrlClassifier;
use markdown_commonmark_contracts::{Link, LinkForm};
use markdown_renderer::RenderPreset;
use markdown_renderer::RenderPresetBuilder;
use markdown_trap_contracts::Embedding;
use traq_markdown_features::{TextFeature, TextOptions, TextProfile};

/// Build editable plain-text rules. An empty origin leaves URLs as text.
/// Block separators are retained; single-line formatting belongs to the caller.
pub fn builder(origin: &str) -> Result<RenderPresetBuilder> {
    crate::links::validate_origin(origin)?;

    let options = TextOptions::default();
    let mut builder = RenderPresetBuilder::new();
    for feature in TextProfile::Traq.features() {
        let mut plugin = feature.plugin(options);
        match feature {
            TextFeature::Core => {
                let links = TraqUrlClassifier::new(origin);
                plugin.replace::<Link>(move |link, nodes, ctx, output| {
                    if link.form != LinkForm::Explicit
                        && let Some(target) = links.classify(&link.destination)
                    {
                        return output.push(labels::for_target(&target));
                    }
                    options.explicit_links.render(link, nodes, ctx, output)
                })?;
            }
            TextFeature::References => {
                plugin.replace::<Embedding>(|embedding, _, _, output| {
                    if embedding.id.canonical().is_none() {
                        return output.push(&embedding.literal);
                    }
                    output.push(labels::for_embedding(embedding.target))
                })?;
            }
            _ => {}
        }
        builder.add(&plugin)?;
    }
    Ok(builder)
}

pub fn preset(origin: &str) -> Result<RenderPreset> {
    Ok(builder(origin)?.build()?)
}
