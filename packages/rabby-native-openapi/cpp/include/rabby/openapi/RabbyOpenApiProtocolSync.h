#pragma once

#include <rabby/openapi/RabbyAddressCachePersistence.h>
#include <rabby/openapi/RabbyOpenApiAssetSyncScheduler.h>
#include <rabby/openapi/RabbyOpenApiClient.h>

#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <string>

namespace rabby::openapi {

enum class ProtocolSyncStage {
  None,
  ProtocolList,
  Persistence,
  Cancelled,
  Superseded,
};

struct ProtocolSyncResult {
  bool success{false};
  std::string address;
  std::uint64_t generation{0};
  ProtocolSyncStage stage{ProtocolSyncStage::None};
  std::size_t sourceItemCount{0};
  std::size_t committedRowCount{0};
  std::int64_t committedAtMs{0};
  std::int64_t durationMs{0};
  std::string error;
};

struct ProtocolSyncStartResult {
  bool accepted{false};
  bool joinedExisting{false};
  std::uint64_t generation{0};
  std::string error;
};

using ProtocolSyncCompletion = std::function<void(ProtocolSyncResult)>;
using ProtocolSyncExecute =
    std::function<std::shared_ptr<http::RequestHandle>(
        OpenApiClientRequest,
        OpenApiClientCompletion)>;
using ProtocolSyncMillisecondsProvider = std::function<std::int64_t()>;

class ProtocolSyncCoordinator {
 public:
  ProtocolSyncCoordinator(
      ProtocolSyncExecute execute,
      std::shared_ptr<AddressCachePersistence> persistence,
      ProtocolSyncMillisecondsProvider millisecondsProvider,
      AssetSyncTaskDispatch processingDispatch = {});
  ~ProtocolSyncCoordinator();

  ProtocolSyncStartResult syncAddress(
      std::string address,
      bool replaceExisting,
      ProtocolSyncCompletion completion);

  void cancelAddress(const std::string& address);
  void cancelAll();
  std::size_t activeSyncCount() const;

 private:
  class Impl;
  std::shared_ptr<Impl> impl_;
};

const char* protocolSyncStageName(ProtocolSyncStage stage);

} // namespace rabby::openapi
