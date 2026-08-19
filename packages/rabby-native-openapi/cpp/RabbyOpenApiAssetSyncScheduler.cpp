#include <rabby/openapi/RabbyOpenApiAssetSyncScheduler.h>

#include <algorithm>
#include <atomic>
#include <condition_variable>
#include <cstdint>
#include <deque>
#include <mutex>
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
      queuedRequests_[priorityIndex(priority)].push_back(entry);
      queuedById_[entry->id] = entry;
    }
    auto handle = std::make_shared<ScheduledRequestHandle>(
        weak_from_this(), entry->id);
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
    {
      std::lock_guard<std::mutex> lock(networkMutex_);
      const auto active = activeRequests_.find(requestId);
      if (active == activeRequests_.end()) {
        return;
      }
      completion = std::move(active->second->completion);
      activeRequests_.erase(active);
    }
    if (completion) {
      completion(std::move(result));
    }
    pumpNetwork();
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
