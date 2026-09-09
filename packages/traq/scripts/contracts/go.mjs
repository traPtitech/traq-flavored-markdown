export function goNodes(manifest) {
 const groups = [...new Set(Object.values(manifest.nodes).map(node => node.group))];
 const packages = {commonmark:'commonmark/go',generic:'commonmark/go/generic',trap:'trap-extension/go'};
 return '// Code generated from Rust contract ownership. DO NOT EDIT.\npackage markdown\nimport (\n "github.com/traq-markdown-parser/core/go/ast"\n'
  + groups.map(group => group+' "github.com/traq-markdown-parser/'+packages[group]+'"').join('\n')+'\n)\n'
  + 'type Document = ast.Document\ntype Node = ast.Node\ntype Span = ast.Span\ntype Payload = ast.Payload\n'
  + 'func DecodeDocument(raw []byte) (*Document,error) { return ast.DecodeDocument(raw, newPayload) }\n'
  + 'func newPayload(kind string) ast.Payload {\n'
  + groups.map(group => 'if value := '+group+'.NewPayload(kind); value != nil { return value }').join('\n')
  + '\nreturn nil\n}\n';
}
