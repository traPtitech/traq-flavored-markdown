module traq-markdown-example

go 1.26.0

require github.com/uni-kakurenbo/traq-markdown-engine/packages/traq/go v0.1.0

require (
	github.com/tetratelabs/wazero v1.12.0 // indirect
	github.com/uni-kakurenbo/traq-markdown-engine/packages/commonmark/go v0.0.0-20260909023357-6ddda2244a2b // indirect
	github.com/uni-kakurenbo/traq-markdown-engine/packages/core/go v0.0.0-20260909075748-a297da3b092a // indirect
	github.com/uni-kakurenbo/traq-markdown-engine/packages/trap-extension/go v0.0.0-20260909025436-c7ed47d47397 // indirect
	golang.org/x/sys v0.44.0 // indirect
)

replace github.com/uni-kakurenbo/traq-markdown-engine/packages/traq/go => ../../go
