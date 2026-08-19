#pragma once

#include <rabby/openapi/RabbyOpenApiClient.h>

#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>

namespace rabby::openapi {

enum class AssetSyncPriority {
  Background,
  Default,
  UserInitiated,
};

using AssetSyncNetworkExecute =
    std::function<std::shared_ptr<http::RequestHandle>(
        OpenApiClientRequest,
        OpenApiClientCompletion)>;
using AssetSyncTask = std::function<void()>;
using AssetSyncTaskDispatch = std::function<void(AssetSyncTask)>;

struct AssetSyncSchedulerDiagnostics {
  std::uint64_t realRequestDispatchCount{0};
  std::uint64_t completedRequestCount{0};
  std::uint64_t http429ResponseCount{0};
  std::uint64_t queuedSynthetic429Count{0};
  std::uint64_t cooldownSynthetic429Count{0};
  std::size_t activeRequestCount{0};
  std::size_t queuedRequestCount{0};
  std::size_t queuedProcessingTaskCount{0};
  std::int64_t cooldownRemainingMs{0};
};

class AssetSyncScheduler {
 public:
  AssetSyncScheduler(
      std::size_t maximumConcurrentRequests = 12,
      std::size_t processingThreadCount = 2,
      std::size_t maximumQueuedProcessingTasks = 64);
  ~AssetSyncScheduler();

  std::shared_ptr<http::RequestHandle> execute(
      AssetSyncNetworkExecute execute,
      OpenApiClientRequest request,
      OpenApiClientCompletion completion,
      AssetSyncPriority priority = AssetSyncPriority::Default);

  void postProcessing(
      AssetSyncTask task,
      AssetSyncPriority priority = AssetSyncPriority::Default);

  std::size_t activeRequestCount() const;
  std::size_t queuedRequestCount() const;
  std::size_t queuedProcessingTaskCount() const;
  AssetSyncSchedulerDiagnostics diagnostics() const;

 private:
  class Impl;
  std::shared_ptr<Impl> impl_;
};

} // namespace rabby::openapi
