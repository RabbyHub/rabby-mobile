use std::ffi::{CStr, c_char};
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};

use base64::Engine;
use resvg::{tiny_skia, usvg};
use sha2::{Digest, Sha256};

const MAX_INPUT_BYTES: usize = 5 * 1024 * 1024;
const MAX_XML_NODES: usize = 10_000;
const MAX_XML_DEPTH: usize = 64;
const MAX_ATTRIBUTES: usize = 50_000;
const MAX_ATTRIBUTE_VALUE_BYTES: usize = 64 * 1024;
const MAX_STYLESHEET_BYTES: usize = 64 * 1024;
const MAX_TEXT_CHARACTERS: usize = 16 * 1024;
const MAX_EMBEDDED_PNG_BYTES: usize = 4 * 1024 * 1024;
const MAX_EMBEDDED_PNG_PIXELS: u64 = 4 * 1024 * 1024;
const MAX_TOTAL_EMBEDDED_PNG_PIXELS: u64 = 16 * 1024 * 1024;
const MIN_MAX_EDGE: u32 = 16;
const MAX_MAX_EDGE: u32 = 4096;
const MAX_ALLOWED_PIXELS: u32 = 16 * 1024 * 1024;
const BUNDLED_FONT_BYTES: &[u8] = include_bytes!("../assets/basic/Basic-Regular.ttf");
const BUNDLED_FONT_FAMILY: &str = "Basic";

static BUNDLED_FONT_DB: OnceLock<Option<Arc<usvg::fontdb::Database>>> = OnceLock::new();

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

fn validate_css_fragment(value: &str) -> Result<(), RabbySafeSvgError> {
    // CSS escapes can hide an at-rule, URL function, or scheme from a
    // byte-level policy check. Rabby's static profile does not need them.
    if value.contains('\\')
        || value.contains('@')
        || contains_ascii_case_insensitive(value, "expression(")
        || contains_non_local_url_reference(value)
        || contains_ascii_case_insensitive(value, "javascript:")
        || contains_ascii_case_insensitive(value, "file:")
        || contains_ascii_case_insensitive(value, "data:")
        || contains_ascii_case_insensitive(value, "http:")
        || contains_ascii_case_insensitive(value, "https:")
    {
        return Err(RabbySafeSvgError::UnsafeContent);
    }

    Ok(())
}

fn bundled_font_database() -> Result<Arc<usvg::fontdb::Database>, RabbySafeSvgError> {
    BUNDLED_FONT_DB
        .get_or_init(|| {
            let mut database = usvg::fontdb::Database::new();
            database.load_font_data(BUNDLED_FONT_BYTES.to_vec());
            if database.is_empty() {
                return None;
            }

            database.set_serif_family(BUNDLED_FONT_FAMILY);
            database.set_sans_serif_family(BUNDLED_FONT_FAMILY);
            database.set_cursive_family(BUNDLED_FONT_FAMILY);
            database.set_fantasy_family(BUNDLED_FONT_FAMILY);
            database.set_monospace_family(BUNDLED_FONT_FAMILY);
            Some(Arc::new(database))
        })
        .clone()
        .ok_or(RabbySafeSvgError::UnsupportedContent)
}

fn embedded_png_dimensions(data: &[u8]) -> Result<(u32, u32), RabbySafeSvgError> {
    const PNG_SIGNATURE: &[u8; 8] = b"\x89PNG\r\n\x1a\n";
    if data.len() < 24
        || data.len() > MAX_EMBEDDED_PNG_BYTES
        || &data[..8] != PNG_SIGNATURE
        || u32::from_be_bytes(data[8..12].try_into().unwrap_or_default()) != 13
        || &data[12..16] != b"IHDR"
    {
        return Err(RabbySafeSvgError::UnsafeContent);
    }

    let width = u32::from_be_bytes(data[16..20].try_into().unwrap_or_default());
    let height = u32::from_be_bytes(data[20..24].try_into().unwrap_or_default());
    let pixels = u64::from(width)
        .checked_mul(u64::from(height))
        .ok_or(RabbySafeSvgError::UnsafeContent)?;
    if width == 0
        || height == 0
        || width > MAX_MAX_EDGE
        || height > MAX_MAX_EDGE
        || pixels > MAX_EMBEDDED_PNG_PIXELS
    {
        return Err(RabbySafeSvgError::UnsafeContent);
    }

    Ok((width, height))
}

fn validate_embedded_png_href(value: &str) -> Result<u64, RabbySafeSvgError> {
    const PREFIX: &str = "data:image/png;base64,";
    let encoded = value
        .strip_prefix(PREFIX)
        .filter(|encoded| !encoded.is_empty())
        .ok_or(RabbySafeSvgError::UnsafeContent)?;
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|_| RabbySafeSvgError::UnsafeContent)?;
    let (width, height) = embedded_png_dimensions(&decoded)?;
    Ok(u64::from(width) * u64::from(height))
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
        "foreignObject",
        "animate",
        "animateMotion",
        "animateTransform",
        "set",
        "audio",
        "video",
        "iframe",
    ];
    let unsupported_elements = ["textPath"];
    let mut node_count = 0usize;
    let mut attribute_count = 0usize;
    let mut stylesheet_bytes = 0usize;
    let mut text_characters = 0usize;
    let mut total_embedded_png_pixels = 0u64;
    let bundled_font = ttf_parser::Face::parse(BUNDLED_FONT_BYTES, 0)
        .map_err(|_| RabbySafeSvgError::UnsupportedContent)?;

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
        if node.is_text()
            && node.ancestors().any(|ancestor| {
                ancestor.is_element() && matches!(ancestor.tag_name().name(), "text" | "tspan")
            })
        {
            let value = node.text().unwrap_or_default();
            text_characters = text_characters.saturating_add(value.chars().count());
            if text_characters > MAX_TEXT_CHARACTERS
                || value.chars().any(|character| {
                    !character.is_whitespace() && bundled_font.glyph_index(character).is_none()
                })
            {
                return Err(RabbySafeSvgError::UnsupportedContent);
            }
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

        if element_name == "style" {
            if node.children().any(|child| child.is_element()) {
                return Err(RabbySafeSvgError::UnsafeContent);
            }

            let mut stylesheet = String::new();
            for content in node.children().filter_map(|child| child.text()) {
                stylesheet_bytes = stylesheet_bytes.saturating_add(content.len());
                if stylesheet_bytes > MAX_STYLESHEET_BYTES {
                    return Err(RabbySafeSvgError::UnsafeContent);
                }
                stylesheet.push_str(content);
            }
            validate_css_fragment(&stylesheet)?;
        }

        if element_name == "image"
            && node
                .attributes()
                .filter(|attribute| attribute.name() == "href")
                .count()
                != 1
        {
            return Err(RabbySafeSvgError::UnsafeContent);
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
            let is_embedded_png = element_name == "image" && name == "href";
            if name
                .as_bytes()
                .get(..2)
                .is_some_and(|prefix| prefix.eq_ignore_ascii_case(b"on"))
            {
                return Err(RabbySafeSvgError::UnsafeContent);
            }
            if is_embedded_png {
                total_embedded_png_pixels = total_embedded_png_pixels
                    .checked_add(validate_embedded_png_href(value)?)
                    .ok_or(RabbySafeSvgError::UnsafeContent)?;
                if total_embedded_png_pixels > MAX_TOTAL_EMBEDDED_PNG_PIXELS {
                    return Err(RabbySafeSvgError::UnsafeContent);
                }
            } else if name == "href" && !value.starts_with('#') {
                return Err(RabbySafeSvgError::UnsafeContent);
            }
            if name == "style" {
                validate_css_fragment(value)?;
            } else if contains_non_local_url_reference(value) {
                return Err(RabbySafeSvgError::UnsafeContent);
            }
            if !is_embedded_png
                && (contains_ascii_case_insensitive(value, "javascript:")
                    || contains_ascii_case_insensitive(value, "file:")
                    || contains_ascii_case_insensitive(value, "data:")
                    || contains_ascii_case_insensitive(value, "http:")
                    || contains_ascii_case_insensitive(value, "https:"))
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

    let fontdb = bundled_font_database()?;
    let font_id = fontdb
        .faces()
        .next()
        .map(|face| face.id)
        .ok_or(RabbySafeSvgError::UnsupportedContent)?;
    let options = usvg::Options {
        resources_dir: None,
        font_family: BUNDLED_FONT_FAMILY.to_owned(),
        image_href_resolver: usvg::ImageHrefResolver {
            resolve_data: Box::new(|mime, data, _| {
                if mime == "image/png" && embedded_png_dimensions(&data).is_ok() {
                    Some(usvg::ImageKind::PNG(Arc::clone(&data)))
                } else {
                    None
                }
            }),
            resolve_string: Box::new(|_, _| None),
        },
        font_resolver: usvg::FontResolver {
            // Ignore untrusted font-family names. Every accepted glyph is
            // converted to paths with this one app-bundled font.
            select_font: Box::new(move |_, _| Some(font_id)),
            select_fallback: Box::new(|_, _, _| None),
        },
        fontdb,
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
    fn permits_local_style_references_but_rejects_unsafe_stylesheets() {
        let inline = br##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"><stop stop-color="#fff"/></linearGradient></defs><rect width="10" height="10" style="fill:url(#g);stroke:#000"/></svg>"##;
        assert!(render_svg_to_png(inline, 64, 100_000).is_ok());

        for stylesheet in [
            br#"<svg xmlns="http://www.w3.org/2000/svg"><style>rect { fill: url(https://example.com/a.svg); }</style><rect width="1" height="1"/></svg>"#.as_slice(),
            br#"<svg xmlns="http://www.w3.org/2000/svg"><style>@import "theme.css"; rect { fill: red; }</style><rect width="1" height="1"/></svg>"#.as_slice(),
            br#"<svg xmlns="http://www.w3.org/2000/svg"><style>.x { fill: u\72l(https://example.com/a.svg); }</style><rect class="x" width="1" height="1"/></svg>"#.as_slice(),
        ] {
            assert_eq!(
                render_svg_to_png(stylesheet, 64, 100_000).unwrap_err(),
                RabbySafeSvgError::UnsafeContent
            );
        }
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
    fn renders_a_bounded_embedded_png_but_rejects_other_image_sources() {
        let embedded_png = br#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><image width="240" height="240" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAADwBAMAAADMe/ShAAAAG1BMVEUAAACui2FjhZb/9o5ZWVmGWB5fHQmnfEcAQP8C9EmFAAABQElEQVR42u3by23DMBAFQLWQFtyCWkgLaSEtpIWUHUgHC1isGZJY00Ay7yaR4OzpQfJnu70oGxgMBoPBYDAYDAaD/x68HwmX4R4YDAa/Gs6O3pNkY4HBYPBKeH+UjlUwGAxeDg9J48OAwWBwLTzEdQzTXZlgMBg8A+91GXvYA4PB4Gm4Y4S3JOMjgMFgcC3c5jL9utf7TQEYDAaXwUNFmc2xHZmoTDAYDJ6Gg34ec536cU/Qr4UMnuhqMBgM7ofD7gCfl19HAnwtgMFg8HI4q8ygt1P5sAcGg8HTr6mTcPtn/GAwGFwGh93tD9iyiTpMMBgMfhY8VJnb7wGDweCnwqHxMvjznnP1/VG+j4DBYPAiOG5s9mZlZYLBYHA9nI2QHT37tyMwGAyuh7OOvA0HDAaDl8OTRQkGg8FgMBj8L+Efqp8TFlZDe5MAAAAASUVORK5CYII="/></svg>"#;
        let rendered = render_svg_to_png(embedded_png, 64, 100_000).unwrap();
        let pixmap = tiny_skia::Pixmap::decode_png(&rendered.bytes).unwrap();
        assert!(pixmap.pixels().iter().any(|pixel| pixel.alpha() > 0));

        for svg in [
            br#"<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png"/></svg>"#.as_slice(),
            br#"<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/svg+xml;base64,PHN2Zy8+"/></svg>"#.as_slice(),
            br#"<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,not-base64"/></svg>"#.as_slice(),
        ] {
            assert_eq!(
                render_svg_to_png(svg, 64, 100_000).unwrap_err(),
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
    fn renders_bounded_static_text_with_the_bundled_font() {
        let svg = br##"<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet" viewBox="0 0 350 350"><style>.base { fill: black; font-family: Impact; font-size: 50px; }</style><rect width="100%" height="100%" fill="#E8D33E"/><text x="10" y="60" class="base">token 1398</text><text x="10" y="150" class="base">balanceOf 15721239218291655</text><text x="10" y="230" class="base">locked_end 1680739200</text><text x="10" y="310" class="base">value 4000000000000000000</text></svg>"##;
        let rendered = render_svg_to_png(svg, 350, 350 * 350).unwrap();
        let pixmap = tiny_skia::Pixmap::decode_png(&rendered.bytes).unwrap();

        assert_eq!((rendered.width, rendered.height), (350, 350));
        assert!(pixmap.pixels().iter().any(|pixel| {
            pixel.alpha() > 0 && pixel.red() < 64 && pixel.green() < 64 && pixel.blue() < 64
        }));
    }

    #[test]
    fn rejects_text_that_cannot_be_rendered_without_external_fonts() {
        let svg = r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><text x="1" y="10">🙂</text></svg>"#;
        assert_eq!(
            render_svg_to_png(svg.as_bytes(), 64, 100_000).unwrap_err(),
            RabbySafeSvgError::UnsupportedContent
        );
    }

    #[test]
    fn rejects_text_paths_and_excessive_text_work() {
        let text_path = br##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path id="p" d="M0 10h20"/><text><textPath href="#p">NFT</textPath></text></svg>"##;
        assert_eq!(
            render_svg_to_png(text_path, 64, 100_000).unwrap_err(),
            RabbySafeSvgError::UnsupportedContent
        );

        let oversized_text = format!(
            "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\"><text>{}</text></svg>",
            "a".repeat(MAX_TEXT_CHARACTERS + 1)
        );
        assert_eq!(
            render_svg_to_png(oversized_text.as_bytes(), 64, 100_000).unwrap_err(),
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
