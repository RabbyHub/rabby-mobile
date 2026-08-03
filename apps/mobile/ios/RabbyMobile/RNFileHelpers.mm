#import "RNFileHelpers.h"

#import <AVFoundation/AVFoundation.h>
#import <CoreImage/CoreImage.h>
#import <Foundation/Foundation.h>
#import <Photos/Photos.h>
#import <PhotosUI/PHPhotoLibrary+PhotosUISupport.h>
#import <React/RCTUtils.h>
#import <UIKit/UIKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <Vision/Vision.h>

static const NSInteger RNQRCodeVideoFrameRate = 30;
static const NSInteger RNQRCodeVideoMaxMatrices = 2000;
static const NSInteger RNQRCodeVideoMaxDecodedValues = 4096;
static const unsigned long long RNQRCodeVideoMaxFileSizeBytes =
    200ULL * 1024ULL * 1024ULL;
static const NSTimeInterval RNVideoFilePickerMaxCacheAgeSeconds = 6.0 * 60.0 * 60.0;
static NSString *const RNQRCodeVideoURBytesPrefix = @"ur:bytes/";

static dispatch_queue_t RNQRCodeVideoJobStateQueue(void) {
    static dispatch_queue_t queue;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        queue = dispatch_queue_create("com.rabby.qr-video-job-state", DISPATCH_QUEUE_SERIAL);
    });
    return queue;
}

static NSMutableDictionary<NSString *, NSNumber *> *RNQRCodeVideoJobStates(void) {
    static NSMutableDictionary<NSString *, NSNumber *> *states;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        states = [NSMutableDictionary dictionary];
    });
    return states;
}

static BOOL RNQRCodeVideoRegisterJob(NSString *jobId) {
    __block BOOL registered = NO;
    dispatch_sync(RNQRCodeVideoJobStateQueue(), ^{
        if (RNQRCodeVideoJobStates()[jobId] == nil) {
            RNQRCodeVideoJobStates()[jobId] = @NO;
            registered = YES;
        }
    });
    return registered;
}

static void RNQRCodeVideoCancelJob(NSString *jobId) {
    if (jobId.length == 0) {
        return;
    }
    dispatch_sync(RNQRCodeVideoJobStateQueue(), ^{
        if (RNQRCodeVideoJobStates()[jobId] != nil) {
            RNQRCodeVideoJobStates()[jobId] = @YES;
        }
    });
}

static BOOL RNQRCodeVideoIsCancelled(NSString *jobId) {
    __block BOOL cancelled = NO;
    dispatch_sync(RNQRCodeVideoJobStateQueue(), ^{
        cancelled = RNQRCodeVideoJobStates()[jobId].boolValue;
    });
    return cancelled;
}

static void RNQRCodeVideoFinishJob(NSString *jobId) {
    dispatch_sync(RNQRCodeVideoJobStateQueue(), ^{
        [RNQRCodeVideoJobStates() removeObjectForKey:jobId];
    });
}

static NSError *RNQRCodeVideoError(NSString *code, NSString *message) {
    return [NSError errorWithDomain:[NSString stringWithFormat:@"RNFileHelpers.%@", code]
                               code:1
                           userInfo:@{NSLocalizedDescriptionKey: message ?: @"QR video operation failed"}];
}

static NSInteger RNQRCodeVideoIntegerOption(
    NSDictionary *options,
    NSString *key,
    NSInteger fallback,
    NSInteger minimum,
    NSInteger maximum,
    NSError **error
) {
    id value = options[key];
    if (value == nil || value == [NSNull null]) {
        return fallback;
    }
    if (![value respondsToSelector:@selector(integerValue)]) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"invalid-input", [NSString stringWithFormat:@"%@ must be a number", key]);
        }
        return fallback;
    }
    NSInteger result = [value integerValue];
    if (result < minimum || result > maximum) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"invalid-input", [NSString stringWithFormat:@"%@ is outside the supported range", key]);
        }
        return fallback;
    }
    return result;
}

static NSString *RNQRCodeVideoJobId(NSDictionary *options, NSError **error) {
    id value = options[@"jobId"];
    if (value == nil || value == [NSNull null]) {
        return NSUUID.UUID.UUIDString;
    }
    if (
        ![value isKindOfClass:[NSString class]] ||
        ((NSString *)value).length == 0 ||
        ((NSString *)value).length > 128
    ) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"invalid-input", @"jobId is invalid");
        }
        return nil;
    }
    return value;
}

static NSURL *RNQRCodeVideoFileURL(NSString *path, NSError **error) {
    if (![path isKindOfClass:[NSString class]] || path.length == 0) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"invalid-input", @"A file path is required");
        }
        return nil;
    }
    NSURL *url = [path.lowercaseString hasPrefix:@"file://"]
        ? [NSURL URLWithString:path]
        : [NSURL fileURLWithPath:path];
    if (url == nil || !url.isFileURL) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"invalid-input", @"Only local file paths are supported");
        }
        return nil;
    }
    return url.URLByStandardizingPath;
}

static BOOL RNQRCodeVideoEnforceFileSizeLimit(NSURL *fileURL, NSError **error) {
    NSNumber *fileSize = nil;
    NSError *resourceError = nil;
    if (
        ![fileURL getResourceValue:&fileSize
                            forKey:NSURLFileSizeKey
                             error:&resourceError] ||
        ![fileSize respondsToSelector:@selector(unsignedLongLongValue)]
    ) {
        if (error != NULL) {
            *error = resourceError ?: RNQRCodeVideoError(
                @"invalid-video",
                @"Video file size is unavailable"
            );
        }
        return NO;
    }
    if (fileSize.unsignedLongLongValue > RNQRCodeVideoMaxFileSizeBytes) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(
                @"invalid-video",
                @"Video exceeds the 200 MiB size limit"
            );
        }
        return NO;
    }
    return YES;
}

static NSInteger RNQRCodeVideoParsePositiveDecimal(NSString *value) {
    if (value.length == 0) {
        return 0;
    }
    NSCharacterSet *nonDigits = NSCharacterSet.decimalDigitCharacterSet.invertedSet;
    if ([value rangeOfCharacterFromSet:nonDigits].location != NSNotFound) {
        return 0;
    }
    unsigned long long result = value.longLongValue;
    if (result == 0 || result > NSIntegerMax) {
        return 0;
    }
    return (NSInteger)result;
}

/**
 * Multipart BC-UR emits original fragments 1..seqLen before fountain
 * redundancy. Seeing all originals means the second pass can be skipped; when
 * any original is missing, scanning continues so mixed fragments remain useful.
 */
static BOOL RNQRCodeVideoRecordOriginalURPart(
    NSString *value,
    NSInteger *expectedPartCount,
    NSMutableIndexSet *originalParts
) {
    if (value.length <= RNQRCodeVideoURBytesPrefix.length) {
        return NO;
    }
    NSString *lowercaseValue = value.lowercaseString;
    if (![lowercaseValue hasPrefix:RNQRCodeVideoURBytesPrefix]) {
        return NO;
    }
    NSRange remainderRange = NSMakeRange(
        RNQRCodeVideoURBytesPrefix.length,
        lowercaseValue.length - RNQRCodeVideoURBytesPrefix.length
    );
    NSRange sequenceEnd = [lowercaseValue rangeOfString:@"/"
                                                   options:0
                                                     range:remainderRange];
    if (sequenceEnd.location == NSNotFound || sequenceEnd.location == remainderRange.location) {
        return NO;
    }
    NSString *sequence = [lowercaseValue substringWithRange:NSMakeRange(
        remainderRange.location,
        sequenceEnd.location - remainderRange.location
    )];
    NSArray<NSString *> *components = [sequence componentsSeparatedByString:@"-"];
    if (components.count != 2) {
        return NO;
    }
    NSInteger sequenceNumber = RNQRCodeVideoParsePositiveDecimal(components[0]);
    NSInteger sequenceLength = RNQRCodeVideoParsePositiveDecimal(components[1]);
    if (
        sequenceNumber <= 0 ||
        sequenceLength <= 0 ||
        sequenceLength > RNQRCodeVideoMaxMatrices ||
        sequenceNumber > sequenceLength
    ) {
        return NO;
    }
    if (*expectedPartCount == 0) {
        *expectedPartCount = sequenceLength;
    } else if (*expectedPartCount != sequenceLength) {
        return NO;
    }
    [originalParts addIndex:(NSUInteger)(sequenceNumber - 1)];
    return originalParts.count == (NSUInteger)*expectedPartCount;
}

static BOOL RNQRCodeVideoValidateTrackDimensions(
    AVAssetTrack *videoTrack,
    NSInteger maxDimension,
    NSError **error
) {
    BOOL foundVideoFormat = NO;
    for (id formatDescriptionValue in videoTrack.formatDescriptions) {
        CMFormatDescriptionRef formatDescription =
            (__bridge CMFormatDescriptionRef)formatDescriptionValue;
        if (
            formatDescription == NULL ||
            CMFormatDescriptionGetMediaType(formatDescription) != kCMMediaType_Video
        ) {
            continue;
        }
        foundVideoFormat = YES;
        CMVideoDimensions dimensions = CMVideoFormatDescriptionGetDimensions(
            (CMVideoFormatDescriptionRef)formatDescription
        );
        if (
            dimensions.width <= 0 ||
            dimensions.height <= 0 ||
            dimensions.width > maxDimension ||
            dimensions.height > maxDimension
        ) {
            if (error != NULL) {
                *error = RNQRCodeVideoError(
                    @"invalid-video",
                    @"Video dimensions are invalid or exceed the limit"
                );
            }
            return NO;
        }
    }
    if (!foundVideoFormat) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(
                @"invalid-video",
                @"Video dimensions are unavailable"
            );
        }
        return NO;
    }
    return YES;
}

static BOOL RNQRCodeVideoBitIsDark(NSData *bits, NSInteger size, NSInteger row, NSInteger column) {
    NSInteger bitIndex = row * size + column;
    const uint8_t *bytes = (const uint8_t *)bits.bytes;
    return ((bytes[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1) != 0;
}

static CVPixelBufferRef RNQRCodeVideoCreatePixelBuffer(
    NSInteger outputSize,
    NSInteger matrixSize,
    NSData *bits,
    NSInteger quietZoneModules,
    NSError **error
) {
    NSDictionary *attributes = @{
        (NSString *)kCVPixelBufferCGImageCompatibilityKey: @YES,
        (NSString *)kCVPixelBufferCGBitmapContextCompatibilityKey: @YES,
        (NSString *)kCVPixelBufferIOSurfacePropertiesKey: @{},
    };
    CVPixelBufferRef pixelBuffer = NULL;
    CVReturn status = CVPixelBufferCreate(
        kCFAllocatorDefault,
        outputSize,
        outputSize,
        kCVPixelFormatType_32BGRA,
        (__bridge CFDictionaryRef)attributes,
        &pixelBuffer
    );
    if (status != kCVReturnSuccess || pixelBuffer == NULL) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"pixel-buffer", @"Unable to allocate a QR video frame");
        }
        return NULL;
    }

    CVPixelBufferLockBaseAddress(pixelBuffer, 0);
    void *baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer);
    size_t bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer);
    CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
    CGContextRef context = CGBitmapContextCreate(
        baseAddress,
        outputSize,
        outputSize,
        8,
        bytesPerRow,
        colorSpace,
        (CGBitmapInfo)kCGBitmapByteOrder32Little |
            (CGBitmapInfo)kCGImageAlphaPremultipliedFirst
    );
    CGColorSpaceRelease(colorSpace);
    if (context == NULL) {
        CVPixelBufferUnlockBaseAddress(pixelBuffer, 0);
        CVPixelBufferRelease(pixelBuffer);
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"pixel-buffer", @"Unable to draw a QR video frame");
        }
        return NULL;
    }

    CGContextSetRGBFillColor(context, 1, 1, 1, 1);
    CGContextFillRect(context, CGRectMake(0, 0, outputSize, outputSize));
    CGContextTranslateCTM(context, 0, outputSize);
    CGContextScaleCTM(context, 1, -1);
    CGContextSetAllowsAntialiasing(context, NO);
    CGContextSetShouldAntialias(context, NO);
    CGContextSetInterpolationQuality(context, kCGInterpolationNone);
    CGContextSetRGBFillColor(context, 0, 0, 0, 1);
    NSInteger moduleScale = MAX(1, outputSize / (matrixSize + quietZoneModules * 2));
    NSInteger renderedSize = matrixSize * moduleScale;
    NSInteger left = (outputSize - renderedSize) / 2;
    NSInteger top = (outputSize - renderedSize) / 2;
    for (NSInteger row = 0; row < matrixSize; row += 1) {
        NSInteger column = 0;
        while (column < matrixSize) {
            while (
                column < matrixSize &&
                !RNQRCodeVideoBitIsDark(bits, matrixSize, row, column)
            ) {
                column += 1;
            }
            NSInteger runStart = column;
            while (
                column < matrixSize &&
                RNQRCodeVideoBitIsDark(bits, matrixSize, row, column)
            ) {
                column += 1;
            }
            if (runStart < column) {
                CGContextFillRect(
                    context,
                    CGRectMake(
                        left + runStart * moduleScale,
                        top + row * moduleScale,
                        (column - runStart) * moduleScale,
                        moduleScale
                    )
                );
            }
        }
    }
    CGContextRelease(context);
    CVPixelBufferUnlockBaseAddress(pixelBuffer, 0);
    return pixelBuffer;
}

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

static NSString *RNQRCodeVideoCreate(
    NSArray *frames,
    NSDictionary *options,
    NSString *jobId,
    NSError **error
) {
    if (![frames isKindOfClass:[NSArray class]] || frames.count == 0) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"invalid-input", @"At least one QR matrix is required");
        }
        return nil;
    }
    if (frames.count > RNQRCodeVideoMaxMatrices) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"invalid-input", @"Too many QR matrices");
        }
        return nil;
    }

    NSError *optionError = nil;
    NSInteger outputSize = RNQRCodeVideoIntegerOption(options, @"size", 1024, 256, 2048, &optionError);
    NSInteger frameDurationMs = RNQRCodeVideoIntegerOption(options, @"frameDurationMs", 200, 50, 2000, &optionError);
    NSInteger bitRate = RNQRCodeVideoIntegerOption(options, @"bitRate", 4000000, 500000, 20000000, &optionError);
    NSInteger tailFrames = RNQRCodeVideoIntegerOption(options, @"tailFrames", 2, 0, 30, &optionError);
    NSInteger quietZoneModules = RNQRCodeVideoIntegerOption(options, @"quietZoneModules", 4, 0, 16, &optionError);
    if (optionError != nil) {
        if (error != NULL) {
            *error = optionError;
        }
        return nil;
    }
    if ((outputSize & 1) != 0) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"invalid-input", @"size must be even");
        }
        return nil;
    }

    NSURL *outputURL = RNQRCodeVideoFileURL(options[@"outputPath"], error);
    if (outputURL == nil) {
        return nil;
    }
    if (![outputURL.pathExtension.lowercaseString isEqualToString:@"mp4"]) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"invalid-input", @"outputPath must end with .mp4");
        }
        return nil;
    }

    NSFileManager *fileManager = NSFileManager.defaultManager;
    NSURL *parentURL = outputURL.URLByDeletingLastPathComponent;
    if (![fileManager createDirectoryAtURL:parentURL
               withIntermediateDirectories:YES
                                attributes:nil
                                     error:error]) {
        return nil;
    }
    if ([fileManager fileExistsAtPath:outputURL.path]) {
        if (![fileManager removeItemAtURL:outputURL error:error]) {
            return nil;
        }
    }

    AVAssetWriter *writer = [AVAssetWriter assetWriterWithURL:outputURL
                                                     fileType:AVFileTypeMPEG4
                                                        error:error];
    if (writer == nil) {
        return nil;
    }
    NSDictionary *compressionProperties = @{
        AVVideoAverageBitRateKey: @(bitRate),
        AVVideoExpectedSourceFrameRateKey: @(RNQRCodeVideoFrameRate),
        AVVideoMaxKeyFrameIntervalKey: @(RNQRCodeVideoFrameRate),
        AVVideoProfileLevelKey: AVVideoProfileLevelH264BaselineAutoLevel,
        AVVideoAllowFrameReorderingKey: @NO,
    };
    NSDictionary *videoSettings = @{
        AVVideoCodecKey: AVVideoCodecTypeH264,
        AVVideoWidthKey: @(outputSize),
        AVVideoHeightKey: @(outputSize),
        AVVideoCompressionPropertiesKey: compressionProperties,
    };
    AVAssetWriterInput *writerInput = [AVAssetWriterInput assetWriterInputWithMediaType:AVMediaTypeVideo
                                                                         outputSettings:videoSettings];
    writerInput.expectsMediaDataInRealTime = NO;
    NSDictionary *pixelBufferAttributes = @{
        (NSString *)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_32BGRA),
        (NSString *)kCVPixelBufferWidthKey: @(outputSize),
        (NSString *)kCVPixelBufferHeightKey: @(outputSize),
        (NSString *)kCVPixelBufferIOSurfacePropertiesKey: @{},
    };
    AVAssetWriterInputPixelBufferAdaptor *adaptor =
        [AVAssetWriterInputPixelBufferAdaptor
            assetWriterInputPixelBufferAdaptorWithAssetWriterInput:writerInput
                                       sourcePixelBufferAttributes:pixelBufferAttributes];
    if (![writer canAddInput:writerInput]) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"writer", @"The device cannot encode the QR video format");
        }
        return nil;
    }
    [writer addInput:writerInput];
    if (![writer startWriting]) {
        if (error != NULL) {
            *error = writer.error ?: RNQRCodeVideoError(@"writer", @"Unable to start the QR video encoder");
        }
        return nil;
    }
    [writer startSessionAtSourceTime:kCMTimeZero];

    NSInteger repeatsPerMatrix = MAX(
        1,
        (NSInteger)llround((double)frameDurationMs * RNQRCodeVideoFrameRate / 1000.0)
    );
    __block int64_t videoFrameIndex = 0;
    CVPixelBufferRef lastPixelBuffer = NULL;
    BOOL succeeded = YES;
    for (NSUInteger frameIndex = 0; frameIndex < frames.count; frameIndex += 1) {
        @autoreleasepool {
            if (RNQRCodeVideoIsCancelled(jobId)) {
                succeeded = NO;
                if (error != NULL) {
                    *error = RNQRCodeVideoError(@"cancelled", @"QR video job was cancelled");
                }
                break;
            }
            id frameValue = frames[frameIndex];
            if (![frameValue isKindOfClass:[NSDictionary class]]) {
                succeeded = NO;
                if (error != NULL) {
                    *error = RNQRCodeVideoError(@"invalid-input", @"A QR matrix entry is invalid");
                }
                break;
            }
            NSDictionary *frame = frameValue;
            id matrixSizeValue = frame[@"size"];
            id base64DataValue = frame[@"data"];
            if (
                ![matrixSizeValue respondsToSelector:@selector(integerValue)] ||
                ![base64DataValue isKindOfClass:[NSString class]]
            ) {
                succeeded = NO;
                if (error != NULL) {
                    *error = RNQRCodeVideoError(@"invalid-input", @"A QR matrix entry is invalid");
                }
                break;
            }
            NSInteger matrixSize = [matrixSizeValue integerValue];
            NSString *base64Data = base64DataValue;
            if (
                matrixSize < 21 ||
                matrixSize > 177 ||
                base64Data.length == 0
            ) {
                succeeded = NO;
                if (error != NULL) {
                    *error = RNQRCodeVideoError(@"invalid-input", @"A QR matrix entry is invalid");
                }
                break;
            }
            NSData *bits = [[NSData alloc]
                initWithBase64EncodedString:base64Data
                                    options:0];
            NSUInteger expectedLength = (matrixSize * matrixSize + 7) / 8;
            if (bits == nil || bits.length != expectedLength) {
                succeeded = NO;
                if (error != NULL) {
                    *error = RNQRCodeVideoError(@"invalid-input", @"A QR matrix data length is invalid");
                }
                break;
            }

            CVPixelBufferRef pixelBuffer = RNQRCodeVideoCreatePixelBuffer(
                outputSize,
                matrixSize,
                bits,
                quietZoneModules,
                error
            );
            if (pixelBuffer == NULL) {
                succeeded = NO;
                break;
            }
            if (lastPixelBuffer != NULL) {
                CVPixelBufferRelease(lastPixelBuffer);
            }
            lastPixelBuffer = pixelBuffer;

            for (NSInteger repeat = 0; repeat < repeatsPerMatrix; repeat += 1) {
                while (!writerInput.readyForMoreMediaData) {
                    if (RNQRCodeVideoIsCancelled(jobId)) {
                        succeeded = NO;
                        if (error != NULL) {
                            *error = RNQRCodeVideoError(@"cancelled", @"QR video job was cancelled");
                        }
                        break;
                    }
                    if (writer.status == AVAssetWriterStatusFailed) {
                        succeeded = NO;
                        if (error != NULL) {
                            *error = writer.error ?: RNQRCodeVideoError(@"writer", @"QR video encoding failed");
                        }
                        break;
                    }
                    [NSThread sleepForTimeInterval:0.001];
                }
                if (!succeeded) {
                    break;
                }
                CMTime presentationTime = CMTimeMake(videoFrameIndex, (int32_t)RNQRCodeVideoFrameRate);
                if (![adaptor appendPixelBuffer:pixelBuffer withPresentationTime:presentationTime]) {
                    succeeded = NO;
                    if (error != NULL) {
                        *error = writer.error ?: RNQRCodeVideoError(@"writer", @"Unable to append a QR video frame");
                    }
                    break;
                }
                videoFrameIndex += 1;
            }
            if (!succeeded) {
                break;
            }
        }
    }

    NSInteger tailVideoFrames = tailFrames * repeatsPerMatrix;
    for (
        NSInteger tailIndex = 0;
        succeeded && tailIndex < tailVideoFrames && lastPixelBuffer != NULL;
        tailIndex += 1
    ) {
        while (!writerInput.readyForMoreMediaData) {
            if (RNQRCodeVideoIsCancelled(jobId)) {
                succeeded = NO;
                if (error != NULL) {
                    *error = RNQRCodeVideoError(@"cancelled", @"QR video job was cancelled");
                }
                break;
            }
            if (writer.status == AVAssetWriterStatusFailed) {
                succeeded = NO;
                if (error != NULL) {
                    *error = writer.error ?: RNQRCodeVideoError(@"writer", @"QR video encoding failed");
                }
                break;
            }
            [NSThread sleepForTimeInterval:0.001];
        }
        if (!succeeded) {
            break;
        }
        CMTime presentationTime = CMTimeMake(videoFrameIndex, (int32_t)RNQRCodeVideoFrameRate);
        if (![adaptor appendPixelBuffer:lastPixelBuffer withPresentationTime:presentationTime]) {
            succeeded = NO;
            if (error != NULL) {
                *error = writer.error ?: RNQRCodeVideoError(@"writer", @"Unable to append a QR video tail frame");
            }
            break;
        }
        videoFrameIndex += 1;
    }

    if (lastPixelBuffer != NULL) {
        CVPixelBufferRelease(lastPixelBuffer);
    }
    if (!succeeded) {
        [writer cancelWriting];
        [fileManager removeItemAtURL:outputURL error:nil];
        return nil;
    }

    [writerInput markAsFinished];
    dispatch_semaphore_t completionSemaphore = dispatch_semaphore_create(0);
    [writer finishWritingWithCompletionHandler:^{
        dispatch_semaphore_signal(completionSemaphore);
    }];
    dispatch_semaphore_wait(completionSemaphore, DISPATCH_TIME_FOREVER);
    if (writer.status != AVAssetWriterStatusCompleted) {
        if (error != NULL) {
            *error = writer.error ?: RNQRCodeVideoError(@"writer", @"Unable to finalize the QR video");
        }
        [fileManager removeItemAtURL:outputURL error:nil];
        return nil;
    }
    if (RNQRCodeVideoIsCancelled(jobId)) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"cancelled", @"QR video job was cancelled");
        }
        [fileManager removeItemAtURL:outputURL error:nil];
        return nil;
    }
    return outputURL.path;
}

static NSArray<NSString *> *RNQRCodeVideoDecode(
    NSString *uriValue,
    NSDictionary *options,
    NSString *jobId,
    NSError **error
) {
    NSURL *videoURL = RNQRCodeVideoFileURL(uriValue, error);
    if (videoURL == nil) {
        return nil;
    }
    if (!RNQRCodeVideoEnforceFileSizeLimit(videoURL, error)) {
        return nil;
    }
    NSError *optionError = nil;
    NSInteger sampleIntervalMs = RNQRCodeVideoIntegerOption(options, @"sampleIntervalMs", 100, 40, 1000, &optionError);
    NSInteger maxDurationSeconds = RNQRCodeVideoIntegerOption(options, @"maxDurationSeconds", 381, 1, 1800, &optionError);
    NSInteger maxDimension = RNQRCodeVideoIntegerOption(options, @"maxDimension", 1280, 256, 2048, &optionError);
    if (optionError != nil) {
        if (error != NULL) {
            *error = optionError;
        }
        return nil;
    }

    AVURLAsset *asset = [AVURLAsset URLAssetWithURL:videoURL options:nil];
    NSTimeInterval durationSeconds = CMTimeGetSeconds(asset.duration);
    if (
        !isfinite(durationSeconds) ||
        durationSeconds <= 0 ||
        durationSeconds > maxDurationSeconds
    ) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"invalid-video", @"Video duration is invalid or exceeds the limit");
        }
        return nil;
    }
    AVAssetTrack *videoTrack = [asset tracksWithMediaType:AVMediaTypeVideo].firstObject;
    if (videoTrack == nil) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"invalid-video", @"The selected file has no video track");
        }
        return nil;
    }
    if (!RNQRCodeVideoValidateTrackDimensions(videoTrack, maxDimension, error)) {
        return nil;
    }

    AVAssetReader *reader = [AVAssetReader assetReaderWithAsset:asset error:error];
    if (reader == nil) {
        return nil;
    }
    NSDictionary *outputSettings = @{
        (NSString *)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_32BGRA),
    };
    AVAssetReaderTrackOutput *trackOutput = [AVAssetReaderTrackOutput
        assetReaderTrackOutputWithTrack:videoTrack
                         outputSettings:outputSettings];
    trackOutput.alwaysCopiesSampleData = NO;
    if (![reader canAddOutput:trackOutput]) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"reader", @"The video track cannot be decoded");
        }
        return nil;
    }
    [reader addOutput:trackOutput];
    if (![reader startReading]) {
        if (error != NULL) {
            *error = reader.error ?: RNQRCodeVideoError(@"reader", @"Unable to start decoding the video");
        }
        return nil;
    }

    CIContext *ciContext = [CIContext contextWithOptions:@{kCIContextUseSoftwareRenderer: @NO}];
    NSMutableOrderedSet<NSString *> *decodedValues = [NSMutableOrderedSet orderedSet];
    NSMutableIndexSet *originalParts = [NSMutableIndexSet indexSet];
    NSInteger expectedOriginalPartCount = 0;
    BOOL originalPartsComplete = NO;
    double nextSampleMs = MIN(sampleIntervalMs / 2.0, durationSeconds * 1000.0 - 1.0);
    CMSampleBufferRef sampleBuffer = NULL;
    while (
        !originalPartsComplete &&
        (sampleBuffer = [trackOutput copyNextSampleBuffer]) != NULL
    ) {
        @autoreleasepool {
            if (RNQRCodeVideoIsCancelled(jobId)) {
                CFRelease(sampleBuffer);
                [reader cancelReading];
                if (error != NULL) {
                    *error = RNQRCodeVideoError(@"cancelled", @"QR video job was cancelled");
                }
                return nil;
            }
            CMTime presentationTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer);
            double presentationMs = CMTimeGetSeconds(presentationTime) * 1000.0;
            if (isfinite(presentationMs) && presentationMs + 0.01 >= nextSampleMs) {
                CVImageBufferRef imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer);
                if (imageBuffer != NULL) {
                    size_t frameWidth = CVPixelBufferGetWidth(imageBuffer);
                    size_t frameHeight = CVPixelBufferGetHeight(imageBuffer);
                    if (
                        frameWidth == 0 ||
                        frameHeight == 0 ||
                        frameWidth > (size_t)maxDimension ||
                        frameHeight > (size_t)maxDimension
                    ) {
                        CFRelease(sampleBuffer);
                        [reader cancelReading];
                        if (error != NULL) {
                            *error = RNQRCodeVideoError(
                                @"invalid-video",
                                @"Decoded video dimensions are invalid or exceed the limit"
                            );
                        }
                        return nil;
                    }
                    CIImage *image = [CIImage imageWithCVPixelBuffer:imageBuffer];
                    CGRect extent = image.extent;
                    CGFloat largestDimension = MAX(CGRectGetWidth(extent), CGRectGetHeight(extent));
                    CGFloat scale = largestDimension > maxDimension
                        ? (CGFloat)maxDimension / largestDimension
                        : 1.0;
                    CIImage *scaledImage = scale < 1.0
                        ? [image imageByApplyingTransform:CGAffineTransformMakeScale(scale, scale)]
                        : image;
                    CGRect scaledExtent = scaledImage.extent;
                    CGImageRef cgImage = [ciContext createCGImage:scaledImage fromRect:scaledExtent];
                    if (cgImage != NULL) {
                        VNDetectBarcodesRequest *request = [VNDetectBarcodesRequest new];
                        request.symbologies = @[VNBarcodeSymbologyQR];
                        VNImageRequestHandler *handler = [[VNImageRequestHandler alloc]
                            initWithCGImage:cgImage
                                   options:@{}];
                        NSError *visionError = nil;
                        if ([handler performRequests:@[request] error:&visionError]) {
                            for (VNBarcodeObservation *observation in request.results) {
                                NSString *value = observation.payloadStringValue;
                                if (value.length == 0 || value.length > 4096) {
                                    continue;
                                }
                                BOOL added = ![decodedValues containsObject:value];
                                if (added) {
                                    [decodedValues addObject:value];
                                }
                                if (decodedValues.count > RNQRCodeVideoMaxDecodedValues) {
                                    CGImageRelease(cgImage);
                                    CFRelease(sampleBuffer);
                                    [reader cancelReading];
                                    if (error != NULL) {
                                        *error = RNQRCodeVideoError(@"invalid-video", @"Video contains too many QR codes");
                                    }
                                    return nil;
                                }
                                if (
                                    added &&
                                    RNQRCodeVideoRecordOriginalURPart(
                                        value,
                                        &expectedOriginalPartCount,
                                        originalParts
                                    )
                                ) {
                                    originalPartsComplete = YES;
                                    break;
                                }
                            }
                        }
                        CGImageRelease(cgImage);
                    }
                }
                do {
                    nextSampleMs += sampleIntervalMs;
                } while (nextSampleMs <= presentationMs);
            }
            CFRelease(sampleBuffer);
        }
    }

    if (originalPartsComplete) {
        [reader cancelReading];
    }
    if (reader.status == AVAssetReaderStatusFailed) {
        if (error != NULL) {
            *error = reader.error ?: RNQRCodeVideoError(@"reader", @"Video decoding failed");
        }
        return nil;
    }
    if (RNQRCodeVideoIsCancelled(jobId)) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"cancelled", @"QR video job was cancelled");
        }
        return nil;
    }
    return decodedValues.array;
}

static NSString *RNVideoFilePickerExtension(NSURL *sourceURL, UTType *contentType) {
    NSString *extension = sourceURL.pathExtension.lowercaseString;
    NSCharacterSet *invalidCharacters = NSCharacterSet.alphanumericCharacterSet.invertedSet;
    if (
        extension.length == 0 ||
        extension.length > 10 ||
        [extension rangeOfCharacterFromSet:invalidCharacters].location != NSNotFound
    ) {
        extension = contentType.preferredFilenameExtension.lowercaseString;
    }
    if (
        extension.length == 0 ||
        extension.length > 10 ||
        [extension rangeOfCharacterFromSet:invalidCharacters].location != NSNotFound
    ) {
        extension = @"mp4";
    }
    return [@"." stringByAppendingString:extension];
}

static NSDictionary *RNCopyPickedVideoFile(
    NSURL *sourceURL,
    NSProgress *cancellation,
    NSError **error
) {
    NSNumber *declaredSize = nil;
    UTType *contentType = nil;
    [sourceURL getResourceValue:&declaredSize forKey:NSURLFileSizeKey error:nil];
    [sourceURL getResourceValue:&contentType forKey:NSURLContentTypeKey error:nil];
    if (
        [declaredSize respondsToSelector:@selector(unsignedLongLongValue)] &&
        declaredSize.unsignedLongLongValue > RNQRCodeVideoMaxFileSizeBytes
    ) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"invalid-video", @"Video exceeds the 200 MiB size limit");
        }
        return nil;
    }
    if (
        contentType != nil &&
        ![contentType conformsToType:UTTypeMovie]
    ) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"invalid-video", @"The selected file is not a video");
        }
        return nil;
    }

    NSFileManager *fileManager = NSFileManager.defaultManager;
    NSURL *cacheDirectory = [[fileManager URLsForDirectory:NSCachesDirectory
                                                 inDomains:NSUserDomainMask] firstObject];
    if (cacheDirectory == nil) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"file-picker", @"The video import cache is unavailable");
        }
        return nil;
    }
    cacheDirectory = [cacheDirectory URLByAppendingPathComponent:@"sync-transfer-imports"
                                                      isDirectory:YES];
    NSError *directoryError = nil;
    if (![fileManager createDirectoryAtURL:cacheDirectory
               withIntermediateDirectories:YES
                                attributes:nil
                                     error:&directoryError]) {
        if (error != NULL) {
            *error = directoryError;
        }
        return nil;
    }

    NSArray<NSURLResourceKey> *cleanupKeys = @[
        NSURLContentModificationDateKey,
        NSURLIsRegularFileKey,
    ];
    NSArray<NSURL *> *cachedFiles = [fileManager contentsOfDirectoryAtURL:cacheDirectory
                                                includingPropertiesForKeys:cleanupKeys
                                                                   options:NSDirectoryEnumerationSkipsHiddenFiles
                                                                     error:nil];
    NSDate *now = NSDate.date;
    for (NSURL *cachedFile in cachedFiles) {
        NSNumber *isRegularFile = nil;
        NSDate *modificationDate = nil;
        [cachedFile getResourceValue:&isRegularFile forKey:NSURLIsRegularFileKey error:nil];
        [cachedFile getResourceValue:&modificationDate
                              forKey:NSURLContentModificationDateKey
                               error:nil];
        if (
            isRegularFile.boolValue &&
            modificationDate != nil &&
            [now timeIntervalSinceDate:modificationDate] > RNVideoFilePickerMaxCacheAgeSeconds
        ) {
            [fileManager removeItemAtURL:cachedFile error:nil];
        }
    }

    NSString *extension = RNVideoFilePickerExtension(sourceURL, contentType);
    NSURL *outputURL = [cacheDirectory URLByAppendingPathComponent:
        [NSUUID.UUID.UUIDString stringByAppendingString:extension]];
    NSInputStream *input = [NSInputStream inputStreamWithURL:sourceURL];
    NSOutputStream *output = [NSOutputStream outputStreamWithURL:outputURL append:NO];
    if (input == nil || output == nil) {
        if (error != NULL) {
            *error = RNQRCodeVideoError(@"file-picker", @"Unable to open the selected video");
        }
        return nil;
    }

    [input open];
    [output open];
    uint8_t buffer[64 * 1024];
    unsigned long long copiedBytes = 0;
    BOOL succeeded = YES;
    NSError *copyError = nil;
    while (succeeded) {
        if (cancellation.cancelled) {
            copyError = RNQRCodeVideoError(@"cancelled", @"Video file selection was cancelled");
            succeeded = NO;
            break;
        }
        NSInteger readCount = [input read:buffer maxLength:sizeof(buffer)];
        if (readCount < 0) {
            copyError = input.streamError ?: RNQRCodeVideoError(
                @"file-picker",
                @"Unable to read the selected video"
            );
            succeeded = NO;
            break;
        }
        if (readCount == 0) {
            break;
        }
        copiedBytes += (unsigned long long)readCount;
        if (copiedBytes > RNQRCodeVideoMaxFileSizeBytes) {
            copyError = RNQRCodeVideoError(@"invalid-video", @"Video exceeds the 200 MiB size limit");
            succeeded = NO;
            break;
        }
        NSInteger offset = 0;
        while (offset < readCount) {
            if (cancellation.cancelled) {
                copyError = RNQRCodeVideoError(@"cancelled", @"Video file selection was cancelled");
                succeeded = NO;
                break;
            }
            NSInteger written = [output write:&buffer[offset]
                                    maxLength:(NSUInteger)(readCount - offset)];
            if (written <= 0) {
                copyError = output.streamError ?: RNQRCodeVideoError(
                    @"file-picker",
                    @"Unable to cache the selected video"
                );
                succeeded = NO;
                break;
            }
            offset += written;
        }
    }
    [input close];
    [output close];

    if (!succeeded || copiedBytes == 0) {
        [fileManager removeItemAtURL:outputURL error:nil];
        if (error != NULL) {
            *error = copyError ?: RNQRCodeVideoError(@"invalid-video", @"The selected video is empty");
        }
        return nil;
    }

    NSString *fileName = sourceURL.lastPathComponent.length > 0
        ? sourceURL.lastPathComponent
        : @"wallet-transfer-video.mp4";
    NSString *mimeType = contentType.preferredMIMEType ?: @"video/mp4";
    return @{
        @"uri": outputURL.absoluteString,
        @"cleanupPath": outputURL.path,
        @"fileName": fileName,
        @"fileSize": @(copiedBytes),
        @"type": mimeType,
    };
}

@interface RNFileHelpers () <
    UIDocumentPickerDelegate,
    UIAdaptivePresentationControllerDelegate
>
@property(nonatomic, copy) RCTPromiseResolveBlock pendingVideoFilePickerResolve;
@property(nonatomic, copy) RCTPromiseRejectBlock pendingVideoFilePickerReject;
@property(nonatomic, copy) NSString *pendingVideoFilePickerGeneration;
@property(nonatomic, strong) NSProgress *pendingVideoFilePickerCancellation;
@property(nonatomic, strong) UIDocumentPickerViewController *pendingVideoFilePickerController;
@end

@implementation RNFileHelpers

RCT_EXPORT_MODULE();

- (void)clearPendingVideoFilePicker {
    self.pendingVideoFilePickerResolve = nil;
    self.pendingVideoFilePickerReject = nil;
    self.pendingVideoFilePickerGeneration = nil;
    self.pendingVideoFilePickerCancellation = nil;
    self.pendingVideoFilePickerController = nil;
}

- (void)finishVideoFilePickerWithResult:(NSDictionary *)result {
    RCTPromiseResolveBlock resolve = self.pendingVideoFilePickerResolve;
    if (result == nil) {
        [self.pendingVideoFilePickerCancellation cancel];
    }
    [self clearPendingVideoFilePicker];
    if (resolve != nil) {
        resolve(result);
    }
}

- (void)finishVideoFilePickerWithCode:(NSString *)code error:(NSError *)error {
    RCTPromiseRejectBlock reject = self.pendingVideoFilePickerReject;
    [self.pendingVideoFilePickerCancellation cancel];
    [self clearPendingVideoFilePicker];
    if (reject != nil) {
        reject(code, error.localizedDescription ?: @"Unable to select the video file", error);
    }
}

RCT_EXPORT_METHOD(pickVideoFile:
  (RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
) {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (self.pendingVideoFilePickerResolve != nil) {
            reject(
                @"E_VIDEO_FILE_PICKER_IN_PROGRESS",
                @"Another video file picker is already in progress",
                nil
            );
            return;
        }

        UIViewController *controller = RCTPresentedViewController();
        if (controller == nil) {
            controller = RCTKeyWindow().rootViewController;
        }
        if (controller == nil) {
            reject(
                @"E_VIDEO_FILE_PICKER_ACTIVITY",
                @"Current iOS view controller is not available",
                nil
            );
            return;
        }

        UIDocumentPickerViewController *picker = [[UIDocumentPickerViewController alloc]
            initForOpeningContentTypes:@[UTTypeMovie]
                             asCopy:NO];
        picker.delegate = self;
        picker.allowsMultipleSelection = NO;
        picker.modalPresentationStyle = UIModalPresentationFullScreen;

        self.pendingVideoFilePickerResolve = resolve;
        self.pendingVideoFilePickerReject = reject;
        self.pendingVideoFilePickerGeneration = NSUUID.UUID.UUIDString;
        self.pendingVideoFilePickerCancellation = [NSProgress progressWithTotalUnitCount:1];
        self.pendingVideoFilePickerCancellation.cancellable = YES;
        self.pendingVideoFilePickerController = picker;

        [controller presentViewController:picker animated:YES completion:^{
            picker.presentationController.delegate = self;
        }];
    });
}

RCT_EXPORT_METHOD(cancelVideoFilePicker) {
    dispatch_async(dispatch_get_main_queue(), ^{
        UIDocumentPickerViewController *picker = self.pendingVideoFilePickerController;
        if (picker != nil && picker.presentingViewController != nil) {
            [picker dismissViewControllerAnimated:YES completion:nil];
        }
        [self finishVideoFilePickerWithResult:nil];
    });
}

- (void)documentPickerWasCancelled:(UIDocumentPickerViewController *)controller {
    if (controller != self.pendingVideoFilePickerController) {
        return;
    }
    [self finishVideoFilePickerWithResult:nil];
}

- (void)documentPicker:(UIDocumentPickerViewController *)controller
    didPickDocumentsAtURLs:(NSArray<NSURL *> *)urls {
    if (controller != self.pendingVideoFilePickerController) {
        return;
    }
    NSURL *sourceURL = urls.firstObject;
    if (sourceURL == nil) {
        [self finishVideoFilePickerWithCode:@"E_VIDEO_FILE_PICKER_INVALID_RESULT"
                                      error:RNQRCodeVideoError(
                                          @"file-picker",
                                          @"The selected video file is unavailable"
                                      )];
        return;
    }

    NSString *generation = self.pendingVideoFilePickerGeneration;
    NSProgress *cancellation = self.pendingVideoFilePickerCancellation;
    self.pendingVideoFilePickerController = nil;
    BOOL accessedSecurityScopedResource = [sourceURL startAccessingSecurityScopedResource];
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        @autoreleasepool {
            NSError *coordinatorError = nil;
            __block NSError *copyError = nil;
            __block NSDictionary *result = nil;
            NSFileCoordinator *coordinator = [[NSFileCoordinator alloc] initWithFilePresenter:nil];
            [coordinator coordinateReadingItemAtURL:sourceURL
                                            options:0
                                              error:&coordinatorError
                                         byAccessor:^(NSURL *newURL) {
                                             result = RNCopyPickedVideoFile(
                                                 newURL,
                                                 cancellation,
                                                 &copyError
                                             );
                                         }];
            if (accessedSecurityScopedResource) {
                [sourceURL stopAccessingSecurityScopedResource];
            }
            NSError *operationError = copyError ?: coordinatorError;
            dispatch_async(dispatch_get_main_queue(), ^{
                if (
                    generation.length == 0 ||
                    ![generation isEqualToString:self.pendingVideoFilePickerGeneration] ||
                    cancellation.cancelled
                ) {
                    NSString *cleanupPath = result[@"cleanupPath"];
                    if (cleanupPath.length > 0) {
                        [NSFileManager.defaultManager removeItemAtPath:cleanupPath error:nil];
                    }
                    return;
                }
                if (result == nil) {
                    [self finishVideoFilePickerWithCode:@"E_VIDEO_FILE_PICKER_COPY"
                                                  error:operationError ?: RNQRCodeVideoError(
                                                      @"file-picker",
                                                      @"Unable to cache the selected video"
                                                  )];
                    return;
                }
                [self finishVideoFilePickerWithResult:result];
            });
        }
    });
}

- (void)presentationControllerDidDismiss:(UIPresentationController *)presentationController {
    if (presentationController.presentedViewController != self.pendingVideoFilePickerController) {
        return;
    }
    [self finishVideoFilePickerWithResult:nil];
}

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

RCT_EXPORT_METHOD(createQRCodeVideo:
  (NSDictionary *)request
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
) {
    if (![request isKindOfClass:[NSDictionary class]]) {
        reject(@"E_QR_VIDEO_INVALID_INPUT", @"QR video request is required", nil);
        return;
    }
    NSError *jobError = nil;
    NSString *jobId = RNQRCodeVideoJobId(request, &jobError);
    if (jobId == nil) {
        reject(@"E_QR_VIDEO_INVALID_INPUT", jobError.localizedDescription, jobError);
        return;
    }
    if (!RNQRCodeVideoRegisterJob(jobId)) {
        reject(@"E_QR_VIDEO_IN_PROGRESS", @"A QR video job with the same jobId is already running", nil);
        return;
    }
    NSArray *frames = request[@"frames"];
    NSDictionary *options = [request copy];
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        @autoreleasepool {
            NSError *error = nil;
            NSString *path = RNQRCodeVideoCreate(frames, options, jobId, &error);
            RNQRCodeVideoFinishJob(jobId);
            if (path == nil) {
                NSString *code = [error.domain containsString:@"cancelled"]
                    ? @"E_QR_VIDEO_CANCELLED"
                    : @"E_QR_VIDEO_ENCODE";
                reject(code, error.localizedDescription ?: @"QR video encoding failed", error);
                return;
            }
            resolve(path);
        }
    });
}

RCT_EXPORT_METHOD(decodeQRCodesFromVideo:
  (NSDictionary *)request
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
) {
    if (![request isKindOfClass:[NSDictionary class]]) {
        reject(@"E_QR_VIDEO_INVALID_INPUT", @"QR video request is required", nil);
        return;
    }
    NSString *uri = request[@"uri"];
    if (![uri isKindOfClass:[NSString class]] || uri.length == 0) {
        reject(@"E_QR_VIDEO_INVALID_INPUT", @"Video URI is required", nil);
        return;
    }
    NSError *jobError = nil;
    NSString *jobId = RNQRCodeVideoJobId(request, &jobError);
    if (jobId == nil) {
        reject(@"E_QR_VIDEO_INVALID_INPUT", jobError.localizedDescription, jobError);
        return;
    }
    if (!RNQRCodeVideoRegisterJob(jobId)) {
        reject(@"E_QR_VIDEO_IN_PROGRESS", @"A QR video job with the same jobId is already running", nil);
        return;
    }
    NSDictionary *options = [request copy];
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        @autoreleasepool {
            NSError *error = nil;
            NSArray<NSString *> *values = RNQRCodeVideoDecode(uri, options, jobId, &error);
            RNQRCodeVideoFinishJob(jobId);
            if (values == nil) {
                NSString *code = [error.domain containsString:@"cancelled"]
                    ? @"E_QR_VIDEO_CANCELLED"
                    : @"E_QR_VIDEO_DECODE";
                reject(code, error.localizedDescription ?: @"QR video decoding failed", error);
                return;
            }
            resolve(values);
        }
    });
}

RCT_EXPORT_METHOD(cancelQRCodeVideoJob:(NSString *)jobId) {
    RNQRCodeVideoCancelJob(jobId);
}

- (void)invalidate {
    dispatch_async(dispatch_get_main_queue(), ^{
        UIDocumentPickerViewController *picker = self.pendingVideoFilePickerController;
        if (picker != nil && picker.presentingViewController != nil) {
            [picker dismissViewControllerAnimated:NO completion:nil];
        }
        [self finishVideoFilePickerWithResult:nil];
    });
}

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

@end
