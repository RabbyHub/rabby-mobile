// ReactNativeSecurity.mm
#import "ReactNativeSecurity.h"

@implementation ReactNativeSecurity

// To export a module named ReactNativeSecurity
RCT_EXPORT_MODULE();

#pragma mark - Public API
RCT_EXPORT_METHOD(blockScreen) {
  RCTLogInfo(@"`blockScreen` hasn't been supported on iOS");
}

RCT_EXPORT_METHOD(unblockScreen) {
  RCTLogInfo(@"`unblockScreen` hasn't been supported on iOS");
}
@end
