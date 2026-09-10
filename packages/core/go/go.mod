module github.com/uni-kakurenbo/traq-markdown-engine/packages/core/go

go 1.26.0

require github.com/tetratelabs/wazero v1.12.0

require golang.org/x/sys v0.44.0 // indirect

replace github.com/uni-kakurenbo/traq-markdown-engine/packages/commonmark/go => ../../../packages/commonmark/go
replace github.com/uni-kakurenbo/traq-markdown-engine/packages/core/go => ../../../packages/core/go
replace github.com/uni-kakurenbo/traq-markdown-engine/packages/trap-extension/go => ../../../packages/trap-extension/go
replace github.com/uni-kakurenbo/traq-markdown-engine/packages/traq/go => ../../../packages/traq/go
