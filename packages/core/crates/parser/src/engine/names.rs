use super::{BuildError, Plugin};
use std::collections::HashSet;

fn duplicate(scope: String, name: &str) -> BuildError {
    BuildError::DuplicateName {
        scope,
        name: name.into(),
    }
}

/// Only namespaces reached through the selected plugins participate.
pub(super) fn validate(plugins: &[Plugin]) -> Result<(), BuildError> {
    for plugin in plugins {
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

    markdown_definitions::validate_names(plugins.iter().map(|plugin| &plugin.declaration))
        .map_err(|error| duplicate(error.scope, &error.name))
}
