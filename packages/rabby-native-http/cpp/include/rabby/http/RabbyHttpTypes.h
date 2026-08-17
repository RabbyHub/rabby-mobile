#pragma once

#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <string>
#include <variant>
#include <vector>

namespace rabby::http {

enum class Method {
  Get,
  Head,
  Post,
  Put,
  Patch,
  Delete,
};

struct Header {
  std::string name;
  std::string value;
};

struct Request {
  std::string url;
  Method method{Method::Get};
  std::vector<Header> headers;
  std::vector<std::uint8_t> body;
  std::int64_t timeoutMs{30000};
  std::size_t maxResponseBytes{64U * 1024U * 1024U};
  bool allowsInsecureHttp{false};
};

struct Response {
  int statusCode{0};
  std::string finalUrl;
  std::vector<Header> headers;
  std::vector<std::uint8_t> body;
  std::int64_t durationMs{0};
};

enum class ErrorCode {
  Cancelled,
  Timeout,
  Network,
  InvalidRequest,
  ResponseTooLarge,
  Transport,
};

struct Error {
  ErrorCode code{ErrorCode::Transport};
  std::string message;
  std::int64_t durationMs{0};
};

using ResultValue = std::variant<Response, Error>;

struct Result {
  ResultValue value;

  static Result success(Response response);
  static Result failure(Error error);

  bool isSuccess() const;
  const Response* response() const;
  const Error* error() const;
};

using Completion = std::function<void(Result)>;

class RequestHandle {
 public:
  virtual ~RequestHandle() = default;
  virtual std::uint64_t requestId() const = 0;
  virtual void cancel() = 0;
};

class Client {
 public:
  virtual ~Client() = default;
  virtual std::shared_ptr<RequestHandle> execute(
      Request request,
      Completion completion) = 0;
};

// Implemented by exactly one platform adapter in each native target.
std::shared_ptr<Client> makePlatformClient();

const char* methodName(Method method);
const char* errorCodeName(ErrorCode code);
bool parseMethod(const std::string& value, Method& method);

// Returns an empty string when valid. Validation is shared by both platform
// adapters so malformed requests fail identically before transport dispatch.
std::string validateRequest(const Request& request);

// Request header names are case-insensitive. Repeated names are joined in
// insertion order so OkHttp and NSURLSession receive the same header set.
std::vector<Header> normalizeRequestHeaders(const std::vector<Header>& headers);

} // namespace rabby::http
