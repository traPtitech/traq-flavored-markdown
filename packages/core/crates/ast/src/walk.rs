use crate::{Node, ValidatedDocument};

/// One occurrence in validated document preorder.
#[derive(Debug, Clone, Copy)]
pub struct Visit<'a> {
    pub node: &'a Node,
    pub parent: Option<&'a Node>,
    pub index: usize,
    pub depth: usize,
}

pub struct Walk<'a> {
    stack: Vec<Frame<'a>>,
}
struct Frame<'a> {
    nodes: &'a [Node],
    parent: Option<&'a Node>,
    index: usize,
}

impl<'a> ValidatedDocument<'a> {
    /// Every consumer uses the same source order and parent/index convention.
    pub fn walk(self) -> Walk<'a> {
        Walk {
            stack: vec![Frame {
                nodes: &self.document().children,
                parent: None,
                index: 0,
            }],
        }
    }

    /// Traverse with a value inherited by descendants. Sibling state is isolated,
    /// so independent collectors can compose their scopes as a tuple.
    pub fn try_visit<S: Clone, E>(
        self,
        initial: S,
        mut visitor: impl FnMut(Visit<'a>, &S) -> Result<S, E>,
    ) -> Result<(), E> {
        let mut scopes = vec![initial];
        for visit in self.walk() {
            scopes.truncate(visit.depth);
            let next = visitor(visit, &scopes[visit.depth - 1])?;
            scopes.push(next);
        }
        Ok(())
    }
}

impl<'a> Iterator for Walk<'a> {
    type Item = Visit<'a>;
    fn next(&mut self) -> Option<Self::Item> {
        loop {
            let depth = self.stack.len();
            let frame = self.stack.last_mut()?;
            let Some(node) = frame.nodes.get(frame.index) else {
                self.stack.pop();
                continue;
            };
            let visit = Visit {
                node,
                parent: frame.parent,
                index: frame.index,
                depth,
            };
            frame.index += 1;
            if !node.children.is_empty() {
                self.stack.push(Frame {
                    nodes: &node.children,
                    parent: Some(node),
                    index: 0,
                });
            }
            return Some(visit);
        }
    }
}
