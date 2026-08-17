#import <Foundation/Foundation.h>

#include <rabby/http/RabbyHttpTypes.h>

#include <atomic>
#include <chrono>
#include <mutex>
#include <unordered_map>
#include <utility>

namespace rabby::http::apple {
namespace {

using Clock = std::chrono::steady_clock;

std::atomic<std::uint64_t> nextRequestId{1};

std::int64_t elapsedMs(Clock::time_point startedAt) {
  return std::chrono::duration_cast<std::chrono::milliseconds>(
             Clock::now() - startedAt)
      .count();
}

NSString* toNSString(const std::string& value) {
  return [[NSString alloc] initWithBytes:value.data()
                                  length:value.size()
                                encoding:NSUTF8StringEncoding];
}

std::string fromNSString(NSString* value) {
  if (value == nil) {
    return {};
  }
  const auto* bytes = [value UTF8String];
  return bytes == nullptr ? std::string{} : std::string{bytes};
}

ErrorCode mapUrlError(NSError* error) {
  if (![error.domain isEqualToString:NSURLErrorDomain]) {
    return ErrorCode::Transport;
  }
  switch (error.code) {
    case NSURLErrorCancelled:
      return ErrorCode::Cancelled;
    case NSURLErrorTimedOut:
      return ErrorCode::Timeout;
    case NSURLErrorBadURL:
    case NSURLErrorUnsupportedURL:
      return ErrorCode::InvalidRequest;
    default:
      return ErrorCode::Network;
  }
}

struct PendingRequest {
  std::uint64_t requestId;
  Completion completion;
  std::size_t maxResponseBytes;
  Clock::time_point startedAt{Clock::now()};
  std::atomic<bool> completed{false};
  __strong NSURLSessionDataTask* task{nil};
  int statusCode{0};
  std::string finalUrl;
  std::vector<Header> responseHeaders;
  std::vector<std::uint8_t> responseBody;
};

} // namespace
} // namespace rabby::http::apple

@interface RabbyNativeHttpSessionDelegate : NSObject <NSURLSessionDataDelegate>
- (void)addPendingRequest:
            (std::shared_ptr<rabby::http::apple::PendingRequest>)pending;
- (void)cancelRequest:(std::uint64_t)requestId;
@end

@implementation RabbyNativeHttpSessionDelegate {
  std::mutex _pendingMutex;
  std::unordered_map<
      NSUInteger,
      std::shared_ptr<rabby::http::apple::PendingRequest>>
      _pendingByTaskId;
  std::unordered_map<std::uint64_t, NSUInteger> _taskIdByRequestId;
}

- (void)addPendingRequest:
    (std::shared_ptr<rabby::http::apple::PendingRequest>)pending {
  std::lock_guard<std::mutex> lock(_pendingMutex);
  const auto taskId = pending->task.taskIdentifier;
  _pendingByTaskId.emplace(taskId, pending);
  _taskIdByRequestId.emplace(pending->requestId, taskId);
}

- (std::shared_ptr<rabby::http::apple::PendingRequest>)pendingForTask:
    (NSURLSessionTask*)task {
  std::lock_guard<std::mutex> lock(_pendingMutex);
  const auto found = _pendingByTaskId.find(task.taskIdentifier);
  return found == _pendingByTaskId.end() ? nullptr : found->second;
}

- (std::shared_ptr<rabby::http::apple::PendingRequest>)takeTaskId:
    (NSUInteger)taskId {
  std::shared_ptr<rabby::http::apple::PendingRequest> pending;
  {
    std::lock_guard<std::mutex> lock(_pendingMutex);
    const auto found = _pendingByTaskId.find(taskId);
    if (found == _pendingByTaskId.end()) {
      return nullptr;
    }
    pending = found->second;
    _pendingByTaskId.erase(found);
    _taskIdByRequestId.erase(pending->requestId);
  }
  bool expected = false;
  if (!pending->completed.compare_exchange_strong(expected, true)) {
    return nullptr;
  }
  return pending;
}

- (void)finishTaskId:(NSUInteger)taskId result:(rabby::http::Result)result {
  auto pending = [self takeTaskId:taskId];
  if (pending != nullptr && pending->completion) {
    pending->completion(std::move(result));
  }
}

- (void)cancelRequest:(std::uint64_t)requestId {
  NSUInteger taskId = 0;
  {
    std::lock_guard<std::mutex> lock(_pendingMutex);
    const auto found = _taskIdByRequestId.find(requestId);
    if (found == _taskIdByRequestId.end()) {
      return;
    }
    taskId = found->second;
  }

  auto pending = [self takeTaskId:taskId];
  if (pending == nullptr) {
    return;
  }
  [pending->task cancel];
  if (pending->completion) {
    pending->completion(rabby::http::Result::failure(
        {rabby::http::ErrorCode::Cancelled,
         "request cancelled",
         rabby::http::apple::elapsedMs(pending->startedAt)}));
  }
}

- (void)URLSession:(NSURLSession*)session
              task:(NSURLSessionTask*)task
    didReceiveChallenge:(NSURLAuthenticationChallenge*)challenge
      completionHandler:
          (void (^)(NSURLSessionAuthChallengeDisposition disposition,
                    NSURLCredential* credential))completionHandler {
  if ([challenge.protectionSpace.authenticationMethod
          isEqualToString:NSURLAuthenticationMethodServerTrust]) {
    completionHandler(NSURLSessionAuthChallengePerformDefaultHandling, nil);
    return;
  }
  completionHandler(NSURLSessionAuthChallengeRejectProtectionSpace, nil);
}

- (void)URLSession:(NSURLSession*)session
                      task:(NSURLSessionTask*)task
    willPerformHTTPRedirection:(NSHTTPURLResponse*)response
                 newRequest:(NSURLRequest*)request
           completionHandler:
               (void (^)(NSURLRequest* request))completionHandler {
  completionHandler(nil);
}

- (void)URLSession:(NSURLSession*)session
          dataTask:(NSURLSessionDataTask*)dataTask
    didReceiveResponse:(NSURLResponse*)response
     completionHandler:
         (void (^)(NSURLSessionResponseDisposition disposition))completionHandler {
  auto pending = [self pendingForTask:dataTask];
  if (pending == nullptr || pending->completed.load()) {
    completionHandler(NSURLSessionResponseCancel);
    return;
  }
  if (![response isKindOfClass:[NSHTTPURLResponse class]]) {
    [self finishTaskId:dataTask.taskIdentifier
                result:rabby::http::Result::failure(
                           {rabby::http::ErrorCode::Transport,
                            "non-http response",
                            rabby::http::apple::elapsedMs(pending->startedAt)})];
    completionHandler(NSURLSessionResponseCancel);
    return;
  }
  if (response.expectedContentLength > 0 &&
      static_cast<std::uint64_t>(response.expectedContentLength) >
          pending->maxResponseBytes) {
    [self finishTaskId:dataTask.taskIdentifier
                result:rabby::http::Result::failure(
                           {rabby::http::ErrorCode::ResponseTooLarge,
                            "response body exceeds configured limit",
                            rabby::http::apple::elapsedMs(pending->startedAt)})];
    completionHandler(NSURLSessionResponseCancel);
    return;
  }

  auto* httpResponse = static_cast<NSHTTPURLResponse*>(response);
  pending->statusCode = static_cast<int>(httpResponse.statusCode);
  pending->finalUrl = rabby::http::apple::fromNSString(response.URL.absoluteString);
  for (id key in httpResponse.allHeaderFields) {
    pending->responseHeaders.push_back(
        {rabby::http::apple::fromNSString([key description]),
         rabby::http::apple::fromNSString(
             [[httpResponse.allHeaderFields objectForKey:key] description])});
  }
  completionHandler(NSURLSessionResponseAllow);
}

- (void)URLSession:(NSURLSession*)session
          dataTask:(NSURLSessionDataTask*)dataTask
    didReceiveData:(NSData*)data {
  auto pending = [self pendingForTask:dataTask];
  if (pending == nullptr || pending->completed.load()) {
    return;
  }
  if (data.length > pending->maxResponseBytes - pending->responseBody.size()) {
    [self finishTaskId:dataTask.taskIdentifier
                result:rabby::http::Result::failure(
                           {rabby::http::ErrorCode::ResponseTooLarge,
                            "response body exceeds configured limit",
                            rabby::http::apple::elapsedMs(pending->startedAt)})];
    [dataTask cancel];
    return;
  }
  const auto* bytes = static_cast<const std::uint8_t*>(data.bytes);
  pending->responseBody.insert(
      pending->responseBody.end(), bytes, bytes + data.length);
}

- (void)URLSession:(NSURLSession*)session
              task:(NSURLSessionTask*)task
    didCompleteWithError:(NSError*)error {
  auto pending = [self pendingForTask:task];
  if (pending == nullptr || pending->completed.load()) {
    return;
  }
  if (error != nil) {
    const auto code = rabby::http::apple::mapUrlError(error);
    [self finishTaskId:task.taskIdentifier
                result:rabby::http::Result::failure(
                           {code,
                            code == rabby::http::ErrorCode::Cancelled
                                ? "request cancelled"
                                : "url session request failed",
                            rabby::http::apple::elapsedMs(pending->startedAt)})];
    return;
  }

  [self finishTaskId:task.taskIdentifier
              result:rabby::http::Result::success(
                         {pending->statusCode,
                          std::move(pending->finalUrl),
                          std::move(pending->responseHeaders),
                          std::move(pending->responseBody),
                          rabby::http::apple::elapsedMs(pending->startedAt)})];
}

@end

namespace rabby::http::apple {
namespace {

class AppleRequestHandle final : public RequestHandle {
 public:
  AppleRequestHandle(
      std::uint64_t requestId,
      RabbyNativeHttpSessionDelegate* delegate)
      : requestId_(requestId), delegate_(delegate) {}

  std::uint64_t requestId() const override {
    return requestId_;
  }

  void cancel() override {
    bool expected = false;
    if (cancelled_.compare_exchange_strong(expected, true)) {
      [delegate_ cancelRequest:requestId_];
    }
  }

 private:
  std::uint64_t requestId_;
  std::atomic<bool> cancelled_{false};
  __strong RabbyNativeHttpSessionDelegate* delegate_;
};

class AppleClient final : public Client {
 public:
  AppleClient() {
    delegate_ = [[RabbyNativeHttpSessionDelegate alloc] init];
    auto* configuration = [NSURLSessionConfiguration ephemeralSessionConfiguration];
    configuration.URLCache = nil;
    configuration.HTTPCookieStorage = nil;
    configuration.URLCredentialStorage = nil;
    configuration.HTTPShouldSetCookies = NO;
    configuration.requestCachePolicy = NSURLRequestReloadIgnoringLocalCacheData;

    auto* delegateQueue = [[NSOperationQueue alloc] init];
    delegateQueue.maxConcurrentOperationCount = 1;
    delegateQueue.qualityOfService = NSQualityOfServiceUtility;
    session_ = [NSURLSession sessionWithConfiguration:configuration
                                             delegate:delegate_
                                        delegateQueue:delegateQueue];
  }

  std::shared_ptr<RequestHandle> execute(
      Request request,
      Completion completion) override {
    const auto requestId = nextRequestId.fetch_add(1);
    auto handle = std::make_shared<AppleRequestHandle>(requestId, delegate_);

    const auto validationError = validateRequest(request);
    if (!validationError.empty()) {
      completion(Result::failure(
          {ErrorCode::InvalidRequest, validationError, 0}));
      return handle;
    }
    request.headers = normalizeRequestHeaders(request.headers);

    auto* urlString = toNSString(request.url);
    auto* url = urlString == nil ? nil : [NSURL URLWithString:urlString];
    if (url == nil) {
      completion(Result::failure(
          {ErrorCode::InvalidRequest, "url is not valid UTF-8", 0}));
      return handle;
    }

    auto* platformRequest =
        [[NSMutableURLRequest alloc] initWithURL:url
                                    cachePolicy:NSURLRequestReloadIgnoringLocalCacheData
                                timeoutInterval:request.timeoutMs / 1000.0];
    platformRequest.HTTPMethod = [NSString stringWithUTF8String:methodName(request.method)];
    for (const auto& header : request.headers) {
      auto* name = toNSString(header.name);
      auto* value = toNSString(header.value);
      if (name == nil || value == nil) {
        completion(Result::failure(
            {ErrorCode::InvalidRequest, "header is not valid UTF-8", 0}));
        return handle;
      }
      [platformRequest setValue:value forHTTPHeaderField:name];
    }
    if (request.method != Method::Get && request.method != Method::Head) {
      platformRequest.HTTPBody =
          [NSData dataWithBytes:request.body.data() length:request.body.size()];
    }

    auto pending = std::make_shared<PendingRequest>();
    pending->requestId = requestId;
    pending->completion = std::move(completion);
    pending->maxResponseBytes = request.maxResponseBytes;
    pending->task = [session_ dataTaskWithRequest:platformRequest];
    [delegate_ addPendingRequest:pending];
    [pending->task resume];
    return handle;
  }

 private:
  __strong RabbyNativeHttpSessionDelegate* delegate_;
  __strong NSURLSession* session_;
};

} // namespace
} // namespace rabby::http::apple

namespace rabby::http {

std::shared_ptr<Client> makePlatformClient() {
  static auto client = std::make_shared<apple::AppleClient>();
  return client;
}

} // namespace rabby::http
