# Rabby Safe SVG Rust core

This crate is the memory-safe SVG parsing and rasterization core used by the
Rabby Mobile native filesystem/media boundary. It is not a general SVG viewer.

The public C ABI accepts only a local input file and writes a PNG to a caller-
selected private temporary path. Before calling `resvg`, it enforces Rabby's
static SVG profile: bounded input, XML depth and node counts, no DTD/entities,
scripts, event handlers, animation, or external references. Embedded images are
limited to byte- and dimension-checked PNG data URLs; other image sources stay
blocked.
Bounded static text and simple stylesheets are converted to paths with the
bundled Basic font. The profile rejects CSS at-rules and escapes, external
resources, text paths, excessive text, and characters the bundled font cannot
render instead of silently omitting them. It never scans device fonts or loads
fonts supplied by an SVG or the network.

`assets/basic/Basic-Regular.ttf` is distributed under the SIL Open Font License
1.1 in `assets/basic/OFL.txt`.

`resvg` is pinned exactly in `Cargo.toml`; `Cargo.lock` is committed for
reproducible Android and iOS builds. Generated `target/` and `build/` outputs
are ignored.

The crate is licensed under MIT. `resvg` and its dependency tree retain their
own upstream MIT/Apache-2.0-compatible license notices in Cargo metadata.
