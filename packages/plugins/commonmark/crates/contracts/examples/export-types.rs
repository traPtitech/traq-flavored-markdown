use markdown_contract_export::{NodeExporter, Result, write};

fn main() -> Result<()> {
    let directory = std::env::args().nth(1).ok_or("Pass the output directory")?;
    let mut exporter = NodeExporter::default();
    macro_rules! register {
        ($group:literal; $($payload:ty => $kind:literal),+ $(,)?) => {
            $(exporter.register::<$payload>($group, $kind)?;)+
        };
    }
    markdown_commonmark_contracts::node_catalog!(register);
    write(directory, &exporter.finish()?)
}
