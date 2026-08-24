#include <rabby/openapi/RabbyTokenSnapshotCodec.h>

#include <cstring>
#include <limits>
#include <optional>
#include <utility>

namespace rabby::openapi {
namespace {

constexpr std::uint8_t kMagic[] = {'R', 'T', 'S', '1'};
constexpr std::uint32_t kMaximumRows = 1000000;

class Encoder {
 public:
  void byte(std::uint8_t value) {
    output_.push_back(value);
  }

  void uint32(std::uint32_t value) {
    for (int shift = 0; shift < 32; shift += 8) {
      byte(static_cast<std::uint8_t>((value >> shift) & 0xffU));
    }
  }

  void uint64(std::uint64_t value) {
    for (int shift = 0; shift < 64; shift += 8) {
      byte(static_cast<std::uint8_t>((value >> shift) & 0xffU));
    }
  }

  void number(double value) {
    static_assert(sizeof(value) == sizeof(std::uint64_t));
    std::uint64_t bits = 0;
    std::memcpy(&bits, &value, sizeof(value));
    uint64(bits);
  }

  void boolean(bool value) {
    byte(value ? 1U : 0U);
  }

  void nullableBoolean(const std::optional<bool>& value) {
    byte(value.has_value() ? (value.value() ? 1U : 0U) : 2U);
  }

  void nullableNumber(const std::optional<double>& value) {
    boolean(value.has_value());
    if (value.has_value()) {
      number(*value);
    }
  }

  void string(const std::string& value) {
    if (value.size() > std::numeric_limits<std::uint32_t>::max()) {
      uint32(0);
      return;
    }
    uint32(static_cast<std::uint32_t>(value.size()));
    output_.insert(output_.end(), value.begin(), value.end());
  }

  void nullableString(const std::optional<std::string>& value) {
    boolean(value.has_value());
    if (value.has_value()) {
      string(*value);
    }
  }

  std::vector<std::uint8_t> take() {
    return std::move(output_);
  }

 private:
  std::vector<std::uint8_t> output_;
};

class Decoder {
 public:
  explicit Decoder(const std::vector<std::uint8_t>& input) : input_(input) {}

  bool byte(std::uint8_t& value) {
    if (position_ >= input_.size()) {
      return false;
    }
    value = input_[position_++];
    return true;
  }

  bool uint32(std::uint32_t& value) {
    value = 0;
    for (int shift = 0; shift < 32; shift += 8) {
      std::uint8_t part = 0;
      if (!byte(part)) {
        return false;
      }
      value |= static_cast<std::uint32_t>(part) << shift;
    }
    return true;
  }

  bool uint64(std::uint64_t& value) {
    value = 0;
    for (int shift = 0; shift < 64; shift += 8) {
      std::uint8_t part = 0;
      if (!byte(part)) {
        return false;
      }
      value |= static_cast<std::uint64_t>(part) << shift;
    }
    return true;
  }

  bool number(double& value) {
    std::uint64_t bits = 0;
    if (!uint64(bits)) {
      return false;
    }
    std::memcpy(&value, &bits, sizeof(value));
    return true;
  }

  bool boolean(bool& value) {
    std::uint8_t encoded = 0;
    if (!byte(encoded) || encoded > 1U) {
      return false;
    }
    value = encoded == 1U;
    return true;
  }

  bool nullableBoolean(std::optional<bool>& value) {
    std::uint8_t encoded = 0;
    if (!byte(encoded) || encoded > 2U) {
      return false;
    }
    if (encoded == 2U) {
      value.reset();
    } else {
      value = encoded == 1U;
    }
    return true;
  }

  bool nullableNumber(std::optional<double>& value) {
    bool hasValue = false;
    if (!boolean(hasValue)) {
      return false;
    }
    if (!hasValue) {
      value.reset();
      return true;
    }
    double decoded = 0;
    if (!number(decoded)) {
      return false;
    }
    value = decoded;
    return true;
  }

  bool string(std::string& value) {
    std::uint32_t size = 0;
    if (!uint32(size) || size > input_.size() - position_) {
      return false;
    }
    value.assign(
        reinterpret_cast<const char*>(input_.data() + position_), size);
    position_ += size;
    return true;
  }

  bool nullableString(std::optional<std::string>& value) {
    bool hasValue = false;
    if (!boolean(hasValue)) {
      return false;
    }
    if (!hasValue) {
      value.reset();
      return true;
    }
    std::string decoded;
    if (!string(decoded)) {
      return false;
    }
    value = std::move(decoded);
    return true;
  }

  bool finished() const {
    return position_ == input_.size();
  }

 private:
  const std::vector<std::uint8_t>& input_;
  std::size_t position_{0};
};

void encodeToken(Encoder& output, const NativeTokenRecord& token) {
  output.string(token.dbId);
  output.string(token.ownerAddress);
  output.string(token.projectionResourceId);
  output.string(token.contentType);
  output.string(token.content);
  output.string(token.innerId);
  output.number(token.amount);
  output.string(token.chain);
  output.number(token.decimals);
  output.string(token.displaySymbol);
  output.string(token.id);
  output.nullableBoolean(token.isCore);
  output.nullableBoolean(token.isVerified);
  output.boolean(token.isWallet);
  output.boolean(token.isScam);
  output.boolean(token.isInfinity);
  output.boolean(token.isSuspicious);
  output.string(token.logoUrl);
  output.string(token.name);
  output.string(token.optimizedSymbol);
  output.number(token.price);
  output.string(token.symbol);
  output.number(token.timeAt);
  output.number(token.usdValue);
  output.number(token.creditScore);
  output.string(token.protocolId);
  output.nullableString(token.launchpadJson);
  output.nullableString(token.assetJson);
  output.string(token.marketStatus);
  output.string(token.rawAmount);
  output.string(token.rawAmountHex);
  output.nullableNumber(token.price24hChange);
  output.boolean(token.lowCreditScore);
  output.number(token.fdv);
  output.string(token.value24hChange);
  output.string(token.cexIdsJson);
}

bool decodeToken(Decoder& input, NativeTokenRecord& token) {
  return input.string(token.dbId) &&
      input.string(token.ownerAddress) &&
      input.string(token.projectionResourceId) &&
      input.string(token.contentType) && input.string(token.content) &&
      input.string(token.innerId) && input.number(token.amount) &&
      input.string(token.chain) && input.number(token.decimals) &&
      input.string(token.displaySymbol) && input.string(token.id) &&
      input.nullableBoolean(token.isCore) &&
      input.nullableBoolean(token.isVerified) &&
      input.boolean(token.isWallet) && input.boolean(token.isScam) &&
      input.boolean(token.isInfinity) && input.boolean(token.isSuspicious) &&
      input.string(token.logoUrl) && input.string(token.name) &&
      input.string(token.optimizedSymbol) && input.number(token.price) &&
      input.string(token.symbol) && input.number(token.timeAt) &&
      input.number(token.usdValue) && input.number(token.creditScore) &&
      input.string(token.protocolId) &&
      input.nullableString(token.launchpadJson) &&
      input.nullableString(token.assetJson) &&
      input.string(token.marketStatus) && input.string(token.rawAmount) &&
      input.string(token.rawAmountHex) &&
      input.nullableNumber(token.price24hChange) &&
      input.boolean(token.lowCreditScore) && input.number(token.fdv) &&
      input.string(token.value24hChange) && input.string(token.cexIdsJson);
}

} // namespace

std::vector<std::uint8_t> encodeTokenSnapshot(
    const std::vector<NativeTokenRecord>& tokens) {
  Encoder output;
  for (const auto value : kMagic) {
    output.byte(value);
  }
  output.uint32(static_cast<std::uint32_t>(tokens.size()));
  for (const auto& token : tokens) {
    encodeToken(output, token);
  }
  return output.take();
}

TokenSnapshotDecodeResult decodeTokenSnapshot(
    const std::vector<std::uint8_t>& payload) {
  TokenSnapshotDecodeResult result;
  Decoder input(payload);
  for (const auto expected : kMagic) {
    std::uint8_t actual = 0;
    if (!input.byte(actual) || actual != expected) {
      result.error = "invalid token snapshot magic";
      return result;
    }
  }

  std::uint32_t rowCount = 0;
  if (!input.uint32(rowCount) || rowCount > kMaximumRows) {
    result.error = "invalid token snapshot row count";
    return result;
  }
  result.tokens.reserve(rowCount);
  for (std::uint32_t index = 0; index < rowCount; ++index) {
    NativeTokenRecord token;
    if (!decodeToken(input, token)) {
      result.error = "invalid token snapshot row at index " +
          std::to_string(index);
      result.tokens.clear();
      return result;
    }
    result.tokens.push_back(std::move(token));
  }
  if (!input.finished()) {
    result.error = "token snapshot has trailing bytes";
    result.tokens.clear();
  }
  return result;
}

} // namespace rabby::openapi
