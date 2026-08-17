#pragma once

#include <rabby/openapi/RabbyAddressCachePersistence.h>
#include <rabby/openapi/RabbyOpenApiClient.h>

#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <string>

namespace rabby::openapi {

enum class NftSyncStage {
  None,
  NftList,
  CollectionList,
  Persistence,
  Cancelled,
  Superseded,
};

struct NftSyncResult {
  bool success{false};
  std::string address;
  std::uint64_t generation{0};
  NftSyncStage stage{NftSyncStage::None};
  std::size_t sourceItemCount{0};
  std::size_t sourceCollectionCount{0};
  std::size_t filteredItemCount{0};
  std::size_t committedRowCount{0};
  std::int64_t committedAtMs{0};
  std::int64_t durationMs{0};
  std::string error;
};

struct NftSyncStartResult {
  bool accepted{false};
  bool joinedExisting{false};
  std::uint64_t generation{0};
  std::string error;
};

using NftSyncCompletion = std::function<void(NftSyncResult)>;
using NftSyncExecute = std::function<std::shared_ptr<http::RequestHandle>(
    OpenApiClientRequest,
    OpenApiClientCompletion)>;
using NftSyncMillisecondsProvider = std::function<std::int64_t()>;

class NftSyncCoordinator {
 public:
  NftSyncCoordinator(
      NftSyncExecute execute,
      std::shared_ptr<AddressCachePersistence> persistence,
      NftSyncMillisecondsProvider millisecondsProvider);
  ~NftSyncCoordinator();

  NftSyncStartResult syncAddress(
      std::string address,
      bool replaceExisting,
      NftSyncCompletion completion);

  void cancelAddress(const std::string& address);
  void cancelAll();
  std::size_t activeSyncCount() const;

 private:
  class Impl;
  std::shared_ptr<Impl> impl_;
};

const char* nftSyncStageName(NftSyncStage stage);

} // namespace rabby::openapi
