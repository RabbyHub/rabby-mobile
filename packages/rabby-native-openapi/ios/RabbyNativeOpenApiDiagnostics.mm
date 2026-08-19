#import <Foundation/Foundation.h>

#include <rabby/http/RabbyHttpTypes.h>
#include <rabby/openapi/RabbyNativeOpenApiDiagnostics.h>
#include <rabby/openapi/RabbyOpenApiAssetSyncScheduler.h>
#include <rabby/openapi/RabbyOpenApiClient.h>
#include <rabby/openapi/RabbyOpenApiDiagnostic.h>
#include <rabby/openapi/RabbyOpenApiNftSync.h>
#include <rabby/openapi/RabbyOpenApiPlatform.h>
#include <rabby/openapi/RabbyOpenApiProtocolSync.h>
#include <rabby/openapi/RabbyOpenApiTokenSync.h>
#include <rabby/openapi/RabbyTokenCachePersistence.h>

#include <chrono>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace rabby::openapi::apple {
namespace {

constexpr const char* kOpenApiBaseUrl = "https://app-api.rabby.io";
NSString* const kCredentialDirectory = @"RabbyNativeOpenApi";
NSString* const kCredentialFile = @"credential.plist";
NSString* const kApiKey = @"api_key";
NSString* const kApiTime = @"api_time";

std::string fromNSString(NSString* value) {
  if (value == nil) {
    return {};
  }
  const auto* bytes = value.UTF8String;
  return bytes == nullptr ? std::string{} : std::string{bytes};
}

NSArray<NSString*>* toNSStringArray(const std::vector<std::string>& values) {
  auto* result = [NSMutableArray arrayWithCapacity:values.size()];
  for (const auto& value : values) {
    auto* stringValue = [NSString stringWithUTF8String:value.c_str()];
    if (stringValue != nil) {
      [result addObject:stringValue];
    }
  }
  return result;
}

NSURL* credentialFileUrl(NSError** error) {
  auto* fileManager = [NSFileManager defaultManager];
  auto* applicationSupport = [fileManager URLForDirectory:NSApplicationSupportDirectory
                                                  inDomain:NSUserDomainMask
                                         appropriateForURL:nil
                                                    create:YES
                                                     error:error];
  if (applicationSupport == nil) {
    return nil;
  }
  auto* directory = [applicationSupport URLByAppendingPathComponent:kCredentialDirectory
                                                        isDirectory:YES];
  if (![fileManager createDirectoryAtURL:directory
             withIntermediateDirectories:YES
                              attributes:nil
                                   error:error]) {
    return nil;
  }
  return [directory URLByAppendingPathComponent:kCredentialFile
                                    isDirectory:NO];
}

class AppleApiCredentialPersistence final : public ApiCredentialPersistence {
 public:
  LoadApiCredentialResult load() override {
    @synchronized([RabbyNativeOpenApiDiagnostics class]) {
      NSError* pathError = nil;
      auto* fileUrl = credentialFileUrl(&pathError);
      if (fileUrl == nil) {
        return {std::nullopt, "Apple credential directory is unavailable"};
      }
      if (![[NSFileManager defaultManager] fileExistsAtPath:fileUrl.path]) {
        return {std::nullopt, {}};
      }

      NSError* readError = nil;
      auto* data = [NSData dataWithContentsOfURL:fileUrl
                                         options:0
                                           error:&readError];
      if (data == nil) {
        return {std::nullopt, "Apple credential load failed"};
      }
      NSError* decodeError = nil;
      auto* decoded = [NSPropertyListSerialization
          propertyListWithData:data
                       options:NSPropertyListImmutable
                        format:nil
                         error:&decodeError];
      if (![decoded isKindOfClass:[NSDictionary class]]) {
        return {std::nullopt, "Apple credential storage is malformed"};
      }
      auto* dictionary = static_cast<NSDictionary*>(decoded);
      auto* apiKey = dictionary[kApiKey];
      auto* apiTime = dictionary[kApiTime];
      if (![apiKey isKindOfClass:[NSString class]] ||
          ![apiTime isKindOfClass:[NSNumber class]]) {
        return {std::nullopt, "Apple credential storage is malformed"};
      }
      return {
          ApiCredential{
              fromNSString(static_cast<NSString*>(apiKey)),
              static_cast<NSNumber*>(apiTime).longLongValue,
          },
          {},
      };
    }
  }

  std::string save(const ApiCredential& credential) override {
    @synchronized([RabbyNativeOpenApiDiagnostics class]) {
      NSError* pathError = nil;
      auto* fileUrl = credentialFileUrl(&pathError);
      if (fileUrl == nil) {
        return "Apple credential directory is unavailable";
      }

      auto* apiKey = [[NSString alloc] initWithBytes:credential.apiKey.data()
                                             length:credential.apiKey.size()
                                           encoding:NSUTF8StringEncoding];
      if (apiKey == nil) {
        return "Apple credential value is not valid UTF-8";
      }
      auto* dictionary = @{
        kApiKey : apiKey,
        kApiTime : @(credential.apiTime),
      };
      NSError* encodeError = nil;
      auto* data = [NSPropertyListSerialization
          dataWithPropertyList:dictionary
                        format:NSPropertyListBinaryFormat_v1_0
                       options:0
                         error:&encodeError];
      if (data == nil) {
        return "Apple credential encoding failed";
      }
      NSError* writeError = nil;
      if (![data writeToURL:fileUrl
                    options:NSDataWritingAtomic
                      error:&writeError]) {
        return "Apple credential save failed";
      }
      return {};
    }
  }
};

std::mutex clientMutex;
std::shared_ptr<OpenApiClient> sharedClient;
std::string sharedApplicationIdentity;
std::string sharedClientVersion;
std::mutex assetSyncSchedulerMutex;
std::shared_ptr<AssetSyncScheduler> sharedAssetSyncScheduler;
std::mutex tokenSyncCoordinatorMutex;
std::shared_ptr<TokenSyncCoordinator> sharedTokenSyncCoordinator;
std::mutex protocolSyncCoordinatorMutex;
std::shared_ptr<ProtocolSyncCoordinator> sharedProtocolSyncCoordinator;
std::mutex nftSyncCoordinatorMutex;
std::shared_ptr<NftSyncCoordinator> sharedNftSyncCoordinator;

std::shared_ptr<OpenApiClient> getClient(std::string& error) {
  auto* bundle = [NSBundle mainBundle];
  const auto applicationIdentity = fromNSString(bundle.bundleIdentifier);
  const auto clientVersion = fromNSString(
      [bundle objectForInfoDictionaryKey:@"CFBundleShortVersionString"]);
  if (applicationIdentity.empty() || clientVersion.empty()) {
    error = "application identity or version is unavailable";
    return nullptr;
  }

  std::lock_guard<std::mutex> lock(clientMutex);
  if (sharedClient) {
    if (sharedApplicationIdentity != applicationIdentity ||
        sharedClientVersion != clientVersion) {
      error = "native OpenAPI configuration changed during this process";
      return nullptr;
    }
    return sharedClient;
  }

  auto uuidProvider = []() { return makePlatformUuid(); };
  auto epochProvider = []() { return platformEpochSeconds(); };
  sharedClient = std::make_shared<OpenApiClient>(
      OpenApiClientConfiguration{
          applicationIdentity,
          kOpenApiBaseUrl,
          "rabbymobile",
          clientVersion,
      },
      http::makePlatformClient(),
      configuredOpenApiRequestSigner(),
      makePlatformApiCredentialPersistence(),
      uuidProvider,
      epochProvider,
      uuidProvider);
  sharedApplicationIdentity = applicationIdentity;
  sharedClientVersion = clientVersion;
  return sharedClient;
}

std::shared_ptr<AssetSyncScheduler> getAssetSyncScheduler() {
  std::lock_guard<std::mutex> lock(assetSyncSchedulerMutex);
  if (!sharedAssetSyncScheduler) {
    sharedAssetSyncScheduler =
        std::make_shared<AssetSyncScheduler>(12, 2, 64);
  }
  return sharedAssetSyncScheduler;
}

std::shared_ptr<TokenSyncCoordinator> getTokenSyncCoordinator(
    std::string& error) {
  auto client = getClient(error);
  if (!client) {
    return nullptr;
  }
  auto scheduler = getAssetSyncScheduler();

  std::lock_guard<std::mutex> lock(tokenSyncCoordinatorMutex);
  if (!sharedTokenSyncCoordinator) {
    sharedTokenSyncCoordinator = std::make_shared<TokenSyncCoordinator>(
        [client, scheduler](
            OpenApiClientRequest request,
            OpenApiClientCompletion completion) {
          return scheduler->execute(
              [client](
                  OpenApiClientRequest scheduledRequest,
                  OpenApiClientCompletion scheduledCompletion) {
                return client->execute(
                    std::move(scheduledRequest),
                    std::move(scheduledCompletion));
              },
              std::move(request),
              std::move(completion));
        },
        makePlatformTokenCachePersistence(),
        []() {
          return std::chrono::duration_cast<std::chrono::milliseconds>(
                     std::chrono::system_clock::now().time_since_epoch())
              .count();
        },
        15,
        [scheduler](AssetSyncTask task) {
          scheduler->postProcessing(std::move(task));
        });
  }
  return sharedTokenSyncCoordinator;
}

std::shared_ptr<ProtocolSyncCoordinator> getProtocolSyncCoordinator(
    std::string& error) {
  auto client = getClient(error);
  if (!client) {
    return nullptr;
  }
  auto scheduler = getAssetSyncScheduler();

  std::lock_guard<std::mutex> lock(protocolSyncCoordinatorMutex);
  if (!sharedProtocolSyncCoordinator) {
    sharedProtocolSyncCoordinator = std::make_shared<ProtocolSyncCoordinator>(
        [client, scheduler](
            OpenApiClientRequest request,
            OpenApiClientCompletion completion) {
          return scheduler->execute(
              [client](
                  OpenApiClientRequest scheduledRequest,
                  OpenApiClientCompletion scheduledCompletion) {
                return client->execute(
                    std::move(scheduledRequest),
                    std::move(scheduledCompletion));
              },
              std::move(request),
              std::move(completion));
        },
        makePlatformAddressCachePersistence(),
        []() {
          return std::chrono::duration_cast<std::chrono::milliseconds>(
                     std::chrono::system_clock::now().time_since_epoch())
              .count();
        },
        [scheduler](AssetSyncTask task) {
          scheduler->postProcessing(std::move(task));
        });
  }
  return sharedProtocolSyncCoordinator;
}

std::shared_ptr<NftSyncCoordinator> getNftSyncCoordinator(
    std::string& error) {
  auto client = getClient(error);
  if (!client) {
    return nullptr;
  }
  auto scheduler = getAssetSyncScheduler();

  std::lock_guard<std::mutex> lock(nftSyncCoordinatorMutex);
  if (!sharedNftSyncCoordinator) {
    sharedNftSyncCoordinator = std::make_shared<NftSyncCoordinator>(
        [client, scheduler](
            OpenApiClientRequest request,
            OpenApiClientCompletion completion) {
          return scheduler->execute(
              [client](
                  OpenApiClientRequest scheduledRequest,
                  OpenApiClientCompletion scheduledCompletion) {
                return client->execute(
                    std::move(scheduledRequest),
                    std::move(scheduledCompletion));
              },
              std::move(request),
              std::move(completion));
        },
        makePlatformAddressCachePersistence(),
        []() {
          return std::chrono::duration_cast<std::chrono::milliseconds>(
                     std::chrono::system_clock::now().time_since_epoch())
              .count();
        },
        [scheduler](AssetSyncTask task) {
          scheduler->postProcessing(std::move(task));
        });
  }
  return sharedNftSyncCoordinator;
}

NSDictionary<NSString*, id>* makeResultDictionary(
    const OpenApiDiagnosticResult& result) {
  return @{
    @"success" : @(result.success),
    @"error" : [NSString stringWithUTF8String:result.error.c_str()],
    @"firstStatusCode" : @(result.first.statusCode),
    @"secondStatusCode" : @(result.second.statusCode),
    @"firstDurationMs" : @(result.first.durationMs),
    @"secondDurationMs" : @(result.second.durationMs),
    @"firstBodyBytes" : @(result.first.bodyBytes),
    @"secondBodyBytes" : @(result.second.bodyBytes),
    @"firstCredentialDisposition" : [NSString
        stringWithUTF8String:credentialResponseDispositionName(
                              result.first.credentialDisposition)],
    @"secondCredentialDisposition" : [NSString
        stringWithUTF8String:credentialResponseDispositionName(
                              result.second.credentialDisposition)],
    @"firstRequestCredentialRevision" :
        @(result.first.requestCredentialRevision),
    @"firstCurrentCredentialRevision" :
        @(result.first.currentCredentialRevision),
    @"secondRequestCredentialRevision" :
        @(result.second.requestCredentialRevision),
    @"secondCurrentCredentialRevision" :
        @(result.second.currentCredentialRevision),
    @"secondUsedLatestAvailableCredential" :
        @(result.secondUsedLatestAvailableCredential),
  };
}

NSDictionary<NSString*, id>* makeTokenSyncResultDictionary(
    const TokenSyncResult& result) {
  return @{
    @"success" : @(result.success),
    @"outcome" : [NSString
        stringWithUTF8String:tokenSyncOutcomeName(result.outcome)],
    @"address" : [NSString stringWithUTF8String:result.address.c_str()],
    @"generation" : @(result.generation),
    @"stage" : [NSString stringWithUTF8String:tokenSyncStageName(result.stage)],
    @"chainCount" : @(result.chainCount),
    @"sourceTokenCount" : @(result.sourceTokenCount),
    @"filteredTokenCount" : @(result.filteredTokenCount),
    @"committedRowCount" : @(result.committedRowCount),
    @"successfulChainIds" : toNSStringArray(result.successfulChainIds),
    @"failedChainIds" : toNSStringArray(result.failedChainIds),
    @"committedAtMs" : @(result.committedAtMs),
    @"durationMs" : @(result.durationMs),
    @"error" : [NSString stringWithUTF8String:result.error.c_str()],
  };
}

NSDictionary<NSString*, id>* makeProtocolSyncResultDictionary(
    const ProtocolSyncResult& result) {
  return @{
    @"kind" : @"protocol",
    @"success" : @(result.success),
    @"address" : [NSString stringWithUTF8String:result.address.c_str()],
    @"generation" : @(result.generation),
    @"stage" : [NSString
        stringWithUTF8String:protocolSyncStageName(result.stage)],
    @"sourceItemCount" : @(result.sourceItemCount),
    @"committedRowCount" : @(result.committedRowCount),
    @"committedAtMs" : @(result.committedAtMs),
    @"durationMs" : @(result.durationMs),
    @"error" : [NSString stringWithUTF8String:result.error.c_str()],
  };
}

NSDictionary<NSString*, id>* makeNftSyncResultDictionary(
    const NftSyncResult& result) {
  return @{
    @"kind" : @"nft",
    @"success" : @(result.success),
    @"address" : [NSString stringWithUTF8String:result.address.c_str()],
    @"generation" : @(result.generation),
    @"stage" : [NSString stringWithUTF8String:nftSyncStageName(result.stage)],
    @"sourceItemCount" : @(result.sourceItemCount),
    @"committedRowCount" : @(result.committedRowCount),
    @"committedAtMs" : @(result.committedAtMs),
    @"durationMs" : @(result.durationMs),
    @"error" : [NSString stringWithUTF8String:result.error.c_str()],
  };
}

} // namespace
} // namespace rabby::openapi::apple

namespace rabby::openapi {

std::shared_ptr<ApiCredentialPersistence>
makePlatformApiCredentialPersistence() {
  static auto persistence =
      std::make_shared<apple::AppleApiCredentialPersistence>();
  return persistence;
}

std::string makePlatformUuid() {
  return apple::fromNSString([NSUUID UUID].UUIDString.lowercaseString);
}

std::int64_t platformEpochSeconds() {
  return std::chrono::duration_cast<std::chrono::seconds>(
             std::chrono::system_clock::now().time_since_epoch())
      .count();
}

} // namespace rabby::openapi

@implementation RabbyNativeOpenApiDiagnostics

+ (void)runUsedChainListProbeForAddress:(NSString*)address
                             completion:
                                 (RabbyNativeOpenApiDiagnosticCompletion)completion {
  std::string error;
  auto client = rabby::openapi::apple::getClient(error);
  if (!client) {
    rabby::openapi::OpenApiDiagnosticResult result;
    result.error = std::move(error);
    completion(rabby::openapi::apple::makeResultDictionary(result));
    return;
  }

  RabbyNativeOpenApiDiagnosticCompletion callback = [completion copy];
  rabby::openapi::runUsedChainListDiagnostic(
      std::move(client),
      rabby::openapi::apple::fromNSString(address),
      [callback](rabby::openapi::OpenApiDiagnosticResult result) {
        auto* dictionary =
            rabby::openapi::apple::makeResultDictionary(result);
        dispatch_async(dispatch_get_main_queue(), ^{
          callback(dictionary);
        });
      });
}

+ (void)syncTokenCacheForAddress:(NSString*)address
                 replaceExisting:(BOOL)replaceExisting
                       completion:(RabbyNativeTokenSyncCompletion)completion {
  std::string error;
  auto coordinator = rabby::openapi::apple::getTokenSyncCoordinator(error);
  if (!coordinator) {
    rabby::openapi::TokenSyncResult result;
    result.address = rabby::openapi::apple::fromNSString(address);
    result.error = std::move(error);
    completion(rabby::openapi::apple::makeTokenSyncResultDictionary(result));
    return;
  }

  RabbyNativeTokenSyncCompletion callback = [completion copy];
  coordinator->syncAddress(
      rabby::openapi::apple::fromNSString(address),
      replaceExisting,
      [callback](rabby::openapi::TokenSyncResult result) {
        auto* dictionary =
            rabby::openapi::apple::makeTokenSyncResultDictionary(result);
        dispatch_async(dispatch_get_main_queue(), ^{
          callback(dictionary);
        });
      });
}

+ (void)syncTokenChainsForAddress:(NSString*)address
                         chainIds:(NSArray<NSString*>*)chainIds
                 replacementScope:(NSString*)replacementScope
                  replaceExisting:(BOOL)replaceExisting
                        completion:(RabbyNativeTokenSyncCompletion)completion {
  std::string error;
  auto coordinator = rabby::openapi::apple::getTokenSyncCoordinator(error);
  if (!coordinator) {
    rabby::openapi::TokenSyncResult result;
    result.address = rabby::openapi::apple::fromNSString(address);
    result.error = std::move(error);
    completion(rabby::openapi::apple::makeTokenSyncResultDictionary(result));
    return;
  }

  std::vector<std::string> chainIdValues;
  chainIdValues.reserve(chainIds.count);
  for (NSString* chainId in chainIds) {
    chainIdValues.push_back(rabby::openapi::apple::fromNSString(chainId));
  }

  rabby::openapi::TokenCacheReplacementScope scope;
  if ([replacementScope isEqualToString:@"address"]) {
    scope.kind = rabby::openapi::TokenCacheReplacementKind::Address;
  } else if ([replacementScope isEqualToString:@"chains"]) {
    scope.kind = rabby::openapi::TokenCacheReplacementKind::Chains;
    scope.chainIds = chainIdValues;
  } else {
    rabby::openapi::TokenSyncResult result;
    result.address = rabby::openapi::apple::fromNSString(address);
    result.stage = rabby::openapi::TokenSyncStage::TokenLists;
    result.error = "token cache replacement kind is invalid";
    completion(rabby::openapi::apple::makeTokenSyncResultDictionary(result));
    return;
  }

  RabbyNativeTokenSyncCompletion callback = [completion copy];
  coordinator->syncChains(
      rabby::openapi::apple::fromNSString(address),
      std::move(chainIdValues),
      std::move(scope),
      replaceExisting,
      [callback](rabby::openapi::TokenSyncResult result) {
        auto* dictionary =
            rabby::openapi::apple::makeTokenSyncResultDictionary(result);
        dispatch_async(dispatch_get_main_queue(), ^{
          callback(dictionary);
        });
      });
}

+ (void)syncProtocolCacheForAddress:(NSString*)address
                    replaceExisting:(BOOL)replaceExisting
                          completion:
                              (RabbyNativeAddressAssetSyncCompletion)completion {
  std::string error;
  auto coordinator = rabby::openapi::apple::getProtocolSyncCoordinator(error);
  if (!coordinator) {
    rabby::openapi::ProtocolSyncResult result;
    result.address = rabby::openapi::apple::fromNSString(address);
    result.error = std::move(error);
    completion(rabby::openapi::apple::makeProtocolSyncResultDictionary(result));
    return;
  }

  RabbyNativeAddressAssetSyncCompletion callback = [completion copy];
  coordinator->syncAddress(
      rabby::openapi::apple::fromNSString(address),
      replaceExisting,
      [callback](rabby::openapi::ProtocolSyncResult result) {
        auto* dictionary =
            rabby::openapi::apple::makeProtocolSyncResultDictionary(result);
        dispatch_async(dispatch_get_main_queue(), ^{
          callback(dictionary);
        });
      });
}

+ (void)syncNftCacheForAddress:(NSString*)address
               replaceExisting:(BOOL)replaceExisting
                     completion:
                         (RabbyNativeAddressAssetSyncCompletion)completion {
  std::string error;
  auto coordinator = rabby::openapi::apple::getNftSyncCoordinator(error);
  if (!coordinator) {
    rabby::openapi::NftSyncResult result;
    result.address = rabby::openapi::apple::fromNSString(address);
    result.error = std::move(error);
    completion(rabby::openapi::apple::makeNftSyncResultDictionary(result));
    return;
  }

  RabbyNativeAddressAssetSyncCompletion callback = [completion copy];
  coordinator->syncAddress(
      rabby::openapi::apple::fromNSString(address),
      replaceExisting,
      [callback](rabby::openapi::NftSyncResult result) {
        auto* dictionary =
            rabby::openapi::apple::makeNftSyncResultDictionary(result);
        dispatch_async(dispatch_get_main_queue(), ^{
          callback(dictionary);
        });
      });
}

+ (void)verifyTokenCacheWriteWithCompletion:
    (RabbyNativeTokenCacheWriteDiagnosticCompletion)completion {
  RabbyNativeTokenCacheWriteDiagnosticCompletion callback = [completion copy];
  dispatch_async(
      dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0),
      ^{
        const auto startedAt = std::chrono::steady_clock::now();
        const auto timestampMs =
            std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::system_clock::now().time_since_epoch())
                .count();
        const auto result =
            rabby::openapi::makePlatformTokenCachePersistence()
                ->verifyWriteContract(timestampMs);
        const auto durationMs =
            std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::steady_clock::now() - startedAt)
                .count();
        auto* dictionary = @{
          @"success" : @(result.success),
          @"stage" : result.success ? @"rolled_back" : @"transaction",
          @"attemptedRowCount" : @1,
          @"durationMs" : @(durationMs),
          @"error" : [NSString stringWithUTF8String:result.error.c_str()],
        };
        dispatch_async(dispatch_get_main_queue(), ^{
          callback(dictionary);
        });
      });
}

+ (void)cancelTokenCacheSyncForAddress:(NSString*)address {
  std::shared_ptr<rabby::openapi::TokenSyncCoordinator> coordinator;
  {
    std::lock_guard<std::mutex> lock(
        rabby::openapi::apple::tokenSyncCoordinatorMutex);
    coordinator = rabby::openapi::apple::sharedTokenSyncCoordinator;
  }
  if (coordinator) {
    coordinator->cancelAddress(rabby::openapi::apple::fromNSString(address));
  }
}

+ (void)cancelAllTokenCacheSyncs {
  std::shared_ptr<rabby::openapi::TokenSyncCoordinator> coordinator;
  {
    std::lock_guard<std::mutex> lock(
        rabby::openapi::apple::tokenSyncCoordinatorMutex);
    coordinator = rabby::openapi::apple::sharedTokenSyncCoordinator;
  }
  if (coordinator) {
    coordinator->cancelAll();
  }
}

+ (void)cancelProtocolCacheSyncForAddress:(NSString*)address {
  std::shared_ptr<rabby::openapi::ProtocolSyncCoordinator> coordinator;
  {
    std::lock_guard<std::mutex> lock(
        rabby::openapi::apple::protocolSyncCoordinatorMutex);
    coordinator = rabby::openapi::apple::sharedProtocolSyncCoordinator;
  }
  if (coordinator) {
    coordinator->cancelAddress(rabby::openapi::apple::fromNSString(address));
  }
}

+ (void)cancelAllProtocolCacheSyncs {
  std::shared_ptr<rabby::openapi::ProtocolSyncCoordinator> coordinator;
  {
    std::lock_guard<std::mutex> lock(
        rabby::openapi::apple::protocolSyncCoordinatorMutex);
    coordinator = rabby::openapi::apple::sharedProtocolSyncCoordinator;
  }
  if (coordinator) {
    coordinator->cancelAll();
  }
}

+ (void)cancelNftCacheSyncForAddress:(NSString*)address {
  std::shared_ptr<rabby::openapi::NftSyncCoordinator> coordinator;
  {
    std::lock_guard<std::mutex> lock(
        rabby::openapi::apple::nftSyncCoordinatorMutex);
    coordinator = rabby::openapi::apple::sharedNftSyncCoordinator;
  }
  if (coordinator) {
    coordinator->cancelAddress(rabby::openapi::apple::fromNSString(address));
  }
}

+ (void)cancelAllNftCacheSyncs {
  std::shared_ptr<rabby::openapi::NftSyncCoordinator> coordinator;
  {
    std::lock_guard<std::mutex> lock(
        rabby::openapi::apple::nftSyncCoordinatorMutex);
    coordinator = rabby::openapi::apple::sharedNftSyncCoordinator;
  }
  if (coordinator) {
    coordinator->cancelAll();
  }
}

@end
