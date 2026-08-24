#pragma once

#include <rabby/openapi/RabbyOpenApiCredential.h>

#include <cstdint>
#include <memory>
#include <string>

namespace rabby::openapi {

// Implemented by exactly one platform adapter in each native target.
std::shared_ptr<ApiCredentialPersistence>
makePlatformApiCredentialPersistence();
std::string makePlatformUuid();
std::int64_t platformEpochSeconds();

} // namespace rabby::openapi
