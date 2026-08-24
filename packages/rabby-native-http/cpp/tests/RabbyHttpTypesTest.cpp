#include <rabby/http/RabbyHttpTypes.h>

#include <cassert>
#include <iostream>

using namespace rabby::http;

int main() {
  Request request;
  request.url = "https://api.example.test/v1/assets";
  request.headers = {
      {"Accept", "application/json"},
      {"accept", "application/problem+json"},
  };

  assert(validateRequest(request).empty());
  const auto headers = normalizeRequestHeaders(request.headers);
  assert(headers.size() == 1);
  assert(headers[0].name == "Accept");
  assert(headers[0].value == "application/json, application/problem+json");

  request.url = "http://api.example.test/v1/assets";
  assert(!validateRequest(request).empty());
  request.allowsInsecureHttp = true;
  assert(validateRequest(request).empty());

  request.method = Method::Get;
  request.body = {1};
  assert(!validateRequest(request).empty());
  request.method = Method::Post;
  assert(validateRequest(request).empty());

  request.headers = {{"X-Bad", "value\r\ninjected"}};
  assert(!validateRequest(request).empty());

  Method method;
  assert(parseMethod("PATCH", method));
  assert(method == Method::Patch);
  assert(!parseMethod("patch", method));

  const auto success = Result::success(Response{});
  assert(success.isSuccess());
  assert(success.response() != nullptr);
  assert(success.error() == nullptr);

  const auto failure = Result::failure(Error{ErrorCode::Timeout, "timeout", 5});
  assert(!failure.isSuccess());
  assert(failure.error()->code == ErrorCode::Timeout);
  assert(std::string(errorCodeName(failure.error()->code)) == "timeout");

  std::cout << "RabbyHttpTypesTest passed\n";
  return 0;
}
