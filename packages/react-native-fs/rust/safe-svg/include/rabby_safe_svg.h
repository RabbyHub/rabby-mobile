#pragma once

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum RabbySafeSvgError {
  RABBY_SAFE_SVG_OK = 0,
  RABBY_SAFE_SVG_INVALID_ARGUMENT = 1,
  RABBY_SAFE_SVG_INPUT_IO = 2,
  RABBY_SAFE_SVG_INPUT_TOO_LARGE = 3,
  RABBY_SAFE_SVG_UNSAFE_CONTENT = 4,
  RABBY_SAFE_SVG_PARSE_FAILED = 5,
  RABBY_SAFE_SVG_INVALID_SIZE = 6,
  RABBY_SAFE_SVG_PIXEL_LIMIT = 7,
  RABBY_SAFE_SVG_ENCODE_FAILED = 8,
  RABBY_SAFE_SVG_PANIC = 9,
  RABBY_SAFE_SVG_UNSUPPORTED_CONTENT = 10,
} RabbySafeSvgError;

typedef struct RabbySafeSvgRenderResult {
  int32_t code;
  uint32_t width;
  uint32_t height;
} RabbySafeSvgRenderResult;

RabbySafeSvgRenderResult rabby_safe_svg_render_file(
    const char* input_path,
    const char* output_path,
    uint32_t max_edge,
    uint32_t max_pixels);

int32_t rabby_safe_svg_sha256(
    const uint8_t* data,
    size_t data_len,
    char* output_hex,
    size_t output_hex_len);

#ifdef __cplusplus
}
#endif
