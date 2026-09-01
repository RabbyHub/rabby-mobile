use std::ffi::{CStr, c_char};
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::{Path, PathBuf};

use resvg::{tiny_skia, usvg};
use sha2::{Digest, Sha256};

const MAX_INPUT_BYTES: usize = 5 * 1024 * 1024;
const MAX_XML_NODES: usize = 10_000;
const MAX_XML_DEPTH: usize = 64;
const MAX_ATTRIBUTES: usize = 50_000;
const MAX_ATTRIBUTE_VALUE_BYTES: usize = 64 * 1024;
const MIN_MAX_EDGE: u32 = 16;
const MAX_MAX_EDGE: u32 = 4096;
const MAX_ALLOWED_PIXELS: u32 = 16 * 1024 * 1024;

#[repr(i32)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RabbySafeSvgError {
    Ok = 0,
    InvalidArgument = 1,
    InputIo = 2,
    InputTooLarge = 3,
    UnsafeContent = 4,
    ParseFailed = 5,
    InvalidSize = 6,
    PixelLimit = 7,
    EncodeFailed = 8,
    Panic = 9,
    UnsupportedContent = 10,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RabbySafeSvgRenderResult {
    pub code: i32,
    pub width: u32,
    pub height: u32,
}

impl RabbySafeSvgRenderResult {
    fn success(width: u32, height: u32) -> Self {
        Self {
            code: RabbySafeSvgError::Ok as i32,
            width,
            height,
        }
    }

    fn failure(error: RabbySafeSvgError) -> Self {
        Self {
            code: error as i32,
            width: 0,
            height: 0,
        }
    }
}

#[derive(Debug)]
struct RenderedPng {
    bytes: Vec<u8>,
    width: u32,
    height: u32,
}

fn contains_ascii_case_insensitive(haystack: &str, needle: &str) -> bool {
    haystack
        .as_bytes()
        .windows(needle.len())
        .any(|window| window.eq_ignore_ascii_case(needle.as_bytes()))
}

fn is_local_url_reference(value: &str) -> bool {
    let value = value.trim();
    if !value.starts_with("url(") || !value.ends_with(')') {
        return false;
    }

    let reference = value[4..value.len() - 1].trim().trim_matches(['\'', '"']);
    reference.starts_with('#') && reference.len() > 1
}

fn contains_non_local_url_reference(value: &str) -> bool {
    let bytes = value.as_bytes();
    let mut offset = 0usize;
    while offset + 4 <= bytes.len() {
        let Some(relative) = bytes[offset..]
            .windows(4)
            .position(|window| window.eq_ignore_ascii_case(b"url("))
        else {
            return false;
        };
        let start = offset + relative;
        let Some(close) = value[start + 4..].find(')') else {
            return true;
        };
        let end = start + 4 + close + 1;
        if !is_local_url_reference(&value[start..end]) {
            return true;
        }
        offset = end;
    }
    false
}

fn validate_svg_profile(svg: &[u8]) -> Result<&str, RabbySafeSvgError> {
    if svg.len() > MAX_INPUT_BYTES {
        return Err(RabbySafeSvgError::InputTooLarge);
    }
    if svg.starts_with(&[0x1f, 0x8b]) {
        return Err(RabbySafeSvgError::UnsafeContent);
    }

    let text = std::str::from_utf8(svg).map_err(|_| RabbySafeSvgError::ParseFailed)?;
    if contains_ascii_case_insensitive(text, "<!doctype")
        || contains_ascii_case_insensitive(text, "<!entity")
        || contains_ascii_case_insensitive(text, "<?xml-stylesheet")
    {
        return Err(RabbySafeSvgError::UnsafeContent);
    }

    let options = roxmltree::ParsingOptions {
        allow_dtd: false,
        ..Default::default()
    };
    let document = roxmltree::Document::parse_with_options(text, options)
        .map_err(|_| RabbySafeSvgError::ParseFailed)?;

    let root = document.root_element();
    if root.tag_name().name() != "svg" {
        return Err(RabbySafeSvgError::ParseFailed);
    }

    let forbidden_elements = [
        "script",
        "style",
        "foreignObject",
        "image",
        "animate",
        "animateMotion",
        "animateTransform",
        "set",
        "audio",
        "video",
        "iframe",
    ];
    let unsupported_elements = ["text", "textPath", "tspan"];
    let mut node_count = 0usize;
    let mut attribute_count = 0usize;

    for node in document.descendants() {
        node_count = node_count.saturating_add(1);
        if node_count > MAX_XML_NODES {
            return Err(RabbySafeSvgError::UnsafeContent);
        }
        if node.ancestors().count() > MAX_XML_DEPTH {
            return Err(RabbySafeSvgError::UnsafeContent);
        }
        if node.is_pi() {
            return Err(RabbySafeSvgError::UnsafeContent);
        }
        if !node.is_element() {
            continue;
        }

        let element_name = node.tag_name().name();
        if forbidden_elements.contains(&element_name) {
            return Err(RabbySafeSvgError::UnsafeContent);
        }
        if unsupported_elements.contains(&element_name) {
            return Err(RabbySafeSvgError::UnsupportedContent);
        }

        for attribute in node.attributes() {
            attribute_count = attribute_count.saturating_add(1);
            if attribute_count > MAX_ATTRIBUTES
                || attribute.value().len() > MAX_ATTRIBUTE_VALUE_BYTES
            {
                return Err(RabbySafeSvgError::UnsafeContent);
            }

            let name = attribute.name();
            let value = attribute.value().trim();
            if name
                .as_bytes()
                .get(..2)
                .is_some_and(|prefix| prefix.eq_ignore_ascii_case(b"on"))
            {
                return Err(RabbySafeSvgError::UnsafeContent);
            }
            if name == "href" && !value.starts_with('#') {
                return Err(RabbySafeSvgError::UnsafeContent);
            }
            if name == "style"
                && (contains_ascii_case_insensitive(value, "@import")
                    || contains_non_local_url_reference(value))
            {
                return Err(RabbySafeSvgError::UnsafeContent);
            }
            if contains_ascii_case_insensitive(value, "javascript:")
                || contains_ascii_case_insensitive(value, "file:")
                || contains_ascii_case_insensitive(value, "data:")
                || contains_ascii_case_insensitive(value, "http:")
                || contains_ascii_case_insensitive(value, "https:")
            {
                return Err(RabbySafeSvgError::UnsafeContent);
            }
            if contains_ascii_case_insensitive(value, "url(") {
                let has_unsafe_reference = if name == "style" {
                    contains_non_local_url_reference(value)
                } else {
                    !is_local_url_reference(value)
                };
                if has_unsafe_reference {
                    return Err(RabbySafeSvgError::UnsafeContent);
                }
            }
        }
    }

    Ok(text)
}

fn render_svg_to_png(
    svg: &[u8],
    max_edge: u32,
    max_pixels: u32,
) -> Result<RenderedPng, RabbySafeSvgError> {
    validate_svg_profile(svg)?;
    if !(MIN_MAX_EDGE..=MAX_MAX_EDGE).contains(&max_edge)
        || max_pixels == 0
        || max_pixels > MAX_ALLOWED_PIXELS
    {
        return Err(RabbySafeSvgError::InvalidArgument);
    }

    let options = usvg::Options {
        resources_dir: None,
        image_href_resolver: usvg::ImageHrefResolver {
            resolve_data: Box::new(|_, _, _| None),
            resolve_string: Box::new(|_, _| None),
        },
        ..usvg::Options::default()
    };
    let tree = usvg::Tree::from_data(svg, &options).map_err(|error| match error {
        usvg::Error::ElementsLimitReached => RabbySafeSvgError::UnsafeContent,
        usvg::Error::InvalidSize => RabbySafeSvgError::InvalidSize,
        _ => RabbySafeSvgError::ParseFailed,
    })?;

    let source_size = tree.size();
    let source_width = source_size.width();
    let source_height = source_size.height();
    if !source_width.is_finite()
        || !source_height.is_finite()
        || source_width <= 0.0
        || source_height <= 0.0
    {
        return Err(RabbySafeSvgError::InvalidSize);
    }

    let requested_scale = max_edge as f32 / source_width.max(source_height);
    if !requested_scale.is_finite() || requested_scale <= 0.0 {
        return Err(RabbySafeSvgError::InvalidSize);
    }

    let requested_width = (source_width * requested_scale).round().max(1.0) as u32;
    let requested_height = (source_height * requested_scale).round().max(1.0) as u32;
    let requested_pixels = requested_width
        .checked_mul(requested_height)
        .ok_or(RabbySafeSvgError::PixelLimit)?;
    let final_scale = if requested_pixels > max_pixels {
        requested_scale * (max_pixels as f32 / requested_pixels as f32).sqrt()
    } else {
        requested_scale
    };

    let width = (source_width * final_scale).round().max(1.0) as u32;
    let height = (source_height * final_scale).round().max(1.0) as u32;
    let pixels = width
        .checked_mul(height)
        .ok_or(RabbySafeSvgError::PixelLimit)?;
    if pixels > max_pixels {
        return Err(RabbySafeSvgError::PixelLimit);
    }

    let mut pixmap = tiny_skia::Pixmap::new(width, height).ok_or(RabbySafeSvgError::PixelLimit)?;
    let transform = tiny_skia::Transform::from_scale(final_scale, final_scale);
    resvg::render(&tree, transform, &mut pixmap.as_mut());
    let bytes = pixmap
        .encode_png()
        .map_err(|_| RabbySafeSvgError::EncodeFailed)?;

    Ok(RenderedPng {
        bytes,
        width,
        height,
    })
}

fn render_file(
    input_path: &Path,
    output_path: &Path,
    max_edge: u32,
    max_pixels: u32,
) -> Result<RabbySafeSvgRenderResult, RabbySafeSvgError> {
    let metadata = std::fs::metadata(input_path).map_err(|_| RabbySafeSvgError::InputIo)?;
    if !metadata.is_file() {
        return Err(RabbySafeSvgError::InputIo);
    }
    if metadata.len() > MAX_INPUT_BYTES as u64 {
        return Err(RabbySafeSvgError::InputTooLarge);
    }

    let svg = std::fs::read(input_path).map_err(|_| RabbySafeSvgError::InputIo)?;
    let rendered = render_svg_to_png(&svg, max_edge, max_pixels)?;
    std::fs::write(output_path, rendered.bytes).map_err(|_| RabbySafeSvgError::EncodeFailed)?;
    Ok(RabbySafeSvgRenderResult::success(
        rendered.width,
        rendered.height,
    ))
}

fn c_path(path: *const c_char) -> Result<PathBuf, RabbySafeSvgError> {
    if path.is_null() {
        return Err(RabbySafeSvgError::InvalidArgument);
    }
    let value = unsafe { CStr::from_ptr(path) }
        .to_str()
        .map_err(|_| RabbySafeSvgError::InvalidArgument)?;
    if value.is_empty() {
        return Err(RabbySafeSvgError::InvalidArgument);
    }
    Ok(PathBuf::from(value))
}

#[unsafe(no_mangle)]
/// # Safety
///
/// Both path pointers must be non-null, NUL-terminated UTF-8 strings that
/// remain valid for the duration of this call.
pub unsafe extern "C" fn rabby_safe_svg_render_file(
    input_path: *const c_char,
    output_path: *const c_char,
    max_edge: u32,
    max_pixels: u32,
) -> RabbySafeSvgRenderResult {
    match catch_unwind(AssertUnwindSafe(|| {
        let input_path = c_path(input_path)?;
        let output_path = c_path(output_path)?;
        render_file(&input_path, &output_path, max_edge, max_pixels)
    })) {
        Ok(Ok(result)) => result,
        Ok(Err(error)) => RabbySafeSvgRenderResult::failure(error),
        Err(_) => RabbySafeSvgRenderResult::failure(RabbySafeSvgError::Panic),
    }
}

#[unsafe(no_mangle)]
/// # Safety
///
/// `data` must point to `data_len` readable bytes. `output_hex` must point to
/// at least `output_hex_len` writable bytes, with a minimum length of 65.
pub unsafe extern "C" fn rabby_safe_svg_sha256(
    data: *const u8,
    data_len: usize,
    output_hex: *mut c_char,
    output_hex_len: usize,
) -> i32 {
    let result = catch_unwind(AssertUnwindSafe(|| {
        if data.is_null() || output_hex.is_null() || output_hex_len < 65 {
            return Err(RabbySafeSvgError::InvalidArgument);
        }
        let bytes = unsafe { std::slice::from_raw_parts(data, data_len) };
        let digest = Sha256::digest(bytes);
        let mut encoded = [0u8; 64];
        const HEX: &[u8; 16] = b"0123456789abcdef";
        for (index, byte) in digest.iter().copied().enumerate() {
            encoded[index * 2] = HEX[(byte >> 4) as usize];
            encoded[index * 2 + 1] = HEX[(byte & 0x0f) as usize];
        }
        unsafe {
            std::ptr::copy_nonoverlapping(encoded.as_ptr(), output_hex.cast::<u8>(), encoded.len());
            *output_hex.add(encoded.len()) = 0;
        }
        Ok(())
    }));

    match result {
        Ok(Ok(())) => RabbySafeSvgError::Ok as i32,
        Ok(Err(error)) => error as i32,
        Err(_) => RabbySafeSvgError::Panic as i32,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAFE_SVG: &[u8] = br##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><defs><linearGradient id="g"><stop stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient></defs><rect width="100" height="50" fill="url(#g)"/></svg>"##;

    #[test]
    fn renders_a_bounded_static_svg_to_png() {
        let rendered = render_svg_to_png(SAFE_SVG, 256, 1_000_000).unwrap();
        assert_eq!((rendered.width, rendered.height), (256, 128));
        assert!(rendered.bytes.starts_with(&[0x89, b'P', b'N', b'G']));
    }

    #[test]
    fn permits_local_inline_style_references_but_rejects_style_elements() {
        let inline = br##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"><stop stop-color="#fff"/></linearGradient></defs><rect width="10" height="10" style="fill:url(#g);stroke:#000"/></svg>"##;
        assert!(render_svg_to_png(inline, 64, 100_000).is_ok());

        let stylesheet = br#"<svg xmlns="http://www.w3.org/2000/svg"><style>rect { fill: url(https://example.com/a.svg); }</style><rect width="1" height="1"/></svg>"#;
        assert_eq!(
            render_svg_to_png(stylesheet, 64, 100_000).unwrap_err(),
            RabbySafeSvgError::UnsafeContent
        );
    }

    #[test]
    fn rejects_active_and_external_content() {
        for svg in [
            br#"<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>"#.as_slice(),
            br#"<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png"/></svg>"#.as_slice(),
            br#"<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="run()" width="1" height="1"/></svg>"#.as_slice(),
            br#"<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"/>"#.as_slice(),
        ] {
            assert_eq!(
                render_svg_to_png(svg, 256, 1_000_000).unwrap_err(),
                RabbySafeSvgError::UnsafeContent
            );
        }
    }

    #[test]
    fn rejects_malformed_svg_without_panicking() {
        assert_eq!(
            render_svg_to_png(b"<svg><", 256, 1_000_000).unwrap_err(),
            RabbySafeSvgError::ParseFailed
        );
    }

    #[test]
    fn rejects_text_instead_of_silently_dropping_it() {
        let svg = br#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><text x="1" y="10">NFT</text></svg>"#;
        assert_eq!(
            render_svg_to_png(svg, 64, 100_000).unwrap_err(),
            RabbySafeSvgError::UnsupportedContent
        );
    }

    #[test]
    fn clamps_output_by_edge_and_pixel_budget() {
        let svg = br#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10000 10000"><rect width="10000" height="10000"/></svg>"#;
        let rendered = render_svg_to_png(svg, 4096, 1_000_000).unwrap();
        assert!(rendered.width <= 1000);
        assert!(rendered.height <= 1000);
        assert!(rendered.width * rendered.height <= 1_000_000);
    }
}
