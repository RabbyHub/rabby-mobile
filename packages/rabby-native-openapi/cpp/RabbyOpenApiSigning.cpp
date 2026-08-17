#include <rabby/openapi/RabbyOpenApiSigning.h>

namespace rabby::openapi {

OpenApiSigningResult unavailableOpenApiRequestSigner(OpenApiSigningInput) {
  return {{}, "private OpenAPI signer is unavailable"};
}

} // namespace rabby::openapi
