//! Literal CommonMark spec rendering. Raw HTML is passed through only in tests.
use markdown_commonmark_contracts::*;
use markdown_parser::Node;

fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn plain(nodes: &[Node]) -> String {
    nodes
        .iter()
        .map(|node| {
            if let Some(text) = node.payload::<Text>() {
                text.value.clone()
            } else if let Some(code) = node.payload::<InlineCode>() {
                code.literal.clone()
            } else if node.payload::<Softbreak>().is_some() || node.payload::<Hardbreak>().is_some()
            {
                "\n".into()
            } else {
                plain(&node.children)
            }
        })
        .collect()
}

pub fn render(nodes: &[Node]) -> String {
    render_with(nodes, false)
}

fn render_with(nodes: &[Node], tight: bool) -> String {
    nodes.iter().map(|node| render_node(node, tight)).collect()
}

fn title(value: &Option<String>) -> String {
    value
        .as_ref()
        .map(|s| format!(" title=\"{}\"", escape(s)))
        .unwrap_or_default()
}

fn render_node(node: &Node, tight: bool) -> String {
    let nested = || render_with(&node.children, false);

    if let Some(value) = node.payload::<Text>() {
        escape(&value.value)
    } else if node.payload::<Paragraph>().is_some() {
        if tight {
            nested()
        } else {
            format!("<p>{}</p>\n", nested())
        }
    } else if let Some(Heading { level }) = node.payload::<Heading>() {
        format!("<h{level}>{}</h{level}>\n", nested())
    } else if node.payload::<Blockquote>().is_some() {
        format!("<blockquote>\n{}</blockquote>\n", nested())
    } else if let Some(list) = node.payload::<List>() {
        let (tag, start) = match list.kind {
            ListKind::Ordered { start, .. } => (
                "ol",
                if start != 1 {
                    format!(" start=\"{start}\"")
                } else {
                    String::new()
                },
            ),
            ListKind::Bullet { .. } => ("ul", String::new()),
        };

        format!(
            "<{tag}{start}>\n{}</{tag}>\n",
            render_with(&node.children, list.tight)
        )
    } else if node.payload::<ListItem>().is_some() {
        let mut content = render_with(&node.children, tight);

        if node
            .children
            .first()
            .is_some_and(|n| !tight || n.payload::<Paragraph>().is_none())
        {
            content.insert(0, '\n');
        }

        if tight && node.children.len() > 1 && node.children[0].payload::<Paragraph>().is_some() {
            content = format!(
                "{}\n{}",
                render_with(&node.children[..1], true),
                render_with(&node.children[1..], tight)
            );
        }

        format!("<li>{content}</li>\n")
    } else if let Some(code) = node.payload::<CodeBlock>() {
        let class = code
            .info
            .split_whitespace()
            .next()
            .map(|language| format!(" class=\"language-{}\"", escape(language)))
            .unwrap_or_default();

        format!("<pre><code{class}>{}</code></pre>\n", escape(&code.literal))
    } else if node.payload::<ThematicBreak>().is_some() {
        "<hr />\n".into()
    } else if node.payload::<Softbreak>().is_some() {
        "\n".into()
    } else if node.payload::<Hardbreak>().is_some() {
        "<br />\n".into()
    } else if let Some(code) = node.payload::<InlineCode>() {
        format!("<code>{}</code>", escape(&code.literal))
    } else if node.payload::<Emphasis>().is_some() {
        format!("<em>{}</em>", nested())
    } else if node.payload::<Strong>().is_some() {
        format!("<strong>{}</strong>", nested())
    } else if let Some(link) = node.payload::<Link>() {
        format!(
            "<a href=\"{}\"{}>{}</a>",
            escape(&link.destination),
            title(&link.title),
            nested()
        )
    } else if let Some(image) = node.payload::<Image>() {
        format!(
            "<img src=\"{}\" alt=\"{}\"{} />",
            escape(&image.destination),
            escape(&plain(&node.children)),
            title(&image.title)
        )
    } else if let Some(html) = node.payload::<HtmlInline>() {
        html.literal.clone()
    } else if let Some(html) = node.payload::<HtmlBlock>() {
        html.literal.clone()
    } else {
        panic!("Unexpected node in CommonMark: {:?}", node.payload)
    }
}
