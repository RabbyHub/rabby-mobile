#ifndef ThreadSelfModule_h
#define ThreadSelfModule_h

#import <React/RCTEventEmitter.h>
#import <React/RCTBridge.h>
#import <React/RCTBridge+Private.h>
#import <React/RCTEventDispatcher.h>

@interface ThreadSelfModule : NSObject <RCTBridgeModule>
@property int threadId;
@property RCTBridge *parentBridge;
@property RCTEventEmitter *parentModule;
@end

#endif
