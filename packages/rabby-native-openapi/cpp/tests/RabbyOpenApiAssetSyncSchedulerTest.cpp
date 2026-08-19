#include <rabby/openapi/RabbyOpenApiAssetSyncScheduler.h>

#include <cassert>
#include <condition_variable>
#include <cstdint>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <utility>
#include <vector>

namespace {

using rabby::openapi::AssetSyncPriority;
using rabby::openapi::AssetSyncScheduler;
using rabby::openapi::OpenApiClientCompletion;
using rabby::openapi::OpenApiClientRequest;
using rabby::openapi::OpenApiClientResult;

class FakeRequestHandle final : public rabby::http::RequestHandle {
 public:
  explicit FakeRequestHandle(std::uint64_t requestId)
      : requestId_(requestId) {}

  std::uint64_t requestId() const override {
    return requestId_;
  }

  void cancel() override {
    cancelled = true;
  }

  bool cancelled{false};

 private:
  std::uint64_t requestId_{0};
};

class ManualNetwork {
 public:
  struct Pending {
    OpenApiClientRequest request;
    OpenApiClientCompletion completion;
    std::shared_ptr<FakeRequestHandle> handle;
  };

  std::shared_ptr<rabby::http::RequestHandle> execute(
      OpenApiClientRequest request,
      OpenApiClientCompletion completion) {
    auto handle = std::make_shared<FakeRequestHandle>(nextRequestId_++);
    pending.push_back(
        {std::move(request), std::move(completion), handle});
    return handle;
  }

  void complete(std::size_t index) {
    auto completion = std::move(pending.at(index).completion);
    completion(OpenApiClientResult{});
  }

  std::vector<Pending> pending;

 private:
  std::uint64_t nextRequestId_{1};
};

OpenApiClientRequest makeRequest(std::string path) {
  OpenApiClientRequest request;
  request.uriPath = std::move(path);
  return request;
}

void testNetworkConcurrencyAndPriority() {
  AssetSyncScheduler scheduler(1, 1, 8);
  ManualNetwork network;
  std::vector<std::string> completions;
  auto execute = [&network](
                     OpenApiClientRequest request,
                     OpenApiClientCompletion completion) {
    return network.execute(std::move(request), std::move(completion));
  };

  scheduler.execute(
      execute,
      makeRequest("/active"),
      [&completions](OpenApiClientResult) {
        completions.push_back("active");
      });
  scheduler.execute(
      execute,
      makeRequest("/background"),
      [&completions](OpenApiClientResult) {
        completions.push_back("background");
      },
      AssetSyncPriority::Background);
  scheduler.execute(
      execute,
      makeRequest("/user"),
      [&completions](OpenApiClientResult) {
        completions.push_back("user");
      },
      AssetSyncPriority::UserInitiated);

  assert(network.pending.size() == 1);
  assert(scheduler.activeRequestCount() == 1);
  assert(scheduler.queuedRequestCount() == 2);

  network.complete(0);
  assert(network.pending.size() == 2);
  assert(network.pending[1].request.uriPath == "/user");
  assert(completions == std::vector<std::string>{"active"});

  network.complete(1);
  assert(network.pending.size() == 3);
  assert(network.pending[2].request.uriPath == "/background");
  assert(
      completions == std::vector<std::string>({"active", "user"}));

  network.complete(2);
  assert(
      completions ==
      std::vector<std::string>({"active", "user", "background"}));
}

void testQueuedCancellation() {
  AssetSyncScheduler scheduler(1, 1, 8);
  ManualNetwork network;
  auto execute = [&network](
                     OpenApiClientRequest request,
                     OpenApiClientCompletion completion) {
    return network.execute(std::move(request), std::move(completion));
  };

  scheduler.execute(execute, makeRequest("/active"), [](OpenApiClientResult) {});
  auto queued = scheduler.execute(
      execute, makeRequest("/cancelled"), [](OpenApiClientResult) {});
  assert(queued != nullptr);
  assert(scheduler.queuedRequestCount() == 1);

  queued->cancel();
  assert(scheduler.queuedRequestCount() == 0);
  network.complete(0);
  assert(network.pending.size() == 1);
}

void testProcessingRunsOffCallerThread() {
  AssetSyncScheduler scheduler(1, 1, 8);
  const auto callerThread = std::this_thread::get_id();
  std::mutex mutex;
  std::condition_variable condition;
  std::thread::id taskThread;
  bool completed = false;

  scheduler.postProcessing([&]() {
    {
      std::lock_guard<std::mutex> lock(mutex);
      taskThread = std::this_thread::get_id();
      completed = true;
    }
    condition.notify_one();
  });

  std::unique_lock<std::mutex> lock(mutex);
  condition.wait(lock, [&]() { return completed; });
  assert(taskThread != callerThread);
}

} // namespace

int main() {
  testNetworkConcurrencyAndPriority();
  testQueuedCancellation();
  testProcessingRunsOffCallerThread();
  return 0;
}
