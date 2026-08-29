//#import <Foundation/Foundation.h>
#import "RNTimeChanged.h"

@implementation RNTimeChanged {
    BOOL hasListeners;
    NSUInteger listenerCount;
    id significantTimeChangeObserver;
    id localeChangeObserver;
}

// To export a module named RNTimeChanged
RCT_EXPORT_MODULE();
- (NSArray<NSString *> *)supportedEvents {
    return @[
      @"onTimeChanged"
    ];
}

#if RCT_NEW_ARCH_ENABLED
- (void)addListener:(NSString *)eventType {
    (void)eventType;
    listenerCount += 1;
    if (listenerCount == 1) {
        [self startObserving];
    }
}

- (void)removeListeners:(double)count {
    listenerCount = count >= listenerCount ? 0 : listenerCount - (NSUInteger)count;
    if (listenerCount == 0) {
        [self stopObserving];
    }
}
#endif

- (dispatch_queue_t)methodQueue
{
    return dispatch_get_main_queue();
}

#pragma mark - Lifecycle

- (void) startObserving {
    if (hasListeners) {
        return;
    }

    NSNotificationCenter *center = [NSNotificationCenter defaultCenter];
    NSOperationQueue *mainQueue = [NSOperationQueue mainQueue];

    // handle device time change
    significantTimeChangeObserver = [center addObserverForName:UIApplicationSignificantTimeChangeNotification
                                                          object:nil
                                                           queue:mainQueue
                                                      usingBlock:^(NSNotification *notification) {
      NSDictionary *ret;
      ret = @{@"iosEvent": @"UIApplicationSignificantTimeChangeNotification", @"reason": @"timeSet"};
      [self emitTimeChangedEvent:ret];
    }];

    localeChangeObserver = [center addObserverForName:NSCurrentLocaleDidChangeNotification
                                                object:nil
                                                 queue:mainQueue
                                            usingBlock:^(NSNotification * _Nonnull notification) {
      NSDictionary *ret;
      ret = @{@"iosEvent": @"NSCurrentLocaleDidChangeNotification", @"reason": @"timeZoneChanged"};
      [self emitTimeChangedEvent:ret];
    }];

    hasListeners = TRUE;
}

- (void) stopObserving {
    if (!hasListeners) {
        return;
    }

    [[NSNotificationCenter defaultCenter] removeObserver:self];
    if (significantTimeChangeObserver != nil) {
        [[NSNotificationCenter defaultCenter] removeObserver:significantTimeChangeObserver];
        significantTimeChangeObserver = nil;
    }
    if (localeChangeObserver != nil) {
        [[NSNotificationCenter defaultCenter] removeObserver:localeChangeObserver];
        localeChangeObserver = nil;
    }

    hasListeners = FALSE;
}

- (void)emitTimeChangedEvent:(NSDictionary *)body {
#if RCT_NEW_ARCH_ENABLED
    [self emitOnTimeChanged:body ?: @{}];
#else
    [self sendEventWithName:@"onTimeChanged" body:body];
#endif
}

+(BOOL) requiresMainQueueSetup
{
  return YES;
}

#pragma mark - Public API
#if RCT_NEW_ARCH_ENABLED
- (void)exitAppForSecurity {
//  exit(9);
    exit(0);
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
    return std::make_shared<facebook::react::NativeRNTimeChangedSpecJSI>(params);
}
#else
RCT_EXPORT_METHOD(exitAppForSecurity) {
//  exit(9);
    exit(0);
}
#endif

@end
