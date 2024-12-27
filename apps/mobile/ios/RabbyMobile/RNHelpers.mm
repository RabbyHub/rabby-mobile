// RNHelpers.mm
#import "RNHelpers.h"

@implementation RNHelpers

// To export a module named RNHelpers
RCT_EXPORT_MODULE();

#pragma mark - Public API
RCT_EXPORT_METHOD(forceExitApp) {
    exit(0);
}
@end
