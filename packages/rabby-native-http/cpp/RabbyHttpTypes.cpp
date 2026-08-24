#include <rabby/http/RabbyHttpTypes.h>

#include <algorithm>
#include <cctype>
#include <limits>
#include <unordered_map>

namespace rabby::http {
namespace {

constexpr std::int64_t kMaxTimeoutMs = 5 * 60 * 1000;
constexpr std::size_t kMaxRequestBytes = 64U * 1024U * 1024U;
constexpr std::size_t kMaxResponseBytes = 256U * 1024U * 1024U;

std::string asciiLower(std::string value) {
  std::transform(value.begin(), value.end(), value.begin(), [](unsigned char character) {
    return static_cast<char>(std::tolower(character));
  });
  return value;
}

bool isHeaderNameCharacter(unsigned char character) {
  if (std::isalnum(character)) {
    return true;
  }
  switch (character) {
    case '!':
    case '#':
    case '$':
    case '%':
    case '&':
    case '\'':
    case '*':
    case '+':
    case '-':
    case '.':
    case '^':
    case '_':
    case '`':
    case '|':
    case '~':
      return true;
    default:
      return false;
  }
}

bool startsWith(const std::string& value, const char* prefix) {
  return value.rfind(prefix, 0) == 0;
}

} // namespace

Result Result::success(Response response) {
  return Result{std::move(response)};
}

Result Result::failure(Error error) {
  return Result{std::move(error)};
}

bool Result::isSuccess() const {
  return std::holds_alternative<Response>(value);
}

const Response* Result::response() const {
  return std::get_if<Response>(&value);
}

const Error* Result::error() const {
  return std::get_if<Error>(&value);
}

const char* methodName(Method method) {
  switch (method) {
    case Method::Get:
      return "GET";
    case Method::Head:
      return "HEAD";
    case Method::Post:
      return "POST";
    case Method::Put:
      return "PUT";
    case Method::Patch:
      return "PATCH";
    case Method::Delete:
      return "DELETE";
  }
  return "GET";
}

const char* errorCodeName(ErrorCode code) {
  switch (code) {
    case ErrorCode::Cancelled:
      return "cancelled";
    case ErrorCode::Timeout:
      return "timeout";
    case ErrorCode::Network:
      return "network";
    case ErrorCode::InvalidRequest:
      return "invalid_request";
    case ErrorCode::ResponseTooLarge:
      return "response_too_large";
    case ErrorCode::Transport:
      return "transport";
  }
  return "transport";
}

bool parseMethod(const std::string& value, Method& method) {
  if (value == "GET") {
    method = Method::Get;
  } else if (value == "HEAD") {
    method = Method::Head;
  } else if (value == "POST") {
    method = Method::Post;
  } else if (value == "PUT") {
    method = Method::Put;
  } else if (value == "PATCH") {
    method = Method::Patch;
  } else if (value == "DELETE") {
    method = Method::Delete;
  } else {
    return false;
  }
  return true;
}

std::string validateRequest(const Request& request) {
  if (request.url.empty()) {
    return "url must not be empty";
  }
  if (!startsWith(request.url, "https://") &&
      !(request.allowsInsecureHttp && startsWith(request.url, "http://"))) {
    return "url must use https unless insecure http is explicitly allowed";
  }
  if (request.timeoutMs <= 0 || request.timeoutMs > kMaxTimeoutMs) {
    return "timeoutMs must be between 1 and 300000";
  }
  if (request.body.size() > kMaxRequestBytes) {
    return "request body exceeds 64 MiB";
  }
  if ((request.method == Method::Get || request.method == Method::Head) &&
      !request.body.empty()) {
    return "GET and HEAD requests cannot contain a body";
  }
  if (request.maxResponseBytes == 0 ||
      request.maxResponseBytes > kMaxResponseBytes) {
    return "maxResponseBytes must be between 1 and 256 MiB";
  }

  for (const auto& header : request.headers) {
    if (header.name.empty()) {
      return "header name must not be empty";
    }
    for (unsigned char character : header.name) {
      if (!isHeaderNameCharacter(character)) {
        return "header name contains an invalid character";
      }
    }
    if (header.value.find('\r') != std::string::npos ||
        header.value.find('\n') != std::string::npos) {
      return "header value contains a line break";
    }
  }

  return {};
}

std::vector<Header> normalizeRequestHeaders(const std::vector<Header>& headers) {
  std::vector<Header> normalized;
  normalized.reserve(headers.size());
  std::unordered_map<std::string, std::size_t> indexes;

  for (const auto& header : headers) {
    const auto key = asciiLower(header.name);
    const auto found = indexes.find(key);
    if (found == indexes.end()) {
      indexes.emplace(key, normalized.size());
      normalized.push_back(header);
      continue;
    }
    auto& current = normalized[found->second].value;
    if (!current.empty() && !header.value.empty()) {
      current += ", ";
    }
    current += header.value;
  }

  return normalized;
}

} // namespace rabby::http
