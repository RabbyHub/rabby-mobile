#pragma once

#include <rabby/openapi/RabbyOpenApiAssetModels.h>

#include <cstdint>
#include <string>
#include <vector>

namespace rabby::openapi {

struct TokenSnapshotDecodeResult {
  std::vector<NativeTokenRecord> tokens;
  std::string error;

  bool isSuccess() const {
    return error.empty();
  }
};

std::vector<std::uint8_t> encodeTokenSnapshot(
    const std::vector<NativeTokenRecord>& tokens);

TokenSnapshotDecodeResult decodeTokenSnapshot(
    const std::vector<std::uint8_t>& payload);

} // namespace rabby::openapi
