use markdown_contract_export::{CoreContract, Result, write};

fn main() -> Result<()> {
    let directory = std::env::args().nth(1).ok_or("Pass the output directory")?;
    write(
        directory,
        &CoreContract {
            limits: markdown_ast::ValidationLimits::default().into(),
        },
    )
}
