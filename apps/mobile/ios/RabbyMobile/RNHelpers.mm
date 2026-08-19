// RNHelpers.mm
#import "RNHelpers.h"
#import <Foundation/Foundation.h>
#import <rabby/openapi/RabbyNativeOpenApiDiagnostics.h>

static NSString *const RabbyNativeAssetSyncCompletedEvent =
    @"@RabbyNativeAssetSyncCompleted";

@implementation RNHelpers

// To export a module named RNHelpers
RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[RabbyNativeAssetSyncCompletedEvent];
}

- (void)emitNativeAssetSyncCompletion:(NSString *)requestId
                     replacementScope:(NSString *)replacementScope
                              chainIds:(NSArray<NSString *> *)chainIds
                                result:(NSDictionary<NSString *, id> *)result {
    NSString *outcome = result[@"outcome"] ?: @"failed";
    BOOL isPartial = [outcome isEqualToString:@"partial"];
    [self sendEventWithName:RabbyNativeAssetSyncCompletedEvent
                       body:@{
        @"schemaVersion": @2,
        @"requestId": requestId,
        @"kind": @"token",
        @"success": result[@"success"] ?: @NO,
        @"outcome": outcome,
        @"address": result[@"address"] ?: @"",
        @"generation": result[@"generation"] ?: @0,
        @"committedAt": result[@"committedAtMs"] ?: @0,
        @"replacementScope": isPartial ? @"chains" : replacementScope,
        @"chainIds": result[@"successfulChainIds"] ?: @[],
        @"failedChainIds": result[@"failedChainIds"] ?: @[],
        @"committedRowCount": result[@"committedRowCount"] ?: @0,
        @"stage": result[@"stage"] ?: @"none",
        @"error": result[@"error"] ?: @"",
    }];
}

- (void)emitNativeAddressAssetSyncCompletion:(NSString *)requestId
                                       result:
                                           (NSDictionary<NSString *, id> *)result {
    [self sendEventWithName:RabbyNativeAssetSyncCompletedEvent
                       body:@{
        @"schemaVersion": @2,
        @"requestId": requestId,
        @"kind": result[@"kind"] ?: @"",
        @"success": result[@"success"] ?: @NO,
        @"outcome": [result[@"success"] boolValue] ? @"complete" : @"failed",
        @"address": result[@"address"] ?: @"",
        @"generation": result[@"generation"] ?: @0,
        @"committedAt": result[@"committedAtMs"] ?: @0,
        @"replacementScope": @"address",
        @"chainIds": @[],
        @"failedChainIds": @[],
        @"committedRowCount": result[@"committedRowCount"] ?: @0,
        @"stage": result[@"stage"] ?: @"none",
        @"error": result[@"error"] ?: @"",
    }];
}

- (NSDictionary *)constantsToExport {
    NSURL *buildInfoURL = [[NSBundle mainBundle] URLForResource:@"rabby-build-info" withExtension:@"json"];
    NSDictionary *buildInfo = @{};

    if (buildInfoURL != nil) {
        NSData *buildInfoData = [NSData dataWithContentsOfURL:buildInfoURL];
        if (buildInfoData != nil) {
            id decodedBuildInfo = [NSJSONSerialization JSONObjectWithData:buildInfoData options:0 error:nil];
            if ([decodedBuildInfo isKindOfClass:[NSDictionary class]]) {
                buildInfo = decodedBuildInfo;
            }
        }
    }

    return @{ @"buildInfo": buildInfo };
}

#pragma mark - Public API
RCT_EXPORT_METHOD(forceExitApp) {
    exit(0);
}

RCT_EXPORT_METHOD(runNativeOpenApiDiagnostic:
  (NSString *)address
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
) {
    NSString *bundleIdentifier = [NSBundle mainBundle].bundleIdentifier;
    if ([bundleIdentifier isEqualToString:@"com.debank.rabby-mobile"]) {
        reject(
            @"E_NATIVE_OPENAPI_DIAGNOSTIC_DISABLED",
            @"Native OpenAPI diagnostics are disabled in production builds",
            nil
        );
        return;
    }

    [RabbyNativeOpenApiDiagnostics
        runUsedChainListProbeForAddress:address
                            completion:^(NSDictionary<NSString *, id> *result) {
        resolve(result);
    }];
}

RCT_EXPORT_METHOD(getNativeAssetSyncSchedulerDiagnostics:
  (RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
) {
    NSString *bundleIdentifier = [NSBundle mainBundle].bundleIdentifier;
    if ([bundleIdentifier isEqualToString:@"com.debank.rabby-mobile"]) {
        reject(
            @"E_NATIVE_ASSET_SYNC_DIAGNOSTICS_DISABLED",
            @"Native asset sync diagnostics are disabled in production builds",
            nil
        );
        return;
    }

    resolve([RabbyNativeOpenApiDiagnostics assetSyncSchedulerDiagnostics]);
}

RCT_EXPORT_METHOD(runNativeTokenCacheSyncDiagnostic:
  (NSString *)address
  replaceExisting:(BOOL)replaceExisting
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
) {
    NSString *bundleIdentifier = [NSBundle mainBundle].bundleIdentifier;
    if ([bundleIdentifier isEqualToString:@"com.debank.rabby-mobile"]) {
        reject(
            @"E_NATIVE_TOKEN_SYNC_DISABLED",
            @"Native token sync diagnostics are disabled in production builds",
            nil
        );
        return;
    }

    [RabbyNativeOpenApiDiagnostics
        syncTokenCacheForAddress:address
                 replaceExisting:replaceExisting
                       completion:^(NSDictionary<NSString *, id> *result) {
        resolve(result);
    }];
}

RCT_EXPORT_METHOD(startNativeTokenChains:
  (NSString *)address
  chainIds:(NSArray<NSString *> *)chainIds
  replacementScope:(NSString *)replacementScope
  replaceExisting:(BOOL)replaceExisting
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
) {
    NSString *requestId = [NSUUID UUID].UUIDString.lowercaseString;
    [RabbyNativeOpenApiDiagnostics
        syncTokenChainsForAddress:address
                         chainIds:chainIds
                 replacementScope:replacementScope
                  replaceExisting:replaceExisting
                        completion:^(NSDictionary<NSString *, id> *result) {
        [self emitNativeAssetSyncCompletion:requestId
                           replacementScope:replacementScope
                                    chainIds:chainIds
                                      result:result];
    }];
    resolve(@{ @"requestId": requestId });
}

RCT_EXPORT_METHOD(runNativeProtocolCacheSyncDiagnostic:
  (NSString *)address
  replaceExisting:(BOOL)replaceExisting
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
) {
    NSString *bundleIdentifier = [NSBundle mainBundle].bundleIdentifier;
    if ([bundleIdentifier isEqualToString:@"com.debank.rabby-mobile"]) {
        reject(
            @"E_NATIVE_PROTOCOL_SYNC_DISABLED",
            @"Native protocol sync diagnostics are disabled in production builds",
            nil
        );
        return;
    }

    [RabbyNativeOpenApiDiagnostics
        syncProtocolCacheForAddress:address
                    replaceExisting:replaceExisting
                          completion:^(NSDictionary<NSString *, id> *result) {
        resolve(result);
    }];
}

RCT_EXPORT_METHOD(startNativeProtocolSync:
  (NSString *)address
  replaceExisting:(BOOL)replaceExisting
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
) {
    NSString *requestId = [NSUUID UUID].UUIDString.lowercaseString;
    [RabbyNativeOpenApiDiagnostics
        syncProtocolCacheForAddress:address
                    replaceExisting:replaceExisting
                          completion:^(NSDictionary<NSString *, id> *result) {
        [self emitNativeAddressAssetSyncCompletion:requestId result:result];
    }];
    resolve(@{ @"requestId": requestId });
}

RCT_EXPORT_METHOD(runNativeNftCacheSyncDiagnostic:
  (NSString *)address
  replaceExisting:(BOOL)replaceExisting
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
) {
    NSString *bundleIdentifier = [NSBundle mainBundle].bundleIdentifier;
    if ([bundleIdentifier isEqualToString:@"com.debank.rabby-mobile"]) {
        reject(
            @"E_NATIVE_NFT_SYNC_DISABLED",
            @"Native NFT sync diagnostics are disabled in production builds",
            nil
        );
        return;
    }

    [RabbyNativeOpenApiDiagnostics
        syncNftCacheForAddress:address
               replaceExisting:replaceExisting
                     completion:^(NSDictionary<NSString *, id> *result) {
        resolve(result);
    }];
}

RCT_EXPORT_METHOD(startNativeNftSync:
  (NSString *)address
  replaceExisting:(BOOL)replaceExisting
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
) {
    NSString *requestId = [NSUUID UUID].UUIDString.lowercaseString;
    [RabbyNativeOpenApiDiagnostics
        syncNftCacheForAddress:address
               replaceExisting:replaceExisting
                     completion:^(NSDictionary<NSString *, id> *result) {
        [self emitNativeAddressAssetSyncCompletion:requestId result:result];
    }];
    resolve(@{ @"requestId": requestId });
}

RCT_EXPORT_METHOD(runNativeTokenCacheWriteDiagnostic:
  (RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
) {
    NSString *bundleIdentifier = [NSBundle mainBundle].bundleIdentifier;
    if ([bundleIdentifier isEqualToString:@"com.debank.rabby-mobile"]) {
        reject(
            @"E_NATIVE_TOKEN_CACHE_WRITE_DIAGNOSTIC_DISABLED",
            @"Native token cache write diagnostics are disabled in production builds",
            nil
        );
        return;
    }

    [RabbyNativeOpenApiDiagnostics
        verifyTokenCacheWriteWithCompletion:
            ^(NSDictionary<NSString *, id> *result) {
        resolve(result);
    }];
}

RCT_EXPORT_METHOD(cancelNativeTokenCacheSync:(NSString *)address) {
    [RabbyNativeOpenApiDiagnostics cancelTokenCacheSyncForAddress:address];
}

RCT_EXPORT_METHOD(cancelAllNativeTokenCacheSyncs) {
    [RabbyNativeOpenApiDiagnostics cancelAllTokenCacheSyncs];
}

RCT_EXPORT_METHOD(cancelNativeProtocolCacheSync:(NSString *)address) {
    [RabbyNativeOpenApiDiagnostics cancelProtocolCacheSyncForAddress:address];
}

RCT_EXPORT_METHOD(cancelAllNativeProtocolCacheSyncs) {
    [RabbyNativeOpenApiDiagnostics cancelAllProtocolCacheSyncs];
}

RCT_EXPORT_METHOD(cancelNativeNftCacheSync:(NSString *)address) {
    [RabbyNativeOpenApiDiagnostics cancelNftCacheSyncForAddress:address];
}

RCT_EXPORT_METHOD(cancelAllNativeNftCacheSyncs) {
    [RabbyNativeOpenApiDiagnostics cancelAllNftCacheSyncs];
}

RCT_EXPORT_METHOD(iosExcludeFileFromBackup:
  (NSString *)filePath
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
) {
    NSURL *fileURL = [NSURL fileURLWithPath:filePath];
    NSError *error = nil;
    BOOL success = [fileURL setResourceValue:@YES forKey:NSURLIsExcludedFromBackupKey error:&error];

    if (success) {
        resolve(@YES);
    } else {
        reject(@"Error", @"Failed to exclude file from backup", error);
    }
}

// // @notice: not tested
// RCT_EXPORT_METHOD(iosExcludeDirectoryFromBackup:(NSString *)directoryPath resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
//     NSFileManager *fileManager = [NSFileManager defaultManager];
// //    NSError *retError = nil;

//     // Check if the path exists and is a directory
//     BOOL isDirectory;
//     if (![fileManager fileExistsAtPath:directoryPath isDirectory:&isDirectory] || !isDirectory) {
//         reject(@"Error", @"Provided path does not exist or is not a directory.", nil);
//         return;
//     }

//     // Recursive function for traversing directories
//     void (^excludeFiles)(NSString *) = ^(NSString *path) {
//         NSArray<NSString *> *contents = [fileManager contentsOfDirectoryAtPath:path error:nil];
//         if (!contents) {
//             // If unable to read directory contents, try to get error information
//             NSError *readError;
//             NSString *readErrorMessage = [NSString stringWithFormat:@"Failed to read directory contents at %@", path];
//             if (![fileManager contentsOfDirectoryAtPath:path error:&readError]) {
//                 reject(@"Error", readErrorMessage, readError);
//                 return;
//             }
//         }

//         for (NSString *item in contents) {
//             NSString *itemPath = [path stringByAppendingPathComponent:item];
//             BOOL itemIsDirectory;
//             if ([fileManager fileExistsAtPath:itemPath isDirectory:&itemIsDirectory]) {
//                 if (itemIsDirectory) {
//                     // Recursively call itself to handle subdirectories
//                     excludeFiles(itemPath);
//                 } else {
//                     NSURL *fileURL = [NSURL fileURLWithPath:itemPath];
//                     NSError *setResourceError;
//                     BOOL success = [fileURL setResourceValue:@YES forKey:NSURLIsExcludedFromBackupKey error:&setResourceError];
//                     if (!success) {
//                         reject(@"Error", [NSString stringWithFormat:@"Failed to exclude %@ from backup.", itemPath], setResourceError);
//                         return;
//                     }
//                 }
//             }
//         }
//     };

//     excludeFiles(directoryPath);
//     resolve(@YES);
// }
@end
