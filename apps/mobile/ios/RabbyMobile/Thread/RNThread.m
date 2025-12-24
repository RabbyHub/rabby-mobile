#import "RNThread.h"
#include <stdlib.h>

#include "RNUtils.h"

@implementation RNThread

// @synthesize bridge = _bridge;

NSMutableDictionary *threads;

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

  for (NSNumber *threadId in threads) {
    RCTBridge *threadBridge = threads[threadId];
    [threadBridge invalidate];
  }

  [threads removeAllObjects];
  threads = nil;
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

  RCTBridge* currentBridge = RCTBridge.currentBridge;
  RCTBridge *threadBridge = [[RCTBridge alloc] initWithBundleURL:threadURL
                                            moduleProvider:nil
                                             launchOptions:nil];
  RCTBridge.currentBridge = currentBridge;
//  self.setBridge(currentBridge);

  ThreadSelfModule *threadSelf = [threadBridge moduleForName:@"ThreadSelfModule"];
  [threadSelf setThreadId:threadId];
  [threadSelf setParentModule:self];

  [threads setObject:threadBridge forKey:[NSNumber numberWithInt:threadId]];
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

  RCTBridge *threadBridge = threads[[NSNumber numberWithInt:threadId]];
  if (threadBridge == nil) {
    NSLog(@"Thread is NIl. abort stopping thread with id %i", threadId);
    return;
  }

  [threadBridge invalidate];
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

  RCTBridge *threadBridge = threads[[NSNumber numberWithInt:threadId]];
  if (threadBridge == nil) {
    NSLog(@"Thread is NIl. abort posting to thread with id %i", threadId);
    return;
  }

  [threadBridge.eventDispatcher sendAppEventWithName:@"msgToThread"
                                               body:message];
}

@end
