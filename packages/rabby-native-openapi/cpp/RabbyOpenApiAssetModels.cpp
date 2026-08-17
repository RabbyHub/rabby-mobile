#include <rabby/openapi/RabbyOpenApiAssetModels.h>

#include "third_party/json11/json11.hpp"

#include <algorithm>
#include <cmath>
#include <cctype>
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

} // namespace rabby::openapi
