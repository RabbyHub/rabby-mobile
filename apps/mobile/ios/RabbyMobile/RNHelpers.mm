// RNHelpers.mm
#import "RNHelpers.h"
#import <CoreImage/CoreImage.h>
#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>
#import <UIKit/UIKit.h>
#import <Vision/Vision.h>

static const NSUInteger RNHelpersMaxQRCodePayloads = 10;

static NSArray<NSString *> *RNHelpersDetectQRCodesWithVision(CGImageRef image, CGImagePropertyOrientation orientation) {
    VNDetectBarcodesRequest *request = [[VNDetectBarcodesRequest alloc] init];
    request.symbologies = @[VNBarcodeSymbologyQR];
    VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithCGImage:image
                                                                        orientation:orientation
                                                                            options:@{}];
    if (![handler performRequests:@[request] error:nil]) {
        return nil;
    }

    NSMutableOrderedSet<NSString *> *payloads = [NSMutableOrderedSet orderedSet];
    for (VNBarcodeObservation *observation in request.results) {
        NSString *payload = observation.payloadStringValue;
        if (payload.length > 0) {
            [payloads addObject:payload];
        }
        if (payloads.count >= RNHelpersMaxQRCodePayloads) {
            break;
        }
    }
    return payloads.array;
}

// Vision can fail on some simulators; CIDetector keeps decoding available there.
static NSArray<NSString *> *RNHelpersDetectQRCodesWithCIDetector(CGImageRef image, CGImagePropertyOrientation orientation) {
    CIDetector *detector = [CIDetector detectorOfType:CIDetectorTypeQRCode
                                              context:nil
                                              options:@{CIDetectorAccuracy: CIDetectorAccuracyHigh}];
    CIImage *ciImage = [[CIImage imageWithCGImage:image] imageByApplyingOrientation:orientation];
    NSMutableOrderedSet<NSString *> *payloads = [NSMutableOrderedSet orderedSet];
    for (CIFeature *feature in [detector featuresInImage:ciImage]) {
        if (![feature isKindOfClass:[CIQRCodeFeature class]]) {
            continue;
        }
        NSString *payload = ((CIQRCodeFeature *)feature).messageString;
        if (payload.length > 0) {
            [payloads addObject:payload];
        }
        if (payloads.count >= RNHelpersMaxQRCodePayloads) {
            break;
        }
    }
    return payloads.array;
}

static NSArray<NSString *> *RNHelpersDetectQRCodes(NSURL *fileURL) {
    CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)fileURL, NULL);
    if (source == NULL) {
        return nil;
    }

    CGImagePropertyOrientation orientation = kCGImagePropertyOrientationUp;
    NSDictionary *properties = CFBridgingRelease(CGImageSourceCopyPropertiesAtIndex(source, 0, NULL));
    NSNumber *orientationValue = properties[(NSString *)kCGImagePropertyOrientation];
    if (orientationValue != nil) {
        orientation = (CGImagePropertyOrientation)orientationValue.unsignedIntValue;
    }

    CGImageRef image = CGImageSourceCreateImageAtIndex(source, 0, NULL);
    CFRelease(source);
    if (image == NULL) {
        return nil;
    }

    NSArray<NSString *> *payloads = RNHelpersDetectQRCodesWithVision(image, orientation);
    if (payloads == nil) {
        payloads = RNHelpersDetectQRCodesWithCIDetector(image, orientation);
    }
    CGImageRelease(image);
    return payloads;
}

// Only remove files created inside this app's temporary directory, e.g. the
// copy react-native-image-picker writes after the user picks a photo.
static void RNHelpersRemoveTemporaryFile(NSURL *fileURL) {
    NSString *tmpPath = [[NSURL fileURLWithPath:NSTemporaryDirectory()] URLByResolvingSymlinksInPath].path;
    NSString *filePath = [fileURL URLByResolvingSymlinksInPath].path;
    if (tmpPath.length == 0 || filePath.length == 0) {
        return;
    }
    NSString *tmpPrefix = [tmpPath hasSuffix:@"/"] ? tmpPath : [tmpPath stringByAppendingString:@"/"];
    if (![filePath hasPrefix:tmpPrefix]) {
        return;
    }
    [[NSFileManager defaultManager] removeItemAtPath:filePath error:nil];
}

@implementation RNHelpers

@synthesize viewRegistry_DEPRECATED = _viewRegistry_DEPRECATED;

// To export a module named RNHelpers
RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
    return NO;
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
RCT_EXPORT_METHOD(measureViewRelativeTo:(double)anchorTag
                  viewportTag:(double)viewportTag
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(dispatch_get_main_queue(), ^{
        UIView *anchor = [self.viewRegistry_DEPRECATED viewForReactTag:@(anchorTag)];
        UIView *viewport = [self.viewRegistry_DEPRECATED viewForReactTag:@(viewportTag)];
        if (anchor == nil || viewport == nil || anchor.window == nil || viewport.window == nil) {
            reject(@"E_VIEW_UNAVAILABLE", @"Tooltip views are not mounted", nil);
            return;
        }
        CGRect rect = [anchor convertRect:anchor.bounds toView:viewport];
        resolve(@{@"x": @(rect.origin.x), @"y": @(rect.origin.y),
                  @"width": @(rect.size.width), @"height": @(rect.size.height)});
    });
}

RCT_EXPORT_METHOD(forceExitApp) {
    exit(0);
}

RCT_EXPORT_METHOD(setSensitiveClipboard:(NSString *)text
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(dispatch_get_main_queue(), ^{
        [[UIPasteboard generalPasteboard] setItems:@[@{@"public.utf8-plain-text": text}]
                                          options:@{
            UIPasteboardOptionExpirationDate: [NSDate dateWithTimeIntervalSinceNow:10 * 60]
        }];
        resolve(nil);
    });
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

RCT_EXPORT_METHOD(decodeQRCodeFromImageFile:(NSString *)fileUri
                  deleteAfterDecode:(BOOL)deleteAfterDecode
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        NSURL *fileURL = [NSURL URLWithString:fileUri];
        if (fileURL == nil || !fileURL.isFileURL) {
            reject(@"E_QRCODE_INVALID_URI", @"Image uri must be a local file", nil);
            return;
        }

        NSArray<NSString *> *payloads = nil;
        @autoreleasepool {
            payloads = RNHelpersDetectQRCodes(fileURL);
        }
        if (deleteAfterDecode) {
            RNHelpersRemoveTemporaryFile(fileURL);
        }

        if (payloads == nil) {
            reject(@"E_QRCODE_READ_IMAGE", @"Failed to read image", nil);
            return;
        }
        resolve(payloads);
    });
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
