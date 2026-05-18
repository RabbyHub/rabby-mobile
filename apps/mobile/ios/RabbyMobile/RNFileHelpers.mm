#import "RNFileHelpers.h"

#import <Foundation/Foundation.h>
#import <Photos/Photos.h>
#import <PhotosUI/PHPhotoLibrary+PhotosUISupport.h>
#import <React/RCTUtils.h>
#import <UIKit/UIKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

static NSString *RNFileCapabilityVisualMediaAccess(PHAuthorizationStatus status) {
    switch (status) {
        case PHAuthorizationStatusAuthorized:
            return @"full";
        case PHAuthorizationStatusLimited:
            return @"limited";
        case PHAuthorizationStatusRestricted:
            return @"restricted";
        case PHAuthorizationStatusDenied:
            return @"denied";
        case PHAuthorizationStatusNotDetermined:
        default:
            return @"not-determined";
    }
}

static NSString *RNFileCapabilityPermissionState(PHAuthorizationStatus status) {
    switch (status) {
        case PHAuthorizationStatusAuthorized:
            return @"granted";
        case PHAuthorizationStatusLimited:
            return @"limited";
        case PHAuthorizationStatusRestricted:
            return @"restricted";
        case PHAuthorizationStatusDenied:
            return @"denied";
        case PHAuthorizationStatusNotDetermined:
        default:
            return @"not-determined";
    }
}

static PHAuthorizationStatus RNFileCurrentVisualMediaAuthorizationStatus(void) {
    if (@available(iOS 14, *)) {
        return [PHPhotoLibrary authorizationStatusForAccessLevel:PHAccessLevelReadWrite];
    }

    return [PHPhotoLibrary authorizationStatus];
}

static NSString *RNFileCapabilityUserSelectedState(PHAuthorizationStatus status) {
    switch (status) {
        case PHAuthorizationStatusLimited:
            return @"limited";
        case PHAuthorizationStatusAuthorized:
        case PHAuthorizationStatusRestricted:
        case PHAuthorizationStatusDenied:
        case PHAuthorizationStatusNotDetermined:
        default:
            return @"not-applicable";
    }
}

static NSDictionary *RNFileCapabilitySnapshotFromStatus(PHAuthorizationStatus status) {
    return @{
        @"platform": @"ios",
        @"osVersion": [UIDevice currentDevice].systemVersion ?: @"",
        @"visualMedia": @{
            @"access": RNFileCapabilityVisualMediaAccess(status),
            @"canRequest": @(status == PHAuthorizationStatusNotDetermined),
            @"canReselect": @(status == PHAuthorizationStatusLimited),
            @"image": RNFileCapabilityPermissionState(status),
            @"video": RNFileCapabilityPermissionState(status),
            @"userSelected": RNFileCapabilityUserSelectedState(status),
        },
        @"sharedFiles": @{
            @"access": @"selection-required",
            @"appSandboxReadable": @YES,
            @"manageAllFiles": @"not-applicable",
            @"note": @"App-owned files remain readable. Shared files outside the sandbox rely on document-picker style user selection.",
        },
    };
}

static NSString *RNFileCapabilityMediaTypeString(PHAssetMediaType mediaType) {
    return mediaType == PHAssetMediaTypeVideo ? @"video" : @"image";
}

static PHAssetMediaType RNFileCapabilityResolveMediaType(NSDictionary *options) {
    NSString *mediaType = [options objectForKey:@"mediaType"];
    if ([mediaType isKindOfClass:[NSString class]] && [mediaType isEqualToString:@"video"]) {
        return PHAssetMediaTypeVideo;
    }

    return PHAssetMediaTypeImage;
}

static NSInteger RNFileCapabilityResolveLimit(NSDictionary *options) {
    NSNumber *limit = [options objectForKey:@"limit"];
    if ([limit respondsToSelector:@selector(integerValue)]) {
        NSInteger value = [limit integerValue];
        if (value < 1) {
            return 1;
        }
        if (value > 200) {
            return 200;
        }
        return value;
    }

    return 60;
}

static PHAssetResource *RNFileCapabilityPreferredResourceForAsset(PHAsset *asset) {
    NSArray<PHAssetResource *> *resources = [PHAssetResource assetResourcesForAsset:asset];
    if (resources.count == 0) {
        return nil;
    }

    NSArray<NSNumber *> *preferredTypes = asset.mediaType == PHAssetMediaTypeVideo
        ? @[
              @(PHAssetResourceTypeFullSizeVideo),
              @(PHAssetResourceTypeVideo),
              @(PHAssetResourceTypePairedVideo),
              @(PHAssetResourceTypeFullSizePairedVideo),
          ]
        : @[
              @(PHAssetResourceTypeFullSizePhoto),
              @(PHAssetResourceTypePhoto),
              @(PHAssetResourceTypeAlternatePhoto),
          ];

    for (NSNumber *resourceType in preferredTypes) {
        for (PHAssetResource *resource in resources) {
            if (resource.type == resourceType.integerValue) {
                return resource;
            }
        }
    }

    return resources.firstObject;
}

static NSString *RNFileCapabilityMimeType(PHAssetMediaType mediaType, PHAssetResource *resource) {
    NSString *uniformTypeIdentifier = resource.uniformTypeIdentifier;
    if (uniformTypeIdentifier.length > 0) {
        if (@available(iOS 14.0, *)) {
            UTType *type = [UTType typeWithIdentifier:uniformTypeIdentifier];
            if (type.preferredMIMEType.length > 0) {
                return type.preferredMIMEType;
            }
        }
    }

    return mediaType == PHAssetMediaTypeVideo ? @"video/*" : @"image/*";
}

static NSData *RNFileCapabilityLocalImageData(PHAsset *asset) {
    if (asset.mediaType != PHAssetMediaTypeImage) {
        return nil;
    }

    __block NSData *localImageData = nil;
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
    PHImageRequestOptions *options = [PHImageRequestOptions new];
    options.networkAccessAllowed = NO;
    options.deliveryMode = PHImageRequestOptionsDeliveryModeHighQualityFormat;
    options.version = PHImageRequestOptionsVersionCurrent;

    [[PHImageManager defaultManager]
        requestImageDataAndOrientationForAsset:asset
                                       options:options
                                 resultHandler:^(
                                     NSData *_Nullable imageData,
                                     NSString *_Nullable dataUTI,
                                     CGImagePropertyOrientation orientation,
                                     NSDictionary *_Nullable info
                                 ) {
                                     (void)dataUTI;
                                     (void)orientation;
                                     (void)info;
                                     if (imageData != nil) {
                                         localImageData = imageData;
                                     }
                                     dispatch_semaphore_signal(semaphore);
                                 }];

    dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);
    return localImageData;
}

static CGSize RNFileCapabilityPreviewTargetSize(PHAsset *asset) {
    CGFloat maxDimension = 720.0;
    CGFloat pixelWidth = MAX((CGFloat)asset.pixelWidth, 1.0);
    CGFloat pixelHeight = MAX((CGFloat)asset.pixelHeight, 1.0);
    CGFloat scale = MIN(1.0, maxDimension / MAX(pixelWidth, pixelHeight));

    return CGSizeMake(
        MAX(floor(pixelWidth * scale), 1.0),
        MAX(floor(pixelHeight * scale), 1.0)
    );
}

static NSData *RNFileCapabilityLocalThumbnailImageData(PHAsset *asset) {
    if (asset.mediaType != PHAssetMediaTypeImage) {
        return nil;
    }

    __block NSData *thumbnailData = nil;
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
    PHImageRequestOptions *options = [PHImageRequestOptions new];
    options.networkAccessAllowed = NO;
    options.resizeMode = PHImageRequestOptionsResizeModeFast;
    options.deliveryMode = PHImageRequestOptionsDeliveryModeFastFormat;
    options.version = PHImageRequestOptionsVersionCurrent;
    options.synchronous = YES;

    [[PHImageManager defaultManager]
        requestImageForAsset:asset
                   targetSize:RNFileCapabilityPreviewTargetSize(asset)
                  contentMode:PHImageContentModeAspectFit
                      options:options
                resultHandler:^(UIImage *_Nullable image, NSDictionary *_Nullable info) {
                    NSNumber *isCancelled = info[PHImageCancelledKey];
                    NSError *imageError = info[PHImageErrorKey];
                    if (isCancelled.boolValue || imageError != nil) {
                        dispatch_semaphore_signal(semaphore);
                        return;
                    }

                    if (image != nil) {
                        thumbnailData = UIImageJPEGRepresentation(image, 0.82);
                    }

                    dispatch_semaphore_signal(semaphore);
                }];

    dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);
    return thumbnailData;
}

static NSString *RNFileCapabilityPreviewDirectory(void) {
    NSArray<NSString *> *cachePaths = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES);
    NSString *cacheDir = cachePaths.firstObject ?: NSTemporaryDirectory();
    NSString *previewDir = [cacheDir stringByAppendingPathComponent:@"rn-file-helpers/accessible-media-preview"];

    [[NSFileManager defaultManager] createDirectoryAtPath:previewDir
                              withIntermediateDirectories:YES
                                               attributes:nil
                                                    error:nil];

    return previewDir;
}

static NSString *RNFileCapabilitySanitizedAssetIdentifier(NSString *assetId) {
    NSMutableString *sanitized = [NSMutableString stringWithCapacity:assetId.length];
    NSCharacterSet *allowedChars = [NSCharacterSet characterSetWithCharactersInString:@"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"];

    for (NSUInteger index = 0; index < assetId.length; index += 1) {
        unichar ch = [assetId characterAtIndex:index];
        if ([allowedChars characterIsMember:ch]) {
            [sanitized appendFormat:@"%C", ch];
        } else {
            [sanitized appendString:@"_"];
        }
    }

    return sanitized.length > 0 ? sanitized : @"asset";
}

static NSString *RNFileCapabilityPreviewFileExtension(PHAssetResource *resource) {
    NSString *pathExtension = resource.originalFilename.pathExtension.lowercaseString;
    if (pathExtension.length > 0) {
        return pathExtension;
    }

    NSString *uniformTypeIdentifier = resource.uniformTypeIdentifier;
    if (uniformTypeIdentifier.length > 0) {
        if (@available(iOS 14.0, *)) {
            UTType *type = [UTType typeWithIdentifier:uniformTypeIdentifier];
            if (type.preferredFilenameExtension.length > 0) {
                return type.preferredFilenameExtension;
            }
        }
    }

    return @"jpg";
}

static NSString *RNFileCapabilityPreviewUriForImageData(NSData *imageData, NSString *assetId, NSString *pathExtension) {
    if (imageData == nil || imageData.length == 0) {
        return nil;
    }

    NSString *filename = [NSString stringWithFormat:@"%@.%@", RNFileCapabilitySanitizedAssetIdentifier(assetId), pathExtension.length > 0 ? pathExtension : @"jpg"];
    NSString *filePath = [RNFileCapabilityPreviewDirectory() stringByAppendingPathComponent:filename];
    NSError *writeError = nil;

    [imageData writeToFile:filePath options:NSDataWritingAtomic error:&writeError];
    if (writeError != nil) {
        return nil;
    }

    return [NSURL fileURLWithPath:filePath].absoluteString;
}

static NSDictionary *RNFileCapabilityAccessibleVisualMediaList(NSDictionary *options) {
    PHAuthorizationStatus status = RNFileCurrentVisualMediaAuthorizationStatus();
    PHAssetMediaType mediaType = RNFileCapabilityResolveMediaType(options);
    NSInteger limit = RNFileCapabilityResolveLimit(options);
    NSString *mediaTypeString = RNFileCapabilityMediaTypeString(mediaType);
    NSMutableArray<NSDictionary *> *items = [NSMutableArray array];

    if (
        status != PHAuthorizationStatusAuthorized &&
        status != PHAuthorizationStatusLimited
    ) {
        return @{
            @"platform": @"ios",
            @"mediaType": mediaTypeString,
            @"limit": @(limit),
            @"truncated": @NO,
            @"items": items,
        };
    }

    PHFetchOptions *fetchOptions = [PHFetchOptions new];
    fetchOptions.fetchLimit = limit;
    fetchOptions.sortDescriptors = @[ [NSSortDescriptor sortDescriptorWithKey:@"creationDate" ascending:NO] ];
    fetchOptions.predicate = [NSPredicate predicateWithFormat:@"mediaType == %d", mediaType];

    PHFetchResult<PHAsset *> *result = [PHAsset fetchAssetsWithOptions:fetchOptions];
    [result enumerateObjectsUsingBlock:^(PHAsset *_Nonnull asset, NSUInteger idx, BOOL *_Nonnull stop) {
        (void)idx;
        (void)stop;

        NSString *assetId = asset.localIdentifier ?: [[NSUUID UUID] UUIDString];
        PHAssetResource *resource = RNFileCapabilityPreferredResourceForAsset(asset);
        NSString *name =
            resource.originalFilename.length > 0
                ? resource.originalFilename
                : [NSString stringWithFormat:@"%@-%@", mediaTypeString, assetId];
        NSString *mimeType = RNFileCapabilityMimeType(asset.mediaType, resource);
        NSData *localImageData = mediaType == PHAssetMediaTypeImage
            ? RNFileCapabilityLocalImageData(asset)
            : nil;
        NSData *previewImageData = nil;
        NSString *previewPathExtension = @"";
        if (mediaType == PHAssetMediaTypeImage) {
            if (localImageData != nil) {
                previewImageData = localImageData;
                previewPathExtension = RNFileCapabilityPreviewFileExtension(resource);
            } else {
                previewImageData = RNFileCapabilityLocalThumbnailImageData(asset);
                previewPathExtension = @"jpg";
            }
        }
        double sizeBytes = localImageData != nil ? (double)localImageData.length : 0;
        NSString *previewUri = mediaType == PHAssetMediaTypeImage
            ? RNFileCapabilityPreviewUriForImageData(previewImageData, assetId, previewPathExtension)
            : nil;
        NSTimeInterval creationTimestamp = asset.creationDate != nil
            ? asset.creationDate.timeIntervalSince1970
            : 0;

        NSMutableDictionary *item = [@{
            @"id": assetId,
            @"uri": [NSString stringWithFormat:@"ph://%@", assetId],
            @"name": name,
            @"mediaType": mediaTypeString,
            @"mimeType": mimeType,
            @"sizeBytes": @(sizeBytes),
            @"width": @(asset.pixelWidth),
            @"height": @(asset.pixelHeight),
            @"dateAddedMs": @(creationTimestamp * 1000),
        } mutableCopy];
        if (previewUri.length > 0) {
            item[@"previewUri"] = previewUri;
        }

        [items addObject:item];
    }];

    return @{
        @"platform": @"ios",
        @"mediaType": mediaTypeString,
        @"limit": @(limit),
        @"truncated": @(result.count >= limit),
        @"items": items,
    };
}

@implementation RNFileHelpers

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(getFileCapabilitySnapshot:
  (RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
) {
    (void)reject;
    resolve(RNFileCapabilitySnapshotFromStatus(RNFileCurrentVisualMediaAuthorizationStatus()));
}

RCT_EXPORT_METHOD(requestVisualMediaAccess:
  (NSDictionary *)options
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
) {
    (void)options;

    PHAuthorizationStatus status = RNFileCurrentVisualMediaAuthorizationStatus();
    if (status == PHAuthorizationStatusNotDetermined) {
        if (@available(iOS 14, *)) {
            [PHPhotoLibrary requestAuthorizationForAccessLevel:PHAccessLevelReadWrite
                                                       handler:^(PHAuthorizationStatus nextStatus) {
                                                           resolve(RNFileCapabilitySnapshotFromStatus(nextStatus));
                                                       }];
        } else {
            [PHPhotoLibrary requestAuthorization:^(PHAuthorizationStatus nextStatus) {
                resolve(RNFileCapabilitySnapshotFromStatus(nextStatus));
            }];
        }
        return;
    }

    if (status != PHAuthorizationStatusLimited) {
        resolve(RNFileCapabilitySnapshotFromStatus(status));
        return;
    }

    dispatch_async(dispatch_get_main_queue(), ^{
        UIViewController *controller = RCTPresentedViewController();
        if (controller == nil) {
            controller = RCTKeyWindow().rootViewController;
        }

        if (controller == nil) {
            reject(
                @"E_VISUAL_MEDIA_ACTIVITY",
                @"Current iOS view controller is not available",
                nil
            );
            return;
        }

        PHPhotoLibrary *photoLibrary = [PHPhotoLibrary sharedPhotoLibrary];
        SEL pickerWithCompletionSelector = @selector(presentLimitedLibraryPickerFromViewController:completionHandler:);
        SEL pickerSelector = @selector(presentLimitedLibraryPickerFromViewController:);

        if (@available(iOS 15, *)) {
            if ([photoLibrary respondsToSelector:pickerWithCompletionSelector]) {
                void (*pickerWithCompletionImp)(id, SEL, UIViewController *, void (^)(NSArray<NSString *> *)) =
                    (void (*)(id, SEL, UIViewController *, void (^)(NSArray<NSString *> *)))[photoLibrary methodForSelector:pickerWithCompletionSelector];
                pickerWithCompletionImp(photoLibrary, pickerWithCompletionSelector, controller, ^(NSArray<NSString *> *_Nonnull assetIdentifiers) {
                    (void)assetIdentifiers;
                    resolve(
                        RNFileCapabilitySnapshotFromStatus(
                            RNFileCurrentVisualMediaAuthorizationStatus()
                        )
                    );
                });
                return;
            }
        }

        if ([photoLibrary respondsToSelector:pickerSelector]) {
            void (*pickerImp)(id, SEL, UIViewController *) =
                (void (*)(id, SEL, UIViewController *))[photoLibrary methodForSelector:pickerSelector];
            pickerImp(photoLibrary, pickerSelector, controller);
            resolve(
                RNFileCapabilitySnapshotFromStatus(
                    RNFileCurrentVisualMediaAuthorizationStatus()
                )
            );
            return;
        }

        reject(
            @"E_VISUAL_MEDIA_ACTIVITY",
            @"Limited-library picker is unavailable on this iOS build",
            nil
        );
    });
}

RCT_EXPORT_METHOD(listAccessibleVisualMedia:
  (NSDictionary *)options
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
) {
    (void)reject;
    resolve(RNFileCapabilityAccessibleVisualMediaList(options ?: @{}));
}

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

@end
