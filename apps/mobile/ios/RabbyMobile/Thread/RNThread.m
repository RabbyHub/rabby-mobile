#import "RNThread.h"
#include <stdlib.h>

#import "AppDelegate.h"
#include "RNUtils.h"
#import <React/RCTJavaScriptLoader.h>
#import <React/RCTLog.h>

@interface RNThreadRuntime : NSObject
@property(nonatomic, strong) RCTBridge *bridge;
@property(nonatomic, strong) RCTRootViewFactory *rootViewFactory;
@end

@implementation RNThreadRuntime
@end

@implementation RNThread

// @synthesize bridge = _bridge;

NSMutableDictionary<NSNumber *, RNThreadRuntime *> *threads;

RCT_EXPORT_MODULE();
- (NSArray<NSString *> *)supportedEvents {
    return @[
      @"DevThreadMessage",
      @"msgFromThread",
      @"@ThreadStarted",
      @"@ThreadStopped"
    ];
}

- (dispatch_queue_t)methodQueue
{
    return dispatch_get_main_queue();
}

+(BOOL) requiresMainQueueSetup
{
  return FALSE;
}

- (void)invalidate {
  if (threads == nil) {
    return;
  }

  for (RNThreadRuntime *runtime in threads.allValues) {
    [runtime.bridge invalidate];
  }

  [threads removeAllObjects];
  threads = nil;
}

- (RNThreadRuntime *)createRuntimeWithBundleURL:(NSURL *)threadURL error:(NSError **)error
{
  RNThreadRuntime *runtime = [RNThreadRuntime new];
  RCTBridge *currentBridge = RCTBridge.currentBridge;

  if (!RCTTurboModuleEnabled()) {
    runtime.bridge = [[RCTBridge alloc] initWithBundleURL:threadURL
                                          moduleProvider:nil
                                           launchOptions:nil];
    RCTBridge.currentBridge = currentBridge;
    return runtime;
  }

  AppDelegate *appDelegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
  RCTReactNativeFactory *reactNativeFactory = appDelegate.reactNativeFactory;
  if (reactNativeFactory == nil) {
    if (error != nil) {
      *error = [NSError errorWithDomain:@"RNThread"
                                   code:1
                               userInfo:@{NSLocalizedDescriptionKey : @"React Native factory is not ready"}];
    }
    return nil;
  }

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
  RCTRootViewFactoryConfiguration *configuration =
      [[RCTRootViewFactoryConfiguration alloc] initWithBundleURL:threadURL
                                                  newArchEnabled:YES
                                              turboModuleEnabled:YES
                                               bridgelessEnabled:NO];
#pragma clang diagnostic pop

  configuration.loadSourceForBridgeWithProgress = ^(
      RCTBridge *bridge, RCTSourceLoadProgressBlock onProgress, RCTSourceLoadBlock loadCallback) {
    [RCTJavaScriptLoader loadBundleAtURL:threadURL onProgress:onProgress onComplete:loadCallback];
  };

  RCTRootViewFactory *rootViewFactory = [[RCTRootViewFactory alloc]
      initWithConfiguration:configuration
      andTurboModuleManagerDelegate:(id<RCTTurboModuleManagerDelegate>)reactNativeFactory];

  @try {
    [rootViewFactory initializeReactHostWithLaunchOptions:nil];
  } @finally {
    RCTBridge.currentBridge = currentBridge;
  }

  if (rootViewFactory.bridge == nil) {
    if (error != nil) {
      *error = [NSError errorWithDomain:@"RNThread"
                                   code:2
                               userInfo:@{NSLocalizedDescriptionKey : @"Worker bridge could not be created"}];
    }
    return nil;
  }

  runtime.rootViewFactory = rootViewFactory;
  runtime.bridge = rootViewFactory.bridge;
  return runtime;
}

#pragma mark - Public API

RCT_REMAP_METHOD(startThread,
                 name: (NSString *)name
                 options:(NSDictionary * _Nullable)options
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (threads == nil) {
    threads = [[NSMutableDictionary alloc] init];
  }
  if (options == nil) options = [NSDictionary dictionary];
  NSDictionary *opt_usePackedResource = RNParseOptionDict(options, @"usePackedResource");

  int threadId = abs(arc4random());

  NSURL *threadURL = [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:name fallbackURLProvider:^NSURL * {
    NSString *relname = [@"threads/" stringByAppendingString:[name lastPathComponent]];
    return [[NSBundle mainBundle] URLForResource:relname withExtension:@"jsbundle"];
  }];

  if ([opt_usePackedResource[@"jstype"] isEqualToString:@"string"] && opt_usePackedResource[@"stringVal"] != nil) {
    NSURL *packedThreadURL = [NSURL URLWithString:opt_usePackedResource[@"stringVal"]];
    NSLog(@"packedThreadURL %@", packedThreadURL);
    threadURL = packedThreadURL;
  } else if ([opt_usePackedResource[@"jstype"] isEqualToString:@"boolean"] && [opt_usePackedResource[@"boolVal"] boolValue]) {
    NSString *relname = [@"threads/" stringByAppendingString:[name lastPathComponent]];
    NSURL *packedThreadURL = [[NSBundle mainBundle] URLForResource:relname withExtension:@"jsbundle"];
    NSLog(@"packedThreadURL %@", packedThreadURL);
    threadURL = packedThreadURL;
  }

  NSLog(@"starting Thread %@", [threadURL absoluteString]);

  if (threadURL == nil) {
    reject(@"thread_bundle_missing", @"Worker bundle URL could not be resolved", nil);
    return;
  }

  NSError *runtimeError = nil;
  RNThreadRuntime *runtime = [self createRuntimeWithBundleURL:threadURL error:&runtimeError];
  if (runtime == nil) {
    reject(@"thread_runtime_failed", runtimeError.localizedDescription, runtimeError);
    return;
  }

  ThreadSelfModule *threadSelf = [runtime.bridge moduleForName:@"ThreadSelfModule"];
  if (threadSelf == nil) {
    [runtime.bridge invalidate];
    NSError *moduleError = [NSError errorWithDomain:@"RNThread"
                                                code:3
                                            userInfo:@{
                                              NSLocalizedDescriptionKey : @"ThreadSelfModule could not be initialized"
                                            }];
    reject(@"thread_module_missing", moduleError.localizedDescription, moduleError);
    return;
  }
  [threadSelf setThreadId:threadId];
  [threadSelf setParentModule:self];

  [threads setObject:runtime forKey:[NSNumber numberWithInt:threadId]];
  resolve([NSNumber numberWithInt:threadId]);

  NSDictionary *ret;
  ret = @{@"tid": [NSNumber numberWithInt:threadId]};
  [self sendEventWithName:@"@ThreadStarted" body: ret];

}

RCT_EXPORT_METHOD(stopThread:(int)threadId)
{
  if (threads == nil) {
    NSLog(@"Empty list of threads. abort stopping thread with id %i", threadId);
    return;
  }

  RNThreadRuntime *runtime = threads[[NSNumber numberWithInt:threadId]];
  if (runtime == nil) {
    NSLog(@"Thread is NIl. abort stopping thread with id %i", threadId);
    return;
  }

  [runtime.bridge invalidate];
  [threads removeObjectForKey:[NSNumber numberWithInt:threadId]];

  NSDictionary *ret;
  ret = @{@"tid": [NSNumber numberWithInt:threadId]};
  [self sendEventWithName:@"@ThreadStopped" body: ret];
}

RCT_EXPORT_METHOD(postThreadMessage: (int)threadId message:(NSString *)message)
{
  if (threads == nil) {
    NSLog(@"Empty list of threads. abort posting to thread with id %i", threadId);
    return;
  }

  RNThreadRuntime *runtime = threads[[NSNumber numberWithInt:threadId]];
  if (runtime == nil) {
    NSLog(@"Thread is NIl. abort posting to thread with id %i", threadId);
    return;
  }

  [runtime.bridge.eventDispatcher sendAppEventWithName:@"msgToThread" body:message];
}

@end
