#include <rabby/openapi/RabbyOpenApiRequest.h>

#include <algorithm>
#include <array>
#include <cctype>
#include <string_view>
#include <unordered_set>
#include <utility>

namespace rabby::openapi {
namespace {

constexpr char kHexDigits[] = "0123456789ABCDEF";
constexpr std::array<std::string_view, 8> kOwnedHeaderNames{
    "x-client",
    "x-version",
    "x-api-key",
    "x-api-time",
    "x-api-ts",
    "x-api-nonce",
    "x-api-ver",
    "x-api-sign",
};

bool isControlOrSpace(unsigned char character) {
  return character <= 0x20 || character == 0x7f;
}

bool containsControlOrSpace(std::string_view value) {
  return std::any_of(value.begin(), value.end(), [](unsigned char character) {
    return isControlOrSpace(character);
  });
}

bool isAscii(std::string_view value) {
  return std::all_of(value.begin(), value.end(), [](unsigned char character) {
    return character <= 0x7f;
  });
}

std::string asciiLower(std::string value) {
  std::transform(
      value.begin(), value.end(), value.begin(), [](unsigned char character) {
        return static_cast<char>(std::tolower(character));
      });
  return value;
}

bool isOwnedHeader(std::string name) {
  name = asciiLower(std::move(name));
  return std::find(kOwnedHeaderNames.begin(), kOwnedHeaderNames.end(), name) !=
      kOwnedHeaderNames.end();
}

std::optional<std::string> normalizeBaseUrl(std::string baseUrl) {
  constexpr std::string_view kScheme = "https://";
  if (baseUrl.rfind(kScheme, 0) != 0 || containsControlOrSpace(baseUrl)) {
    return std::nullopt;
  }
  if (baseUrl.find_first_of("?#", kScheme.size()) != std::string::npos) {
    return std::nullopt;
  }

  const auto pathStart = baseUrl.find('/', kScheme.size());
  const auto authority = baseUrl.substr(
      kScheme.size(),
      pathStart == std::string::npos ? std::string::npos : pathStart - kScheme.size());
  if (authority.empty() || authority.find('@') != std::string::npos) {
    return std::nullopt;
  }
  if (pathStart != std::string::npos &&
      baseUrl.find_first_not_of('/', pathStart) != std::string::npos) {
    return std::nullopt;
  }

  while (baseUrl.size() > kScheme.size() && baseUrl.back() == '/') {
    baseUrl.pop_back();
  }
  return baseUrl;
}

std::string validatePath(std::string_view uriPath) {
  if (uriPath.empty() || uriPath.front() != '/') {
    return "uriPath must be an absolute path";
  }
  if (uriPath.find_first_of("?#") != std::string_view::npos) {
    return "uriPath must not contain a query or fragment";
  }
  if (std::any_of(uriPath.begin(), uriPath.end(), [](unsigned char character) {
        return character > 0x7f || isControlOrSpace(character);
      })) {
    return "uriPath must be encoded ASCII without spaces or control characters";
  }
  return {};
}

std::string validateQuery(const std::vector<SigningParameter>& query) {
  std::unordered_set<std::string> keys;
  for (const auto& parameter : query) {
    if (parameter.key.empty()) {
      return "query parameter key must not be empty";
    }
    if (!isAscii(parameter.key)) {
      return "query parameter keys must be ASCII";
    }
    if (!keys.insert(parameter.key).second) {
      return "duplicate query parameter key";
    }
  }
  return {};
}

std::string buildQueryString(const std::vector<SigningParameter>& query) {
  std::string result;
  for (const auto& parameter : query) {
    if (!parameter.value.has_value()) {
      continue;
    }
    if (!result.empty()) {
      result.push_back('&');
    }
    result.append(encodeQueryComponent(parameter.key));
    result.push_back('=');
    result.append(encodeQueryComponent(*parameter.value));
  }
  return result;
}

std::vector<SigningParameter> makeSigningParameters(
    const std::vector<SigningParameter>& query) {
  std::vector<SigningParameter> result;
  result.reserve(query.size());
  for (const auto& parameter : query) {
    if (parameter.value.has_value()) {
      result.push_back(parameter);
    }
  }
  return result;
}

bool isAxiosUnescaped(unsigned char character) {
  if ((character >= 'a' && character <= 'z') ||
      (character >= 'A' && character <= 'Z') ||
      (character >= '0' && character <= '9')) {
    return true;
  }
  switch (character) {
    case '-':
    case '_':
    case '.':
    case '!':
    case '~':
    case '*':
    case '\'':
    case '(':
    case ')':
    case ':':
    case '$':
    case ',':
    case '[':
    case ']':
      return true;
    default:
      return false;
  }
}

} // namespace

std::string encodeQueryComponent(std::string_view value) {
  std::string result;
  result.reserve(value.size());
  for (unsigned char character : value) {
    if (isAxiosUnescaped(character)) {
      result.push_back(static_cast<char>(character));
    } else if (character == ' ') {
      result.push_back('+');
    } else {
      result.push_back('%');
      result.push_back(kHexDigits[character >> 4]);
      result.push_back(kHexDigits[character & 0x0f]);
    }
  }
  return result;
}

PrepareOpenApiRequestResult prepareOpenApiRequest(
    OpenApiRequestInput input,
    const OpenApiRequestSigner& signer) {
  auto baseUrl = normalizeBaseUrl(std::move(input.baseUrl));
  if (!baseUrl.has_value()) {
    return {
        std::nullopt,
        "baseUrl must be an HTTPS origin without credentials, path, query, or fragment",
    };
  }
  if (const auto pathError = validatePath(input.uriPath); !pathError.empty()) {
    return {std::nullopt, pathError};
  }
  if (const auto queryError = validateQuery(input.query); !queryError.empty()) {
    return {std::nullopt, queryError};
  }
  if (input.clientName.empty()) {
    return {std::nullopt, "clientName must not be empty"};
  }
  if (input.clientVersion.empty()) {
    return {std::nullopt, "clientVersion must not be empty"};
  }
  for (const auto& header : input.headers) {
    if (isOwnedHeader(header.name)) {
      return {
          std::nullopt,
          "caller must not provide OpenAPI-owned headers",
      };
    }
  }
  if (input.credential.has_value() &&
      (input.credential->revision == 0 ||
       !validateApiCredential(input.credential->value).empty())) {
    return {
        std::nullopt,
        "credential snapshot must contain a valid credential and positive revision",
    };
  }

  if (!signer) {
    return {std::nullopt, "OpenAPI request signer is required"};
  }

  auto signingResult = signer({
      std::move(input.applicationIdentity),
      http::methodName(input.method),
      input.uriPath,
      makeSigningParameters(input.query),
      std::move(input.nonce),
      input.timestamp,
  });
  if (!signingResult.isSuccess()) {
    return {std::nullopt, "signing failed: " + signingResult.error};
  }

  auto queryString = buildQueryString(input.query);
  std::string url = std::move(*baseUrl);
  url.append(input.uriPath);
  if (!queryString.empty()) {
    url.push_back('?');
    url.append(queryString);
  }

  std::vector<http::Header> headers = std::move(input.headers);
  headers.push_back({"X-Client", std::move(input.clientName)});
  headers.push_back({"X-Version", std::move(input.clientVersion)});
  if (input.credential.has_value()) {
    headers.push_back({"X-API-Key", input.credential->value.apiKey});
    headers.push_back(
        {"X-API-Time", std::to_string(input.credential->value.apiTime)});
  }
  for (auto& header : signingResult.headers) {
    if (!isOwnedHeader(header.name)) {
      return {
          std::nullopt,
          "signer returned a header outside the OpenAPI-owned set",
      };
    }
    headers.push_back({std::move(header.name), std::move(header.value)});
  }

  http::Request request{
      std::move(url),
      input.method,
      http::normalizeRequestHeaders(headers),
      std::move(input.body),
      input.timeoutMs,
      input.maxResponseBytes,
      false,
  };
  if (const auto requestError = http::validateRequest(request);
      !requestError.empty()) {
    return {std::nullopt, "invalid HTTP request: " + requestError};
  }

  return {
      PreparedOpenApiRequest{
          std::move(request),
          std::move(input.credential),
      },
      {},
  };
}

} // namespace rabby::openapi
