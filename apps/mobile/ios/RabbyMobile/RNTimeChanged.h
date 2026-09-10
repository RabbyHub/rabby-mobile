//  RNTimeChanged.h
#import <UIKit/UIKit.h>

#if RCT_NEW_ARCH_ENABLED
#import <RabbyMobileSpec/RabbyMobileSpec.h>

@interface RNTimeChanged : NativeRNTimeChangedSpecBase <NativeRNTimeChangedSpec>

@end
#elif __has_include("RCTBridgeModule.h")
#import "RCTBridgeModule.h"
#import "RCTConvert.h"
#import "RCTEventEmitter.h"

@interface RNTimeChanged : RCTEventEmitter <RCTBridgeModule>
@end
#else
#import <React/RCTBridgeModule.h>
#import <React/RCTConvert.h>
#import <React/RCTEventEmitter.h>

@interface RNTimeChanged : RCTEventEmitter <RCTBridgeModule>
@end
#endif
