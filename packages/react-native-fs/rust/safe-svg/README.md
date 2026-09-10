# Rabby Safe SVG Rust core

This crate is the memory-safe SVG parsing and rasterization core used by the
Rabby Mobile native filesystem/media boundary. It is not a general SVG viewer.

The public C ABI accepts only a local input file and writes a PNG to a caller-
selected private temporary path. Before calling `resvg`, it enforces Rabby's
static SVG profile: bounded input, XML depth and node counts, no DTD/entities,
scripts, event handlers, animation, embedded images, or external references.
Text is currently reported as unsupported instead of being silently omitted;
the native package deliberately does not load device or remote fonts.

`resvg` is pinned exactly in `Cargo.toml`; `Cargo.lock` is committed for
reproducible Android and iOS builds. Generated `target/` and `build/` outputs
are ignored.

The crate is licensed under MIT. `resvg` and its dependency tree retain their
own upstream MIT/Apache-2.0-compatible license notices in Cargo metadata.
