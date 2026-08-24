#import <Foundation/Foundation.h>

#include <rabby/http/RabbyHttpTypes.h>

#include <cassert>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

using namespace rabby::http;

namespace {

struct AwaitedResult {
  std::mutex mutex;
  std::condition_variable condition;
  std::vector<Result> results;

  Completion completion() {
    return [this](Result result) {
      {
        std::lock_guard<std::mutex> lock(mutex);
        results.push_back(std::move(result));
      }
      condition.notify_all();
    };
  }

  Result await(std::chrono::milliseconds timeout = std::chrono::seconds(3)) {
    std::unique_lock<std::mutex> lock(mutex);
    const auto ready = condition.wait_for(lock, timeout, [this] {
      return !results.empty();
    });
    assert(ready);
    return results.front();
  }

  std::size_t count() {
    std::lock_guard<std::mutex> lock(mutex);
    return results.size();
  }
};

Request requestFor(const std::string& baseUrl, const std::string& path) {
  Request request;
  request.url = baseUrl + path;
  request.allowsInsecureHttp = true;
  return request;
}

} // namespace

int main(int argc, const char* argv[]) {
  @autoreleasepool {
    assert(argc == 2);
    const std::string baseUrl = argv[1];
    auto client = makePlatformClient();

    AwaitedResult getResult;
    client->execute(requestFor(baseUrl, "/ok"), getResult.completion());
    const auto get = getResult.await();
    assert(get.isSuccess());
    assert(get.response()->statusCode == 200);
    assert(std::string(get.response()->body.begin(), get.response()->body.end()) ==
           "native-ok");

    AwaitedResult postResult;
    auto post = requestFor(baseUrl, "/echo");
    post.method = Method::Post;
    post.headers = {{"Content-Type", "application/octet-stream"}};
    post.body = {0, 1, 2, 3, 255};
    client->execute(post, postResult.completion());
    const auto echoed = postResult.await();
    assert(echoed.isSuccess());
    assert(echoed.response()->statusCode == 201);
    assert(echoed.response()->body == post.body);

    AwaitedResult notFoundResult;
    client->execute(
        requestFor(baseUrl, "/missing"), notFoundResult.completion());
    const auto notFound = notFoundResult.await();
    assert(notFound.isSuccess());
    assert(notFound.response()->statusCode == 404);

    AwaitedResult redirectResult;
    client->execute(
        requestFor(baseUrl, "/redirect"), redirectResult.completion());
    const auto redirect = redirectResult.await();
    assert(redirect.isSuccess());
    assert(redirect.response()->statusCode == 302);
    assert(redirect.response()->finalUrl == baseUrl + "/redirect");

    AwaitedResult sizeResult;
    auto sizeRequest = requestFor(baseUrl, "/large");
    sizeRequest.maxResponseBytes = 32;
    client->execute(sizeRequest, sizeResult.completion());
    const auto tooLarge = sizeResult.await();
    assert(!tooLarge.isSuccess());
    assert(tooLarge.error()->code == ErrorCode::ResponseTooLarge);

    AwaitedResult timeoutResult;
    auto timeoutRequest = requestFor(baseUrl, "/slow");
    timeoutRequest.timeoutMs = 50;
    client->execute(timeoutRequest, timeoutResult.completion());
    const auto timedOut = timeoutResult.await();
    assert(!timedOut.isSuccess());
    assert(timedOut.error()->code == ErrorCode::Timeout);

    AwaitedResult cancelResult;
    auto handle = client->execute(
        requestFor(baseUrl, "/slow"), cancelResult.completion());
    handle->cancel();
    handle->cancel();
    const auto cancelled = cancelResult.await();
    assert(!cancelled.isSuccess());
    assert(cancelled.error()->code == ErrorCode::Cancelled);
    std::this_thread::sleep_for(std::chrono::milliseconds(150));
    assert(cancelResult.count() == 1);

    std::cout << "AppleHttpClientTest passed\n";
  }
  return 0;
}
