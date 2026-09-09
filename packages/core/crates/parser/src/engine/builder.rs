use super::{BuildError, Contribution, Grammar, Plugin, rule::Rule};

#[derive(Clone, Default)]
pub struct GrammarBuilder {
    pub(crate) plugins: Vec<Plugin>,
    pub(crate) rules: Vec<(Plugin, Contribution)>,
}

impl GrammarBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(&mut self, plugin: &Plugin) -> Result<&mut Self, BuildError> {
        if self.plugins.iter().any(|p| p.same(plugin)) {
            return Err(BuildError::Duplicate {
                element: plugin.description(),
            });
        }

        let mut pending = self.rules.iter().map(|(_, r)| r).collect::<Vec<_>>();

        for rule in plugin.definition.rules.iter() {
            if pending.iter().any(|r| r.same(rule)) {
                return Err(BuildError::Duplicate {
                    element: rule.description(),
                });
            }
            pending.push(rule);
        }

        self.plugins.push(plugin.clone());

        self.rules.extend(
            plugin
                .definition
                .rules
                .iter()
                .cloned()
                .map(|rule| (plugin.clone(), rule)),
        );

        Ok(self)
    }

    pub fn remove(&mut self, plugin: &Plugin) -> Result<&mut Self, BuildError> {
        if !self.plugins.iter().any(|p| p.same(plugin)) {
            return Err(BuildError::Missing {
                element: plugin.description(),
            });
        }

        self.plugins.retain(|p| !p.same(plugin));
        self.rules.retain(|(owner, _)| !owner.same(plugin));

        Ok(self)
    }

    /// Order two rules in the same phase. Other phases are a compile-time error.
    /// ```compile_fail
    /// use markdown_parser::{GrammarBuilder, engine::{inline::InlineRule, block::BlockRule}};
    /// let mut builder = GrammarBuilder::new();
    /// let inline = InlineRule::new(b"x", |_, _| Ok(None));
    /// let block = BlockRule::new(|_, _| Ok(None));
    /// builder.before(&inline, &block);
    /// ```
    pub fn before<T: Clone>(
        &mut self,
        rule: &Rule<T>,
        anchor: &Rule<T>,
    ) -> Result<&mut Self, BuildError>
    where
        for<'a> Contribution: From<&'a Rule<T>>,
    {
        let (rule, anchor) = (Contribution::from(rule), Contribution::from(anchor));

        let from = self
            .rules
            .iter()
            .position(|(_, r)| r.same(&rule))
            .ok_or_else(|| BuildError::Missing {
                element: rule.description(),
            })?;

        let to = self
            .rules
            .iter()
            .position(|(_, r)| r.same(&anchor))
            .ok_or_else(|| BuildError::Missing {
                element: anchor.description(),
            })?;

        if from != to {
            let entry = self.rules.remove(from);
            self.rules
                .insert(if from < to { to - 1 } else { to }, entry);
        }

        Ok(self)
    }
    pub(crate) fn describe(&self) -> String {
        let mut lines = vec![];

        for plugin in &self.plugins {
            lines.push(format!("plugin: {}", plugin.description()));
            for _ in &plugin.definition.text {
                lines.push(format!("text provider: {}", plugin.description()));
            }
        }

        for phase in ["block", "inline", "text"] {
            for (plugin, rule) in &self.rules {
                if rule.phase() == phase {
                    lines.push(format!(
                        "{phase}: {}/{}",
                        plugin.description(),
                        rule.description()
                    ));
                }
            }
        }

        lines.join("\n")
    }

    pub(crate) fn validate(&self) -> Result<super::plugin::TextFactory, BuildError> {
        super::names::validate(&self.plugins)?;

        let mut providers = self.plugins.iter().flat_map(|p| &p.definition.text);

        let make_text = providers
            .next()
            .ok_or_else(|| BuildError::Missing {
                element: "text provider".into(),
            })?
            .clone();

        if providers.next().is_some() {
            return Err(BuildError::Duplicate {
                element: "text provider".into(),
            });
        }

        Ok(make_text)
    }

    pub fn build(self) -> Result<Grammar, BuildError> {
        let make_text = self.validate()?;

        let mut grammar = super::registry::Compilation {
            definition: self,
            inline: vec![],
            block: vec![],
            text: vec![],
            make_text,
            dispatch: std::array::from_fn(|_| vec![]),
        };

        compile_rules(&mut grammar);
        compile_dispatch(&mut grammar);

        Ok(Grammar {
            data: std::sync::Arc::new(grammar),
        })
    }
}

fn compile_rules(grammar: &mut super::registry::Compilation) {
    for (_, rule) in &grammar.definition.rules {
        match rule {
            Contribution::Inline(rule) => grammar.inline.push(rule.clone()),
            Contribution::Block(rule) => grammar.block.push(rule.clone()),
            Contribution::Text(rule) => grammar.text.push(rule.clone()),
        }
    }
}

fn compile_dispatch(grammar: &mut super::registry::Compilation) {
    for (index, rule) in grammar.inline.iter().enumerate() {
        let markers = rule.data.implementation.markers;
        for (byte, candidates) in grammar.dispatch.iter_mut().enumerate() {
            if markers.is_empty() || markers.contains(&(byte as u8)) {
                candidates.push(index);
            }
        }
    }
}
