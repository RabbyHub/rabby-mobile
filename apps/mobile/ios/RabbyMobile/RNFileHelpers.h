//  RNFileHelpers.h
#if __has_include("RCTBridgeModule.h")
#import "RCTBridgeModule.h"
#else
#import <React/RCTBridgeModule.h>
#endif

@interface RNFileHelpers : NSObject <RCTBridgeModule>
@end
