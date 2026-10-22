use crate::StructureContract;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Serialize)]
pub struct NodeContract {
    pub group: String,
    pub schema: Value,
    pub structure: StructureContract,
}

#[derive(Debug, Serialize)]
pub struct NodeManifest {
    pub nodes: BTreeMap<String, NodeContract>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Provenance {
    pub source_fingerprint: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DocumentLimits {
    pub source_bytes: usize,
    pub payload_bytes: usize,
    pub nodes: usize,
    pub depth: usize,
}

impl From<markdown_ast::ValidationLimits> for DocumentLimits {
    fn from(limits: markdown_ast::ValidationLimits) -> Self {
        Self {
            source_bytes: limits.source_bytes,
            payload_bytes: limits.payload_bytes,
            nodes: limits.nodes,
            depth: limits.depth,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct CoreContract {
    pub limits: DocumentLimits,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ArtifactLimits {
    pub input_bytes: usize,
    pub output_bytes: usize,
    pub memory_bytes: usize,
    pub document: DocumentLimits,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Operation {
    pub export: String,
    pub input: Input,
    pub params: Vec<WasmType>,
    pub result: Output,
    pub configuration: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_schema: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_schema: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Input {
    Text,
    Json,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Output {
    Configuration,
    Document,
    Extraction,
    Text,
    Processing,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WasmType {
    I32,
}

impl Operation {
    pub fn new(export: &str, input: Input, params: Vec<WasmType>, result: Output) -> Self {
        Self {
            export: export.into(),
            input,
            params,
            result,
            configuration: matches!(result, Output::Configuration),
            request_schema: None,
            response_schema: None,
        }
    }

    pub fn request_schema(mut self, name: &str) -> Self {
        self.request_schema = Some(name.into());
        self
    }

    pub fn response_schema(mut self, name: &str) -> Self {
        self.response_schema = Some(name.into());
        self
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Signature {
    pub params: Vec<WasmType>,
    pub results: Vec<WasmType>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AbiContract {
    pub version: u32,
    pub operations: BTreeMap<String, Operation>,
    pub exports: BTreeMap<String, Signature>,
    pub error: Value,
}

impl AbiContract {
    /// Buffer operations return the output byte count; their signatures follow the operation.
    pub fn buffered<const N: usize>(
        version: u32,
        error: Value,
        operations: [(&str, Operation); N],
    ) -> crate::Result<Self> {
        let mut contract = Self {
            version,
            error,
            operations: BTreeMap::new(),
            exports: BTreeMap::from([
                (
                    "input_ptr".into(),
                    Signature {
                        params: vec![WasmType::I32],
                        results: vec![WasmType::I32],
                    },
                ),
                (
                    "output_ptr".into(),
                    Signature {
                        params: vec![],
                        results: vec![WasmType::I32],
                    },
                ),
                (
                    "contract_ptr".into(),
                    Signature {
                        params: vec![],
                        results: vec![WasmType::I32],
                    },
                ),
                (
                    "contract_len".into(),
                    Signature {
                        params: vec![],
                        results: vec![WasmType::I32],
                    },
                ),
            ]),
        };
        for (name, operation) in operations {
            let signature = Signature {
                params: operation.params.clone(),
                results: vec![WasmType::I32],
            };
            if contract
                .exports
                .insert(operation.export.clone(), signature)
                .is_some()
                || contract.operations.insert(name.into(), operation).is_some()
            {
                return Err(format!("duplicate ABI operation: {name}").into());
            }
        }
        Ok(contract)
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Direction {
    Request,
    Response,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactContract {
    pub contract_id: String,
    pub provenance: Provenance,
    pub abi: AbiContract,
    pub directions: BTreeMap<String, Direction>,
    pub processing: BTreeMap<String, Value>,
    pub presets: Value,
    pub limits: ArtifactLimits,
    pub nodes: BTreeMap<String, NodeContract>,
}
