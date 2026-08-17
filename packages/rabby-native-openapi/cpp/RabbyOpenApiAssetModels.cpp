#include <rabby/openapi/RabbyOpenApiAssetModels.h>

#include "third_party/json11/json11.hpp"

#include <algorithm>
#include <cmath>
#include <cctype>
#include <map>
#include <sstream>
#include <utility>

namespace rabby::openapi {
namespace {

using json11::Json;

std::string lowerAscii(std::string value) {
  std::transform(
      value.begin(),
      value.end(),
      value.begin(),
      [](unsigned char character) {
        return static_cast<char>(std::tolower(character));
      });
  return value;
}

bool readString(
    const Json& object,
    const std::string& field,
    std::string& output,
    std::string& error,
    bool required = false) {
  const auto& value = object[field];
  if (value.is_null()) {
    if (required) {
      error = "missing required string field: " + field;
      return false;
    }
    output.clear();
    return true;
  }
  if (!value.is_string()) {
    error = "invalid string field: " + field;
    return false;
  }
  output = value.string_value();
  if (required && output.empty()) {
    error = "empty required string field: " + field;
    return false;
  }
  return true;
}

bool readNumber(
    const Json& object,
    const std::string& field,
    double& output,
    std::string& error,
    double defaultValue = 0) {
  const auto& value = object[field];
  if (value.is_null()) {
    output = defaultValue;
    return true;
  }
  if (!value.is_number() || !std::isfinite(value.number_value())) {
    error = "invalid finite number field: " + field;
    return false;
  }
  output = value.number_value();
  return true;
}

bool readNullableNumber(
    const Json& object,
    const std::string& field,
    std::optional<double>& output,
    std::string& error) {
  const auto& value = object[field];
  if (value.is_null()) {
    output.reset();
    return true;
  }
  if (!value.is_number() || !std::isfinite(value.number_value())) {
    error = "invalid nullable number field: " + field;
    return false;
  }
  output = value.number_value();
  return true;
}

bool readBool(
    const Json& object,
    const std::string& field,
    bool& output,
    std::string& error,
    bool defaultValue = false) {
  const auto& value = object[field];
  if (value.is_null()) {
    output = defaultValue;
    return true;
  }
  if (!value.is_bool()) {
    error = "invalid boolean field: " + field;
    return false;
  }
  output = value.bool_value();
  return true;
}

bool readNullableBool(
    const Json& object,
    const std::string& field,
    std::optional<bool>& output,
    std::string& error) {
  const auto& value = object[field];
  if (value.is_null()) {
    output.reset();
    return true;
  }
  if (!value.is_bool()) {
    error = "invalid nullable boolean field: " + field;
    return false;
  }
  output = value.bool_value();
  return true;
}

bool readScalarText(
    const Json& object,
    const std::string& field,
    std::string& output,
    std::string& error) {
  const auto& value = object[field];
  if (value.is_null()) {
    output.clear();
    return true;
  }
  if (value.is_string()) {
    output = value.string_value();
    return true;
  }
  if (value.is_number() || value.is_bool()) {
    output = value.dump();
    return true;
  }
  error = "invalid scalar field: " + field;
  return false;
}

bool readNullableJsonObject(
    const Json& object,
    const std::string& field,
    std::optional<std::string>& output,
    std::string& error) {
  const auto& value = object[field];
  if (value.is_null()) {
    output.reset();
    return true;
  }
  if (!value.is_object()) {
    error = "invalid object field: " + field;
    return false;
  }
  output = value.dump();
  return true;
}

bool readStringArrayJson(
    const Json& object,
    const std::string& field,
    std::string& output,
    std::string& error) {
  const auto& value = object[field];
  if (value.is_null()) {
    output = "[]";
    return true;
  }
  if (!value.is_array()) {
    error = "invalid array field: " + field;
    return false;
  }
  for (const auto& item : value.array_items()) {
    if (!item.is_string()) {
      error = "invalid string array item: " + field;
      return false;
    }
  }
  output = value.dump();
  return true;
}

bool parseRootArray(
    const std::string& responseBody,
    Json::array& output,
    std::string& error) {
  std::string parseError;
  const auto root = Json::parse(responseBody, parseError);
  if (!parseError.empty()) {
    error = "invalid JSON response: " + parseError;
    return false;
  }
  if (!root.is_array()) {
    error = "response root must be an array";
    return false;
  }
  output = root.array_items();
  return true;
}

bool parseToken(
    const std::string& ownerAddress,
    const Json& input,
    NativeTokenRecord& token,
    std::string& error) {
  if (!input.is_object()) {
    error = "token item must be an object";
    return false;
  }

  token.ownerAddress = lowerAscii(ownerAddress);
  if (token.ownerAddress.empty()) {
    error = "owner address must not be empty";
    return false;
  }

  if (!readString(input, "content_type", token.contentType, error) ||
      !readString(input, "content", token.content, error) ||
      !readScalarText(input, "inner_id", token.innerId, error) ||
      !readNumber(input, "amount", token.amount, error) ||
      !readString(input, "chain", token.chain, error, true) ||
      !readNumber(input, "decimals", token.decimals, error, 18) ||
      !readString(input, "display_symbol", token.displaySymbol, error) ||
      !readString(input, "id", token.id, error, true) ||
      !readNullableBool(input, "is_core", token.isCore, error) ||
      !readNullableBool(input, "is_verified", token.isVerified, error) ||
      !readBool(input, "is_wallet", token.isWallet, error) ||
      !readBool(input, "is_scam", token.isScam, error) ||
      !readBool(input, "is_infinity", token.isInfinity, error) ||
      !readBool(input, "is_suspicious", token.isSuspicious, error) ||
      !readString(input, "logo_url", token.logoUrl, error) ||
      !readString(input, "name", token.name, error) ||
      !readString(input, "optimized_symbol", token.optimizedSymbol, error) ||
      !readNumber(input, "price", token.price, error) ||
      !readString(input, "symbol", token.symbol, error) ||
      !readNumber(input, "time_at", token.timeAt, error) ||
      !readNumber(input, "credit_score", token.creditScore, error) ||
      !readString(input, "protocol_id", token.protocolId, error) ||
      !readNullableJsonObject(input, "launchpad", token.launchpadJson, error) ||
      !readNullableJsonObject(input, "asset", token.assetJson, error) ||
      !readString(input, "market_status", token.marketStatus, error) ||
      !readScalarText(input, "raw_amount", token.rawAmount, error) ||
      !readString(input, "raw_amount_hex_str", token.rawAmountHex, error) ||
      !readNullableNumber(
          input, "price_24h_change", token.price24hChange, error) ||
      !readBool(input, "low_credit_score", token.lowCreditScore, error) ||
      !readNumber(input, "fdv", token.fdv, error) ||
      !readStringArrayJson(input, "cex_ids", token.cexIdsJson, error)) {
    return false;
  }

  const auto& identity = input["identity"];
  if (!identity.is_null()) {
    if (!identity.is_object()) {
      error = "invalid object field: identity";
      return false;
    }
    double identityFdv = 0;
    if (!readNumber(identity, "fdv", identityFdv, error)) {
      error = "identity." + error;
      return false;
    }
    if (identityFdv != 0) {
      token.fdv = identityFdv;
    }
  }

  token.usdValue = token.price * token.amount;
  if (!std::isfinite(token.usdValue)) {
    error = "token usd_value is not finite";
    return false;
  }
  token.dbId = buildTokenDbId(
      token.ownerAddress, token.id, token.chain, token.innerId);
  token.projectionResourceId = buildTokenProjectionResourceId(
      token.ownerAddress, token.chain, token.id);
  return true;
}

bool parseProtocolPortfolioSummary(
    const Json& portfolio,
    double& netWorth,
    double& positiveRealUsdValue,
    std::string& error) {
  if (!portfolio.is_object()) {
    error = "portfolio item must be an object";
    return false;
  }

  double tokenNetWorth = 0;
  double realUsdValue = 0;
  const auto& assetTokens = portfolio["asset_token_list"];
  if (!assetTokens.is_null()) {
    if (!assetTokens.is_array()) {
      error = "invalid array field: asset_token_list";
      return false;
    }
    for (std::size_t index = 0;
         index < assetTokens.array_items().size();
         ++index) {
      const auto& token = assetTokens.array_items()[index];
      if (!token.is_object()) {
        error = "asset token must be an object at index " +
            std::to_string(index);
        return false;
      }
      double price = 0;
      double amount = 0;
      if (!readNumber(token, "price", price, error) ||
          !readNumber(token, "amount", amount, error)) {
        error = "asset token at index " + std::to_string(index) +
            ": " + error;
        return false;
      }
      const auto signedValue = price * amount;
      if (!std::isfinite(signedValue)) {
        error = "asset token usd value is not finite";
        return false;
      }
      tokenNetWorth += std::abs(signedValue);
      realUsdValue += signedValue;
    }
  }

  const auto& stats = portfolio["stats"];
  if (stats.is_null()) {
    netWorth = tokenNetWorth;
  } else {
    if (!stats.is_object()) {
      error = "invalid object field: stats";
      return false;
    }
    if (!readNumber(stats, "net_usd_value", netWorth, error)) {
      error = "stats." + error;
      return false;
    }
  }
  if (!std::isfinite(tokenNetWorth) || !std::isfinite(realUsdValue) ||
      !std::isfinite(netWorth)) {
    error = "portfolio summary is not finite";
    return false;
  }
  positiveRealUsdValue = std::max(realUsdValue, 0.0);
  return true;
}

bool parseProtocol(
    const std::string& ownerAddress,
    const Json& input,
    std::size_t sourceIndex,
    NativeProtocolRecord& protocol,
    std::string& error) {
  if (!input.is_object()) {
    error = "protocol item must be an object";
    return false;
  }

  protocol.ownerAddress = lowerAscii(ownerAddress);
  if (protocol.ownerAddress.empty()) {
    error = "owner address must not be empty";
    return false;
  }
  if (!readString(input, "id", protocol.id, error, true) ||
      !readString(input, "chain", protocol.chain, error, true) ||
      !readString(input, "name", protocol.name, error, true) ||
      !readString(input, "site_url", protocol.siteUrl, error) ||
      !readString(input, "logo_url", protocol.logoUrl, error) ||
      !readBool(
          input,
          "has_supported_portfolio",
          protocol.hasSupportedPortfolio,
          error) ||
      !readNumber(input, "tvl", protocol.tvl, error)) {
    return false;
  }

  const auto& portfolios = input["portfolio_item_list"];
  if (!portfolios.is_array()) {
    error = "invalid array field: portfolio_item_list";
    return false;
  }
  protocol.portfolioItemListJson = portfolios.dump();
  protocol.sourceIndex = sourceIndex;
  for (std::size_t index = 0;
       index < portfolios.array_items().size();
       ++index) {
    double portfolioNetWorth = 0;
    double portfolioPositiveRealUsdValue = 0;
    if (!parseProtocolPortfolioSummary(
            portfolios.array_items()[index],
            portfolioNetWorth,
            portfolioPositiveRealUsdValue,
            error)) {
      error = "portfolio item at index " + std::to_string(index) +
          ": " + error;
      return false;
    }
    protocol.netWorth += portfolioNetWorth;
    protocol.positiveRealUsdValue += portfolioPositiveRealUsdValue;
  }
  if (!std::isfinite(protocol.netWorth) ||
      !std::isfinite(protocol.positiveRealUsdValue)) {
    error = "protocol summary is not finite";
    return false;
  }
  protocol.dbId =
      buildProtocolDbId(protocol.ownerAddress, protocol.chain, protocol.id);
  protocol.projectionResourceId = buildProtocolProjectionResourceId(
      protocol.ownerAddress, protocol.chain, protocol.id);
  return true;
}

struct ParsedCollection {
  Json value;
  std::string id;
  std::string chain;
  std::optional<bool> isVerified;
  double creditScore{0};
  bool isCore{false};
  bool isHidden{false};
};

bool parseCollection(
    const Json& input,
    ParsedCollection& collection,
    std::string& error) {
  if (!input.is_object()) {
    error = "collection item must be an object";
    return false;
  }
  collection.value = input;
  return readString(input, "id", collection.id, error, true) &&
      readString(input, "chain", collection.chain, error, true) &&
      readNullableBool(input, "is_verified", collection.isVerified, error) &&
      readNumber(input, "credit_score", collection.creditScore, error) &&
      readBool(input, "is_core", collection.isCore, error) &&
      readBool(input, "is_hidden", collection.isHidden, error);
}

bool parseNft(
    const std::string& ownerAddress,
    const Json& input,
    const ParsedCollection* matchedCollection,
    std::size_t sourceIndex,
    NativeNftRecord& nft,
    std::string& error) {
  if (!input.is_object()) {
    error = "NFT item must be an object";
    return false;
  }

  nft.ownerAddress = lowerAscii(ownerAddress);
  if (nft.ownerAddress.empty()) {
    error = "owner address must not be empty";
    return false;
  }
  if (!readString(input, "chain", nft.chain, error, true) ||
      !readString(input, "id", nft.id, error, true) ||
      !readString(input, "contract_id", nft.contractId, error) ||
      !readString(input, "inner_id", nft.innerId, error) ||
      !readString(input, "token_id", nft.tokenId, error) ||
      !readString(input, "name", nft.name, error) ||
      !readString(input, "contract_name", nft.contractName, error) ||
      !readString(input, "collection_name", nft.collectionName, error) ||
      !readString(input, "description", nft.description, error) ||
      !readNumber(input, "usd_price", nft.usdPrice, error) ||
      !readNumber(input, "amount", nft.amount, error) ||
      !readString(input, "collection_id", nft.collectionId, error) ||
      !readString(
          input, "content_type", nft.contentType, error, false) ||
      !readString(input, "content", nft.content, error) ||
      !readString(input, "detail_url", nft.detailUrl, error) ||
      !readScalarText(input, "total_supply", nft.totalSupply, error) ||
      !readBool(input, "is_erc1155", nft.isErc1155, error) ||
      !readBool(input, "is_erc721", nft.isErc721, error) ||
      !readBool(input, "is_core", nft.isCore, error) ||
      !readString(input, "thumbnail_url", nft.thumbnailUrl, error)) {
    return false;
  }
  if (nft.contentType.empty()) {
    nft.contentType = "image_url";
  }

  std::optional<std::string> payTokenJson;
  if (!readNullableJsonObject(input, "pay_token", payTokenJson, error)) {
    return false;
  }
  nft.payTokenJson = payTokenJson.value_or("{}");

  Json::object collectionObject;
  if (matchedCollection != nullptr) {
    collectionObject = matchedCollection->value.object_items();
    nft.collectionCreditScore = matchedCollection->creditScore;
    nft.collectionIsCore = matchedCollection->isCore;
    nft.collectionIsHidden = matchedCollection->isHidden;
  }
  collectionObject["nft_list"] = Json::array{};
  nft.collectionJson = Json(std::move(collectionObject)).dump();
  nft.sourceIndex = sourceIndex;
  nft.dbId = buildNftDbId(
      nft.ownerAddress, nft.chain, nft.id, nft.tokenId);
  nft.projectionResourceId = buildNftProjectionResourceId(
      nft.ownerAddress,
      nft.chain,
      nft.collectionId,
      nft.id,
      nft.innerId);
  nft.collectionResourceId = nft.collectionId.empty()
      ? std::string{}
      : buildNftCollectionResourceId(
            nft.ownerAddress,
            nft.chain,
            matchedCollection == nullptr ? std::string{}
                                         : matchedCollection->id);
  return true;
}

} // namespace

UsedChainListParseResult parseUsedChainListResponse(
    const std::string& responseBody) {
  UsedChainListParseResult result;
  Json::array items;
  if (!parseRootArray(responseBody, items, result.error)) {
    return result;
  }

  result.chainIds.reserve(items.size());
  for (std::size_t index = 0; index < items.size(); ++index) {
    const auto& item = items[index];
    if (!item.is_object()) {
      result.error = "used-chain item must be an object at index " +
          std::to_string(index);
      result.chainIds.clear();
      return result;
    }
    std::string chainId;
    if (!readString(item, "id", chainId, result.error, true)) {
      result.error = "used-chain item at index " + std::to_string(index) +
          ": " + result.error;
      result.chainIds.clear();
      return result;
    }
    result.chainIds.push_back(std::move(chainId));
  }
  return result;
}

TokenListParseResult parseTokenListResponse(
    const std::string& ownerAddress,
    const std::string& responseBody) {
  TokenListParseResult result;
  Json::array items;
  if (!parseRootArray(responseBody, items, result.error)) {
    return result;
  }

  result.sourceItemCount = items.size();
  result.tokens.reserve(items.size());
  for (std::size_t index = 0; index < items.size(); ++index) {
    NativeTokenRecord token;
    if (!parseToken(ownerAddress, items[index], token, result.error)) {
      result.error = "token item at index " + std::to_string(index) +
          ": " + result.error;
      result.tokens.clear();
      result.filteredItemCount = 0;
      return result;
    }

    if (token.isVerified == std::optional<bool>{false} ||
        token.isSuspicious) {
      ++result.filteredItemCount;
      continue;
    }
    result.tokens.push_back(std::move(token));
  }
  return result;
}

ProtocolListParseResult parseProtocolListResponse(
    const std::string& ownerAddress,
    const std::string& responseBody) {
  ProtocolListParseResult result;
  Json::array items;
  if (!parseRootArray(responseBody, items, result.error)) {
    return result;
  }

  result.sourceItemCount = items.size();
  result.protocols.reserve(items.size());
  for (std::size_t index = 0; index < items.size(); ++index) {
    NativeProtocolRecord protocol;
    if (!parseProtocol(
            ownerAddress, items[index], index, protocol, result.error)) {
      result.error = "protocol item at index " + std::to_string(index) +
          ": " + result.error;
      result.protocols.clear();
      return result;
    }
    result.protocols.push_back(std::move(protocol));
  }
  return result;
}

NftListParseResult parseNftListResponse(
    const std::string& ownerAddress,
    const std::string& nftResponseBody,
    const std::string& collectionResponseBody) {
  NftListParseResult result;
  Json::array collectionItems;
  if (!parseRootArray(
          collectionResponseBody, collectionItems, result.error)) {
    result.error = "collection response: " + result.error;
    return result;
  }
  result.sourceCollectionCount = collectionItems.size();

  std::map<std::string, ParsedCollection> collections;
  for (std::size_t index = 0; index < collectionItems.size(); ++index) {
    ParsedCollection collection;
    if (!parseCollection(collectionItems[index], collection, result.error)) {
      result.error = "collection item at index " + std::to_string(index) +
          ": " + result.error;
      return result;
    }
    collections[collection.chain + ':' + collection.id] =
        std::move(collection);
  }

  Json::array nftItems;
  if (!parseRootArray(nftResponseBody, nftItems, result.error)) {
    result.error = "NFT response: " + result.error;
    return result;
  }
  result.sourceItemCount = nftItems.size();
  result.nfts.reserve(nftItems.size());
  for (std::size_t index = 0; index < nftItems.size(); ++index) {
    const auto& input = nftItems[index];
    if (!input.is_object()) {
      result.error = "NFT item must be an object at index " +
          std::to_string(index);
      result.nfts.clear();
      return result;
    }
    std::string collectionId;
    std::string chain;
    if (!readString(input, "collection_id", collectionId, result.error) ||
        !readString(input, "chain", chain, result.error, true)) {
      result.error = "NFT item at index " + std::to_string(index) +
          ": " + result.error;
      result.nfts.clear();
      return result;
    }
    const auto collectionIterator = collections.find(collectionId);
    const auto* collection = collectionIterator == collections.end()
        ? nullptr
        : &collectionIterator->second;
    if (collection != nullptr &&
        collection->isVerified == std::optional<bool>{false}) {
      ++result.filteredItemCount;
      continue;
    }

    NativeNftRecord nft;
    if (!parseNft(
            ownerAddress, input, collection, index, nft, result.error)) {
      result.error = "NFT item at index " + std::to_string(index) +
          ": " + result.error;
      result.nfts.clear();
      result.filteredItemCount = 0;
      return result;
    }
    result.nfts.push_back(std::move(nft));
  }
  return result;
}

std::string buildTokenDbId(
    const std::string& ownerAddress,
    const std::string& tokenId,
    const std::string& chain,
    const std::string& innerId) {
  std::ostringstream output;
  bool hasPart = false;
  for (const auto* part : {&ownerAddress, &tokenId, &chain, &innerId}) {
    if (part->empty()) {
      continue;
    }
    if (hasPart) {
      output << '-';
    }
    output << *part;
    hasPart = true;
  }
  return output.str();
}

std::string buildTokenProjectionResourceId(
    const std::string& ownerAddress,
    const std::string& chain,
    const std::string& tokenId) {
  return lowerAscii(ownerAddress) + ':' + lowerAscii(chain) + ':' +
      lowerAscii(tokenId);
}

std::string buildProtocolDbId(
    const std::string& ownerAddress,
    const std::string& chain,
    const std::string& protocolId) {
  return ownerAddress + '-' + chain + '-' + protocolId;
}

std::string buildProtocolProjectionResourceId(
    const std::string& ownerAddress,
    const std::string& chain,
    const std::string& protocolId) {
  return lowerAscii(ownerAddress) + ':' + lowerAscii(chain) + ':' +
      lowerAscii(protocolId);
}

std::string buildNftDbId(
    const std::string& ownerAddress,
    const std::string& chain,
    const std::string& nftId,
    const std::string& tokenId) {
  std::ostringstream output;
  bool hasPart = false;
  for (const auto* part : {&ownerAddress, &chain, &nftId, &tokenId}) {
    if (part->empty()) {
      continue;
    }
    if (hasPart) {
      output << '-';
    }
    output << *part;
    hasPart = true;
  }
  return output.str();
}

std::string buildNftProjectionResourceId(
    const std::string& ownerAddress,
    const std::string& chain,
    const std::string& collectionId,
    const std::string& nftId,
    const std::string& innerId) {
  return lowerAscii(ownerAddress) + ':' + lowerAscii(chain) + ':' +
      lowerAscii(collectionId) + ':' + lowerAscii(nftId) + ':' +
      lowerAscii(innerId);
}

std::string buildNftCollectionResourceId(
    const std::string& ownerAddress,
    const std::string& chain,
    const std::string& collectionId) {
  return lowerAscii(ownerAddress) + "::" + lowerAscii(chain) + "::" +
      lowerAscii(collectionId);
}

} // namespace rabby::openapi
