# Algorithm sources

The delimiter pairing in the core repository’s `crates/parser/src/engine/inline/delimiters.rs` and emphasis handling
in the commonmark repository’s `crates/syntax/src/inlines/emphasis.rs` are adapted from
markdown-it 14.3.0 (`lib/rules_inline/balance_pairs.mjs`, `emphasis.mjs`).
The spoiler scanner follows @traptitech/markdown-it-spoiler 1.1.6.
The inline math scanner follows @traptitech/markdown-it-katex 3.6.0.
Block parsing, reference handling, and HTML recognition follow markdown-it 14.3.0.
V1 stamp recognition follows @traptitech/traq-markdown-it.
URL recognition/normalization and the frozen TLD set follow linkify-it 5 and markdown-it 14.3.0.

Copyright (c) 2014 Vitaly Puzrin, Alex Kocharin.
Copyright (c) 2014-2015 Vitaly Puzrin, Alex Kocharin.
Copyright (c) 2016 Waylon Flinn.
Copyright (c) 2018 Takahiro Ethan Ikeuchi @iktakahiro.
Copyright (c) 2020 traP.
Copyright (c) 2020 magiclen.org (Ron Li). Entity names from html-escape 0.2.15.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Entity values

`src/syntax/commonmark/inlines/entities_table.rs` freezes the 2,125 semicolon-terminated names with values decoded
by the frontend's `entities` 7.0.1. This also preserves multi-codepoint entities.

Copyright (c) Felix Böhm
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
