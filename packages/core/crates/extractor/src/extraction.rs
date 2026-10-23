use crate::{AnalysisContext, Collector, Error, Preset, Result};
use std::marker::PhantomData;

pub struct Extractor<R> {
    preset: Preset<R>,
}
impl<R> Extractor<R> {
    pub fn new(preset: &Preset<R>) -> Self {
        Self {
            preset: preset.clone(),
        }
    }
    /// Run typed handlers in preorder, reusing checked document inputs.
    pub fn extract<'a>(&self, document: impl markdown_ast::DocumentInput<'a>) -> Result<R>
    where
        R: Default,
    {
        let mut collector = self.collector::<Error>();
        crate::collect(document, &mut collector)?;
        Ok(collector.finish())
    }
    /// Compose these handlers with scoped analyses in a single traversal.
    pub fn collector<E: From<Error>>(&self) -> Extraction<'_, R, E>
    where
        R: Default,
    {
        Extraction {
            extractor: self,
            result: R::default(),
            error: PhantomData,
        }
    }
}

pub struct Extraction<'e, R, E> {
    extractor: &'e Extractor<R>,
    result: R,
    error: PhantomData<fn() -> E>,
}
impl<R, E> Extraction<'_, R, E> {
    pub fn finish(self) -> R {
        self.result
    }
}
impl<'a, R, E: From<Error>> Collector<'a> for Extraction<'_, R, E> {
    type Scope = ();
    type Error = E;
    fn initial(&self) {}
    fn observe(&mut self, context: AnalysisContext<'a>, _: &()) -> std::result::Result<(), E> {
        if let Some(handler) = self
            .extractor
            .preset
            .handlers
            .get(&context.visit.node.data_type_id())
        {
            handler(context, &mut self.result)?;
        }
        Ok(())
    }
}
