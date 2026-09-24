use std::{collections::hash_map::DefaultHasher, fs, hash::Hasher, path::Path};

// An accidental-mismatch identifier, not an authenticity signature. Hash bytes
// directly and normalize text/paths so Windows and Unix export the same ID.
fn input(path: &Path, hash: &mut DefaultHasher) {
    println!("cargo:rerun-if-changed={}", path.display());
    if path.is_dir() {
        let mut entries: Vec<_> = fs::read_dir(path)
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .collect();
        entries.sort();
        for entry in entries {
            input(&entry, hash);
        }
    } else {
        hash.write(path.to_str().unwrap().replace('\\', "/").as_bytes());
        hash.write(&[0]);
        hash.write(
            fs::read_to_string(path)
                .unwrap()
                .replace("\r\n", "\n")
                .as_bytes(),
        );
        hash.write(&[0]);
    }
}

fn crate_sources(root: &Path, hash: &mut DefaultHasher) {
    println!("cargo:rerun-if-changed={}", root.display());
    let mut crates: Vec<_> = fs::read_dir(root)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.join("Cargo.toml").is_file())
        .collect();
    crates.sort();
    for path in crates {
        input(&path.join("Cargo.toml"), hash);
        input(&path.join("src"), hash);
        let build_script = path.join("build.rs");
        if build_script.is_file() {
            input(&build_script, hash);
        }
    }
}

fn main() {
    let mut hash = DefaultHasher::new();
    for path in [
        "src",
        "../grammar/src",
        "../grammar/Cargo.toml",
        "../processing/src",
        "../processing/Cargo.toml",
        "build.rs",
        "Cargo.toml",
        "../../../../Cargo.toml",
        "../../../../Cargo.lock",
        "../../../../rust-toolchain.toml",
        "../../../../.cargo/config.toml",
    ] {
        input(Path::new(path), &mut hash);
    }
    for root in [
        "../../../core/crates",
        "../../../plugins/commonmark/crates",
        "../../../plugins/traq/crates",
    ] {
        crate_sources(Path::new(root), &mut hash);
    }
    println!("cargo:rustc-env=MARKDOWN_BUILD_ID={:016x}", hash.finish());
}
