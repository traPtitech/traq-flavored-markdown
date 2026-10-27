use serde::{Deserialize, Deserializer, Serialize, Serializer};

/// A parsed UUID identity. Authored notation remains in ReferenceIdentity.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ReferenceId([u8; 16]);

impl ReferenceId {
    /// Accept the UUID forms supported by the traQ integration.
    pub fn parse(value: &str) -> Option<Self> {
        let value = match value.len() {
            32 | 36 => value,
            34 | 38 => value.strip_prefix('{')?.strip_suffix('}')?,
            41 | 45 => value.strip_prefix("urn:uuid:")?,
            _ => return None,
        };
        if value.len() != 32 && !Self::is_hyphenated(value) {
            return None;
        }
        let mut digits = value.bytes().filter(|byte| *byte != b'-');
        let mut bytes = [0; 16];
        for byte in &mut bytes {
            *byte = hex(digits.next()?)? << 4 | hex(digits.next()?)?;
        }
        digits.next().is_none().then_some(Self(bytes))
    }

    /// URL paths accept the exact hyphenated shape, including uppercase hex.
    pub fn is_hyphenated(value: &str) -> bool {
        value.len() == 36
            && value.bytes().enumerate().all(|(index, byte)| {
                if [8, 13, 18, 23].contains(&index) {
                    byte == b'-'
                } else {
                    byte.is_ascii_hexdigit()
                }
            })
    }
}

fn hex(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

impl std::fmt::Display for ReferenceId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        for (index, byte) in self.0.iter().enumerate() {
            if [4, 6, 8, 10].contains(&index) {
                f.write_str("-")?;
            }
            write!(f, "{byte:02x}")?;
        }
        Ok(())
    }
}

/// Lossless authored ID with its semantic identity parsed once on construction.
/// Invalid UUIDs remain accepted syntax and serialize exactly as authored.
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "contracts", schemars(with = "String"))]
pub struct ReferenceIdentity {
    raw: String,
    canonical: Option<ReferenceId>,
}
impl ReferenceIdentity {
    pub fn new(raw: impl Into<String>) -> Self {
        let raw = raw.into();
        let canonical = ReferenceId::parse(&raw);
        Self { raw, canonical }
    }
    pub fn as_str(&self) -> &str {
        &self.raw
    }
    pub fn is_empty(&self) -> bool {
        self.raw.is_empty()
    }
    pub fn canonical(&self) -> Option<ReferenceId> {
        self.canonical
    }
}
impl From<String> for ReferenceIdentity {
    fn from(raw: String) -> Self {
        Self::new(raw)
    }
}
impl From<&str> for ReferenceIdentity {
    fn from(raw: &str) -> Self {
        Self::new(raw)
    }
}
impl markdown_ast::PayloadFields for ReferenceIdentity {
    fn dynamic_payload_bytes(&self) -> usize {
        self.raw.len()
    }
}
impl Serialize for ReferenceIdentity {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.raw.serialize(serializer)
    }
}
impl<'de> Deserialize<'de> for ReferenceIdentity {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        String::deserialize(deserializer).map(Self::new)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn semantic_identity_is_cached_without_changing_authored_payloads() {
        let canonical = "01234567-89ab-cdef-0123-456789abcdef";
        for raw in [
            canonical.to_owned(),
            canonical.to_ascii_uppercase(),
            canonical.replace('-', ""),
            format!("{{{canonical}}}"),
            format!("urn:uuid:{canonical}"),
        ] {
            let identity = ReferenceIdentity::new(raw.clone());
            assert_eq!(identity.canonical().unwrap().to_string(), canonical);
            let json = serde_json::to_string(&identity).unwrap();
            assert_eq!(json, serde_json::to_string(&raw).unwrap());
            assert_eq!(
                serde_json::from_str::<ReferenceIdentity>(&json).unwrap(),
                identity
            );
            assert_eq!(
                markdown_ast::PayloadFields::dynamic_payload_bytes(&identity),
                raw.len()
            );
        }
        for raw in ["", "not-a-uuid", "01234567-89ab-cdef-0123-456789abcdeX"] {
            let identity = ReferenceIdentity::new(raw);
            assert_eq!(identity.canonical(), None);
            assert_eq!(identity.as_str(), raw);
        }
    }
}
