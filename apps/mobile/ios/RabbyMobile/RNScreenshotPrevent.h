#import <UIKit/UIKit.h>
#import "RabbyMobile-Swift.h"

#if RCT_NEW_ARCH_ENABLED
#import <RabbyMobileSpec/RabbyMobileSpec.h>

@interface RNScreenshotPrevent : NativeRNScreenshotPreventSpecBase <NativeRNScreenshotPreventSpec>

@end
#else
#import <React/RCTBridgeModule.h>
#import <React/RCTConvert.h>
#import <React/RCTEventEmitter.h>

@interface RNScreenshotPrevent : RCTEventEmitter <RCTBridgeModule>

@end
#endif
