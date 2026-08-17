#pragma once

#ifdef __OBJC__

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^RabbyNativeOpenApiDiagnosticCompletion)(
    NSDictionary<NSString*, id>* result);
typedef void (^RabbyNativeTokenSyncCompletion)(
    NSDictionary<NSString*, id>* result);
typedef void (^RabbyNativeAddressAssetSyncCompletion)(
    NSDictionary<NSString*, id>* result);
typedef void (^RabbyNativeTokenCacheWriteDiagnosticCompletion)(
    NSDictionary<NSString*, id>* result);

// Fixed, read-only diagnostic surface. It intentionally exposes neither an
// arbitrary URL nor response bodies to React Native.
@interface RabbyNativeOpenApiDiagnostics : NSObject

+ (void)runUsedChainListProbeForAddress:(NSString*)address
                             completion:
                                 (RabbyNativeOpenApiDiagnosticCompletion)completion;

+ (void)syncTokenCacheForAddress:(NSString*)address
                 replaceExisting:(BOOL)replaceExisting
                       completion:(RabbyNativeTokenSyncCompletion)completion;

+ (void)syncTokenChainsForAddress:(NSString*)address
                         chainIds:(NSArray<NSString*>*)chainIds
                 replacementScope:(NSString*)replacementScope
                  replaceExisting:(BOOL)replaceExisting
                        completion:(RabbyNativeTokenSyncCompletion)completion;

+ (void)syncProtocolCacheForAddress:(NSString*)address
                    replaceExisting:(BOOL)replaceExisting
                          completion:
                              (RabbyNativeAddressAssetSyncCompletion)completion;

+ (void)verifyTokenCacheWriteWithCompletion:
    (RabbyNativeTokenCacheWriteDiagnosticCompletion)completion;

+ (void)cancelTokenCacheSyncForAddress:(NSString*)address;

+ (void)cancelAllTokenCacheSyncs;

+ (void)cancelProtocolCacheSyncForAddress:(NSString*)address;

+ (void)cancelAllProtocolCacheSyncs;

@end

NS_ASSUME_NONNULL_END

#endif
