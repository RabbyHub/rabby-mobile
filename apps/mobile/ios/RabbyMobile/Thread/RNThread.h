#ifndef ThreadManager_h
#define ThreadManager_h

#import "ThreadSelfModule.h"
#import <React/RCTBridge.h>
#import <React/RCTBridge+Private.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTEventDispatcher.h>
#import <React/RCTBundleURLProvider.h>

@interface RNThread : RCTEventEmitter <RCTBridgeModule>
@property RCTBridge *bridge;
@end

#endif
