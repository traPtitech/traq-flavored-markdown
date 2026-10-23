use super::{BuildError, SyntaxPlugin};
use std::collections::HashSet;

fn duplicate(scope: String, name: &str) -> BuildError {
    BuildError::DuplicateName {
        scope,
        name: name.into(),
    }
}

/// Only namespaces reached through the selected plugins participate.
pub(super) fn validate<'a>(
    plugins: impl Iterator<Item = &'a SyntaxPlugin> + Clone,
) -> Result<(), BuildError> {
    for plugin in plugins.clone() {
        let mut names = HashSet::new();

        for rule in plugin.definition.rules.iter() {
            if let Some(name) = rule.name()
                && !names.insert((rule.phase(), name))
            {
                return Err(duplicate(
                    format!("{} / {}", plugin.description(), rule.phase()),
                    name,
                ));
            }
        }
    }

    markdown_definitions::validate_names(plugins.map(|plugin| &plugin.declaration))
        .map_err(|error| duplicate(error.scope, &error.name))
}
