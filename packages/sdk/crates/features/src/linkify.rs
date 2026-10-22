//! Frozen traQ V1 linkification policy, independent of live DNS registries.
use std::sync::LazyLock;

// linkify-it 5 defaults plus the traQ S-UI additions. Preserve this exact
// profile vocabulary when the general recognizer evolves.
const TLD_PATTERN: &str = "(?:biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф|app|dev|games|tech|show|xn--[a-z0-9-]{1,59}|a[cdefgilmnoqrstuwxz]|b[abdefghijmnorstvwyz]|c[acdfghiklmnoruvwxyz]|d[ejkmoz]|e[cegrstu]|f[ijkmor]|g[abdefghilmnpqrstuwy]|h[kmnrtu]|i[delmnoqrst]|j[emop]|k[eghimnprwyz]|l[abcikrstuvy]|m[acdeghklmnopqrstuvwxyz]|n[acefgilopruz]|om|p[aefghklmnrstwy]|qa|r[eosuw]|s[abcdeghijklmnortuvxyz]|t[cdfghjklmnortvwz]|u[agksyz]|v[aceginu]|w[fs]|y[et]|z[amw])";

pub fn syntax() -> &'static markdown_generic_syntax::linkify::Syntax {
    static SYNTAX: LazyLock<markdown_generic_syntax::linkify::Syntax> = LazyLock::new(|| {
        markdown_generic_syntax::linkify::Syntax::new(TLD_PATTERN)
            .expect("valid traQ V1 TLD policy")
    });
    &SYNTAX
}
