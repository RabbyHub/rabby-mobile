#pragma once

#include <cstddef>
#include <optional>
#include <string>
#include <vector>

namespace rabby::openapi {

struct UsedChainListParseResult {
  std::vector<std::string> chainIds;
  std::string error;

  bool isSuccess() const {
    return error.empty();
  }
};

struct NativeTokenRecord {
  std::string dbId;
  std::string ownerAddress;
  std::string projectionResourceId;

  std::string contentType;
  std::string content;
  std::string innerId;
  double amount{0};
  std::string chain;
  double decimals{18};
  std::string displaySymbol;
  std::string id;
  std::optional<bool> isCore;
  std::optional<bool> isVerified;
  bool isWallet{false};
  bool isScam{false};
  bool isInfinity{false};
  bool isSuspicious{false};
  std::string logoUrl;
  std::string name;
  std::string optimizedSymbol;
  double price{0};
  std::string symbol;
  double timeAt{0};
  double usdValue{0};
  double creditScore{0};
  std::string protocolId;
  std::optional<std::string> launchpadJson;
  std::optional<std::string> assetJson;
  std::string marketStatus;
  std::string rawAmount;
  std::string rawAmountHex;
  std::optional<double> price24hChange;
  bool lowCreditScore{false};
  double fdv{0};
  std::string value24hChange{"1"};
  std::string cexIdsJson{"[]"};
};

struct TokenListParseResult {
  std::vector<NativeTokenRecord> tokens;
  std::size_t sourceItemCount{0};
  std::size_t filteredItemCount{0};
  std::string error;

  bool isSuccess() const {
    return error.empty();
  }
};

UsedChainListParseResult parseUsedChainListResponse(
    const std::string& responseBody);

TokenListParseResult parseTokenListResponse(
    const std::string& ownerAddress,
    const std::string& responseBody);

std::string buildTokenDbId(
    const std::string& ownerAddress,
    const std::string& tokenId,
    const std::string& chain,
    const std::string& innerId);

std::string buildTokenProjectionResourceId(
    const std::string& ownerAddress,
    const std::string& chain,
    const std::string& tokenId);

} // namespace rabby::openapi
