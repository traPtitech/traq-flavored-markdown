use markdown_ast::{DocumentInput, ValidationError, Visit};

/// The location and original source of one node in document preorder.
#[derive(Clone, Copy)]
pub struct AnalysisContext<'a> {
    pub visit: Visit<'a>,
    pub source: &'a str,
}

/// A scoped analysis. Its returned scope is inherited only by descendants;
/// siblings retain their parent's scope. Tuples compose independent analyses.
pub trait Collector<'a> {
    type Scope: Clone;
    type Error;

    fn initial(&self) -> Self::Scope;
    fn observe(
        &mut self,
        context: AnalysisContext<'a>,
        scope: &Self::Scope,
    ) -> Result<Self::Scope, Self::Error>;
}

impl<'a, A, B> Collector<'a> for (A, B)
where
    A: Collector<'a>,
    B: Collector<'a, Error = A::Error>,
{
    type Scope = (A::Scope, B::Scope);
    type Error = A::Error;

    fn initial(&self) -> Self::Scope {
        (self.0.initial(), self.1.initial())
    }
    fn observe(
        &mut self,
        context: AnalysisContext<'a>,
        scope: &Self::Scope,
    ) -> Result<Self::Scope, Self::Error> {
        Ok((
            self.0.observe(context, &scope.0)?,
            self.1.observe(context, &scope.1)?,
        ))
    }
}

pub fn collect<'a, C>(document: impl DocumentInput<'a>, collector: &mut C) -> Result<(), C::Error>
where
    C: Collector<'a>,
    C::Error: From<ValidationError>,
{
    let document = document.into_view()?;
    document.try_visit(collector.initial(), |visit, scope| {
        collector.observe(
            AnalysisContext {
                visit,
                source: &document.document().source,
            },
            scope,
        )
    })
}
