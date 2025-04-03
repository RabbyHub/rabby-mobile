// RNHelpers.mm
#import "RNHelpers.h"
#import <Foundation/Foundation.h>

@implementation RNHelpers

// To export a module named RNHelpers
RCT_EXPORT_MODULE();

#pragma mark - Public API
RCT_EXPORT_METHOD(forceExitApp) {
    exit(0);
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
