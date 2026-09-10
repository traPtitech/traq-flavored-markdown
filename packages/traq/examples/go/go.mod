module traq-markdown-example

go 1.26.0

require github.com/uni-kakurenbo/traq-markdown-engine/packages/traq/go v0.1.0

require (
	github.com/tetratelabs/wazero v1.12.0 // indirect
	github.com/uni-kakurenbo/traq-markdown-engine/packages/commonmark/go v0.0.0-00010101000000-000000000000 // indirect
	github.com/uni-kakurenbo/traq-markdown-engine/packages/core/go v0.0.0-00010101000000-000000000000 // indirect
	github.com/uni-kakurenbo/traq-markdown-engine/packages/trap-extension/go v0.0.0-00010101000000-000000000000 // indirect
	golang.org/x/sys v0.44.0 // indirect
)

replace github.com/uni-kakurenbo/traq-markdown-engine/packages/commonmark/go => ../../../../packages/commonmark/go
replace github.com/uni-kakurenbo/traq-markdown-engine/packages/core/go => ../../../../packages/core/go
replace github.com/uni-kakurenbo/traq-markdown-engine/packages/trap-extension/go => ../../../../packages/trap-extension/go
replace github.com/uni-kakurenbo/traq-markdown-engine/packages/traq/go => ../../../../packages/traq/go
