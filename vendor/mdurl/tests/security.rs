use mdurl::parse_url;

#[test]
fn malformed_unicode_hosts_preserve_trimmed_input() {
    for host in ["😀!", "abc.é!", "é.!x.😀", "abc.!x.é"] {
        for padding in ["", " ", "\n\t", "\u{2003}"] {
            for port in ["", ":80"] {
                let input = format!("{padding}http://{host}{port}/path?x=1#frag{padding}");
                let parsed = parse_url(&input);
                assert_eq!(parsed.to_string(), input.trim(), "{input:?}");
                assert_eq!(parsed.port, None, "{input:?}");
            }
        }
    }
}

#[test]
fn invalid_host_suffix_keeps_its_port_in_the_path() {
    let parsed = parse_url("  http://abc.!é:80/path  ");
    assert_eq!(parsed.hostname.as_deref(), Some("abc."));
    assert_eq!(parsed.pathname.as_deref(), Some("!é:80/path"));
    assert_eq!(parsed.port, None);
}
