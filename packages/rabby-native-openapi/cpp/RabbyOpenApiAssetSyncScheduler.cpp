#include <rabby/openapi/RabbyOpenApiAssetSyncScheduler.h>

#include <algorithm>
#include <atomic>
#include <charconv>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <cctype>
#include <deque>
#include <mutex>
#include <optional>
#include <string>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>

namespace rabby::openapi {
namespace {

std::size_t priorityIndex(AssetSyncPriority priority) {
  return static_cast<std::size_t>(priority);
}

constexpr std::size_t kPriorityCount = 3;
constexpr auto kDefaultRateLimitCooldown = std::chrono::seconds(60);
constexpr auto kMinimumRateLimitCooldown = std::chrono::seconds(1);
constexpr auto kMaximumRateLimitCooldown = std::chrono::seconds(60);
constexpr auto kRateLimitQuietPeriod = std::chrono::seconds(60);

bool equalsAsciiCaseInsensitive(const std::string& left, const char* right) {
  std::size_t index = 0;
  while (index < left.size() && right[index] != '\0') {
    if (std::tolower(static_cast<unsigned char>(left[index])) !=
        std::tolower(static_cast<unsigned char>(right[index]))) {
      return false;
    }
    ++index;
  }
  return index == left.size() && right[index] == '\0';
}

std::string trimAsciiWhitespace(const std::string& value) {
  auto begin = value.begin();
  while (begin != value.end() &&
         std::isspace(static_cast<unsigned char>(*begin))) {
    ++begin;
  }
  auto end = value.end();
  while (end != begin &&
         std::isspace(static_cast<unsigned char>(*(end - 1)))) {
    --end;
  }
  return std::string(begin, end);
}

std::chrono::milliseconds rateLimitCooldownFor(
    const OpenApiClientResult& result) {
  if (!result.response || result.response->statusCode != 429) {
    return std::chrono::milliseconds::zero();
  }
  for (const auto& header : result.response->headers) {
    if (!equalsAsciiCaseInsensitive(header.name, "retry-after")) {
      continue;
    }
    const auto value = trimAsciiWhitespace(header.value);
    std::int64_t seconds = 0;
    const auto parsed = std::from_chars(
        value.data(), value.data() + value.size(), seconds);
    if (parsed.ec == std::errc{} &&
        parsed.ptr == value.data() + value.size() && seconds >= 0) {
      return std::chrono::duration_cast<std::chrono::milliseconds>(
          std::clamp(
              std::chrono::seconds(seconds),
              kMinimumRateLimitCooldown,
              kMaximumRateLimitCooldown));
    }
    break;
  }
  return std::chrono::duration_cast<std::chrono::milliseconds>(
      kDefaultRateLimitCooldown);
}

OpenApiClientResult makeRateLimitedResult(
    std::chrono::milliseconds remainingCooldown) {
  OpenApiClientResult result;
  http::Response response;
  response.statusCode = 429;
  const auto retryAfterSeconds = std::max<std::int64_t>(
      1, (remainingCooldown.count() + 999) / 1000);
  response.headers.push_back(
      {"Retry-After", std::to_string(retryAfterSeconds)});
  result.response = std::move(response);
  return result;
}

} // namespace

class AssetSyncScheduler::Impl
    : public std::enable_shared_from_this<AssetSyncScheduler::Impl> {
 public:
  Impl(
      std::size_t maximumConcurrentRequests,
      std::size_t processingThreadCount,
      std::size_t maximumQueuedProcessingTasks)
      : maximumConcurrentRequests_(
            std::max<std::size_t>(1, maximumConcurrentRequests)),
        maximumQueuedProcessingTasks_(
            std::max<std::size_t>(1, maximumQueuedProcessingTasks)) {
    const auto threadCount = std::max<std::size_t>(1, processingThreadCount);
    processingThreads_.reserve(threadCount);
    for (std::size_t index = 0; index < threadCount; ++index) {
      processingThreads_.emplace_back([this]() { processTasks(); });
    }
  }

  ~Impl() {
    stop();
  }

  struct NetworkEntry {
    std::uint64_t id{0};
    AssetSyncPriority priority{AssetSyncPriority::Default};
    AssetSyncNetworkExecute execute;
    OpenApiClientRequest request;
    OpenApiClientCompletion completion;
    std::shared_ptr<http::RequestHandle> underlyingHandle;
    std::atomic<bool> cancelled{false};
  };

  class ScheduledRequestHandle final : public http::RequestHandle {
   public:
    ScheduledRequestHandle(
        std::weak_ptr<Impl> owner,
        std::uint64_t requestId)
        : owner_(std::move(owner)), requestId_(requestId) {}

    std::uint64_t requestId() const override {
      return requestId_;
    }

    void cancel() override {
      if (const auto owner = owner_.lock()) {
        owner->cancel(requestId_);
      }
    }

   private:
    std::weak_ptr<Impl> owner_;
    std::uint64_t requestId_{0};
  };

  std::shared_ptr<http::RequestHandle> schedule(
      AssetSyncNetworkExecute execute,
      OpenApiClientRequest request,
      OpenApiClientCompletion completion,
      AssetSyncPriority priority) {
    if (!execute || !completion) {
      return nullptr;
    }

    auto entry = std::make_shared<NetworkEntry>();
    std::optional<std::chrono::milliseconds> remainingCooldown;
    {
      std::lock_guard<std::mutex> lock(networkMutex_);
      if (stopping_.load()) {
        return nullptr;
      }
      entry->id = nextRequestId_++;
      entry->priority = priority;
      entry->execute = std::move(execute);
      entry->request = std::move(request);
      entry->completion = std::move(completion);
      const auto now = std::chrono::steady_clock::now();
      if (now < rateLimitedUntil_) {
        // A high-cardinality sync starts one coordinator per address. Keep the
        // circuit open until that burst has stopped instead of allowing a new
        // request through between two address coordinators.
        rateLimitedUntil_ = std::max(
            rateLimitedUntil_,
            now + kRateLimitQuietPeriod);
        remainingCooldown = std::chrono::duration_cast<std::chrono::milliseconds>(
            rateLimitedUntil_ - now);
      } else {
        queuedRequests_[priorityIndex(priority)].push_back(entry);
        queuedById_[entry->id] = entry;
      }
    }
    auto handle = std::make_shared<ScheduledRequestHandle>(
        weak_from_this(), entry->id);
    if (remainingCooldown) {
      dispatchCompletion(
          std::move(entry->completion),
          makeRateLimitedResult(*remainingCooldown),
          priority);
      return handle;
    }
    pumpNetwork();
    return handle;
  }

  void postProcessing(AssetSyncTask task, AssetSyncPriority priority) {
    if (!task) {
      return;
    }
    std::unique_lock<std::mutex> lock(processingMutex_);
    processingSpaceCondition_.wait(lock, [this]() {
      return stopping_.load() || queuedProcessingTaskCountLocked() <
          maximumQueuedProcessingTasks_;
    });
    if (stopping_.load()) {
      return;
    }
    processingTasks_[priorityIndex(priority)].push_back(std::move(task));
    lock.unlock();
    processingCondition_.notify_one();
  }

  std::size_t activeRequestCount() const {
    std::lock_guard<std::mutex> lock(networkMutex_);
    return activeRequests_.size();
  }

  std::size_t queuedRequestCount() const {
    std::lock_guard<std::mutex> lock(networkMutex_);
    return queuedRequestCountLocked();
  }

  std::size_t queuedProcessingTaskCount() const {
    std::lock_guard<std::mutex> lock(processingMutex_);
    return queuedProcessingTaskCountLocked();
  }

 private:
  void stop() {
    bool expected = false;
    if (!stopping_.compare_exchange_strong(expected, true)) {
      return;
    }
    std::vector<std::shared_ptr<http::RequestHandle>> handles;
    {
      std::lock_guard<std::mutex> lock(networkMutex_);
      for (auto& [_, entry] : activeRequests_) {
        entry->cancelled = true;
        if (entry->underlyingHandle) {
          handles.push_back(std::move(entry->underlyingHandle));
        }
      }
      activeRequests_.clear();
      queuedById_.clear();
      for (auto& queue : queuedRequests_) {
        queue.clear();
      }
    }
    for (const auto& handle : handles) {
      handle->cancel();
    }
    processingCondition_.notify_all();
    processingSpaceCondition_.notify_all();
    for (auto& thread : processingThreads_) {
      if (thread.joinable()) {
        thread.join();
      }
    }
  }

  std::shared_ptr<NetworkEntry> takeNextNetworkRequestLocked() {
    for (std::size_t index = kPriorityCount; index > 0; --index) {
      auto& queue = queuedRequests_[index - 1];
      while (!queue.empty()) {
        auto entry = std::move(queue.front());
        queue.pop_front();
        queuedById_.erase(entry->id);
        if (!entry->cancelled) {
          return entry;
        }
      }
    }
    return nullptr;
  }

  void pumpNetwork() {
    std::vector<std::shared_ptr<NetworkEntry>> dispatches;
    {
      std::lock_guard<std::mutex> lock(networkMutex_);
      while (!stopping_.load() &&
             activeRequests_.size() < maximumConcurrentRequests_) {
        auto entry = takeNextNetworkRequestLocked();
        if (!entry) {
          break;
        }
        activeRequests_[entry->id] = entry;
        dispatches.push_back(std::move(entry));
      }
    }
    for (auto& entry : dispatches) {
      startNetworkRequest(entry);
    }
  }

  void startNetworkRequest(const std::shared_ptr<NetworkEntry>& entry) {
    auto weakSelf = weak_from_this();
    auto handle = entry->execute(
        std::move(entry->request),
        [weakSelf, requestId = entry->id](OpenApiClientResult result) mutable {
          if (const auto self = weakSelf.lock()) {
            self->completeNetworkRequest(requestId, std::move(result));
          }
        });

    bool missingHandle = false;
    bool cancelHandle = false;
    {
      std::lock_guard<std::mutex> lock(networkMutex_);
      const auto active = activeRequests_.find(entry->id);
      if (active == activeRequests_.end()) {
        cancelHandle = static_cast<bool>(handle);
      } else if (handle) {
        entry->underlyingHandle = std::move(handle);
      } else {
        missingHandle = true;
      }
    }
    if (cancelHandle) {
      handle->cancel();
    }
    if (missingHandle) {
      OpenApiClientResult result;
      result.failureStage = OpenApiClientFailureStage::Transport;
      result.error = "native request did not start";
      completeNetworkRequest(entry->id, std::move(result));
    }
  }

  void completeNetworkRequest(
      std::uint64_t requestId,
      OpenApiClientResult result) {
    OpenApiClientCompletion completion;
    std::vector<std::pair<OpenApiClientCompletion, AssetSyncPriority>>
        rateLimitedCompletions;
    auto remainingCooldown = std::chrono::milliseconds::zero();
    {
      std::lock_guard<std::mutex> lock(networkMutex_);
      const auto active = activeRequests_.find(requestId);
      if (active == activeRequests_.end()) {
        return;
      }
      completion = std::move(active->second->completion);
      activeRequests_.erase(active);

      const auto cooldown = rateLimitCooldownFor(result);
      if (cooldown > std::chrono::milliseconds::zero()) {
        const auto now = std::chrono::steady_clock::now();
        rateLimitedUntil_ = std::max(rateLimitedUntil_, now + cooldown);
        remainingCooldown = std::chrono::duration_cast<std::chrono::milliseconds>(
            rateLimitedUntil_ - now);
        for (auto& queue : queuedRequests_) {
          while (!queue.empty()) {
            auto entry = std::move(queue.front());
            queue.pop_front();
            queuedById_.erase(entry->id);
            if (!entry->cancelled && entry->completion) {
              rateLimitedCompletions.emplace_back(
                  std::move(entry->completion), entry->priority);
            }
          }
        }
      }
    }
    if (completion) {
      completion(std::move(result));
    }
    for (auto& [queuedCompletion, priority] : rateLimitedCompletions) {
      dispatchCompletion(
          std::move(queuedCompletion),
          makeRateLimitedResult(remainingCooldown),
          priority);
    }
    pumpNetwork();
  }

  void dispatchCompletion(
      OpenApiClientCompletion completion,
      OpenApiClientResult result,
      AssetSyncPriority priority) {
    if (!completion) {
      return;
    }
    postProcessing(
        [completion = std::move(completion),
         result = std::move(result)]() mutable {
          completion(std::move(result));
        },
        priority);
  }

  void cancel(std::uint64_t requestId) {
    std::shared_ptr<http::RequestHandle> handle;
    bool releasedActiveSlot = false;
    {
      std::lock_guard<std::mutex> lock(networkMutex_);
      const auto queued = queuedById_.find(requestId);
      if (queued != queuedById_.end()) {
        queued->second->cancelled = true;
        queuedById_.erase(queued);
        return;
      }
      const auto active = activeRequests_.find(requestId);
      if (active == activeRequests_.end()) {
        return;
      }
      active->second->cancelled = true;
      handle = std::move(active->second->underlyingHandle);
      activeRequests_.erase(active);
      releasedActiveSlot = true;
    }
    if (handle) {
      handle->cancel();
    }
    if (releasedActiveSlot) {
      pumpNetwork();
    }
  }

  void processTasks() {
    while (true) {
      AssetSyncTask task;
      {
        std::unique_lock<std::mutex> lock(processingMutex_);
        processingCondition_.wait(lock, [this]() {
          return stopping_.load() || queuedProcessingTaskCountLocked() > 0;
        });
        if (stopping_.load() && queuedProcessingTaskCountLocked() == 0) {
          return;
        }
        for (std::size_t index = kPriorityCount; index > 0; --index) {
          auto& queue = processingTasks_[index - 1];
          if (!queue.empty()) {
            task = std::move(queue.front());
            queue.pop_front();
            break;
          }
        }
      }
      processingSpaceCondition_.notify_one();
      if (task) {
        task();
      }
    }
  }

  std::size_t queuedRequestCountLocked() const {
    std::size_t count = 0;
    for (const auto& queue : queuedRequests_) {
      count += static_cast<std::size_t>(std::count_if(
          queue.begin(), queue.end(), [](const auto& entry) {
            return !entry->cancelled.load();
          }));
    }
    return count;
  }

  std::size_t queuedProcessingTaskCountLocked() const {
    std::size_t count = 0;
    for (const auto& queue : processingTasks_) {
      count += queue.size();
    }
    return count;
  }

  const std::size_t maximumConcurrentRequests_{12};
  const std::size_t maximumQueuedProcessingTasks_{64};
  mutable std::mutex networkMutex_;
  mutable std::mutex processingMutex_;
  std::condition_variable processingCondition_;
  std::condition_variable processingSpaceCondition_;
  std::atomic<bool> stopping_{false};
  std::uint64_t nextRequestId_{1};
  std::deque<std::shared_ptr<NetworkEntry>> queuedRequests_[kPriorityCount];
  std::unordered_map<std::uint64_t, std::shared_ptr<NetworkEntry>> queuedById_;
  std::unordered_map<std::uint64_t, std::shared_ptr<NetworkEntry>> activeRequests_;
  std::chrono::steady_clock::time_point rateLimitedUntil_{};
  std::deque<AssetSyncTask> processingTasks_[kPriorityCount];
  std::vector<std::thread> processingThreads_;
};

AssetSyncScheduler::AssetSyncScheduler(
    std::size_t maximumConcurrentRequests,
    std::size_t processingThreadCount,
    std::size_t maximumQueuedProcessingTasks)
    : impl_(std::make_shared<Impl>(
          maximumConcurrentRequests,
          processingThreadCount,
          maximumQueuedProcessingTasks)) {}

AssetSyncScheduler::~AssetSyncScheduler() = default;

std::shared_ptr<http::RequestHandle> AssetSyncScheduler::execute(
    AssetSyncNetworkExecute execute,
    OpenApiClientRequest request,
    OpenApiClientCompletion completion,
    AssetSyncPriority priority) {
  return impl_->schedule(
      std::move(execute),
      std::move(request),
      std::move(completion),
      priority);
}

void AssetSyncScheduler::postProcessing(
    AssetSyncTask task,
    AssetSyncPriority priority) {
  impl_->postProcessing(std::move(task), priority);
}

std::size_t AssetSyncScheduler::activeRequestCount() const {
  return impl_->activeRequestCount();
}

std::size_t AssetSyncScheduler::queuedRequestCount() const {
  return impl_->queuedRequestCount();
}

std::size_t AssetSyncScheduler::queuedProcessingTaskCount() const {
  return impl_->queuedProcessingTaskCount();
}

} // namespace rabby::openapi
