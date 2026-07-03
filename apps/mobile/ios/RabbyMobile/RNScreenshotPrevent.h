#import <React/RCTBridgeModule.h>
#import <React/RCTConvert.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <RabbyMobileSpec/RabbyMobileSpec.h>
#else
#import <React/RCTEventEmitter.h>
#endif
#import "RabbyMobile-Swift.h"

#ifdef RCT_NEW_ARCH_ENABLED
@interface RNScreenshotPrevent
    : NativeRNScreenshotPreventSpecBase <NativeRNScreenshotPreventSpec>
#else
@interface RNScreenshotPrevent : RCTEventEmitter <RCTBridgeModule>
#endif

@end
