//! The same collectors and scoped traversal power standalone and aggregate APIs.
use crate::Result;
use markdown_ast::{Node, ValidatedDocument};

pub(crate) trait Collector<'a> {
    type Scope: Clone;
    fn initial(&self) -> Self::Scope;
    fn observe(
        &mut self,
        node: &'a Node,
        source: &'a str,
        scope: &Self::Scope,
    ) -> Result<Self::Scope>;
}

impl<'a, A: Collector<'a>, B: Collector<'a>> Collector<'a> for (A, B) {
    type Scope = (A::Scope, B::Scope);
    fn initial(&self) -> Self::Scope {
        (self.0.initial(), self.1.initial())
    }
    fn observe(
        &mut self,
        node: &'a Node,
        source: &'a str,
        scope: &Self::Scope,
    ) -> Result<Self::Scope> {
        Ok((
            self.0.observe(node, source, &scope.0)?,
            self.1.observe(node, source, &scope.1)?,
        ))
    }
}

pub(crate) fn collect<'a>(
    document: ValidatedDocument<'a>,
    collector: &mut impl Collector<'a>,
) -> Result<()> {
    document.try_visit(collector.initial(), |visit, scope| {
        collector.observe(visit.node, &document.document().source, scope)
    })
}
