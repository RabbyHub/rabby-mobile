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

struct NativeProtocolRecord {
  std::string dbId;
  std::string ownerAddress;
  std::string projectionResourceId;

  std::string id;
  std::string chain;
  std::string name;
  std::string siteUrl;
  std::string logoUrl;
  bool hasSupportedPortfolio{false};
  double tvl{0};
  std::string portfolioItemListJson{"[]"};
  double netWorth{0};
  double positiveRealUsdValue{0};
  std::size_t sourceIndex{0};
};

struct ProtocolListParseResult {
  std::vector<NativeProtocolRecord> protocols;
  std::size_t sourceItemCount{0};
  std::string error;

  bool isSuccess() const {
    return error.empty();
  }
};

struct NativeNftRecord {
  std::string dbId;
  std::string ownerAddress;
  std::string projectionResourceId;
  std::string collectionResourceId;

  std::string chain;
  std::string id;
  std::string contractId;
  std::string innerId;
  std::string tokenId;
  std::string name;
  std::string contractName;
  std::string collectionName;
  std::string description;
  double usdPrice{0};
  double amount{0};
  std::string collectionId;
  std::string contentType{"image_url"};
  std::string content;
  std::string detailUrl;
  std::string totalSupply;
  bool isErc1155{false};
  bool isErc721{false};
  bool isCore{false};
  std::string thumbnailUrl;
  std::string payTokenJson{"{}"};
  std::string collectionJson{"{\"nft_list\": []}"};
  double collectionCreditScore{0};
  bool collectionIsCore{false};
  bool collectionIsHidden{false};
  std::size_t sourceIndex{0};
};

struct NftListParseResult {
  std::vector<NativeNftRecord> nfts;
  std::size_t sourceItemCount{0};
  std::size_t sourceCollectionCount{0};
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

ProtocolListParseResult parseProtocolListResponse(
    const std::string& ownerAddress,
    const std::string& responseBody);

NftListParseResult parseNftListResponse(
    const std::string& ownerAddress,
    const std::string& nftResponseBody,
    const std::string& collectionResponseBody);

std::string buildTokenDbId(
    const std::string& ownerAddress,
    const std::string& tokenId,
    const std::string& chain,
    const std::string& innerId);

std::string buildTokenProjectionResourceId(
    const std::string& ownerAddress,
    const std::string& chain,
    const std::string& tokenId);

std::string buildProtocolDbId(
    const std::string& ownerAddress,
    const std::string& chain,
    const std::string& protocolId);

std::string buildProtocolProjectionResourceId(
    const std::string& ownerAddress,
    const std::string& chain,
    const std::string& protocolId);

std::string buildNftDbId(
    const std::string& ownerAddress,
    const std::string& chain,
    const std::string& nftId,
    const std::string& tokenId);

std::string buildNftProjectionResourceId(
    const std::string& ownerAddress,
    const std::string& chain,
    const std::string& collectionId,
    const std::string& nftId,
    const std::string& innerId);

std::string buildNftCollectionResourceId(
    const std::string& ownerAddress,
    const std::string& chain,
    const std::string& collectionId);

} // namespace rabby::openapi
