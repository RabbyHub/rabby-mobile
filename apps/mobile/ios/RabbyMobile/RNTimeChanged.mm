//#import <Foundation/Foundation.h>
#import "RNTimeChanged.h"

@implementation RNTimeChanged {
    BOOL hasListeners;
}

// To export a module named RNTimeChanged
RCT_EXPORT_MODULE();
- (NSArray<NSString *> *)supportedEvents {
    return @[
      @"onTimeChanged"
    ];
}

- (dispatch_queue_t)methodQueue
{
    return dispatch_get_main_queue();
}

#pragma mark - Lifecycle

- (void) startObserving {
    NSNotificationCenter *center = [NSNotificationCenter defaultCenter];
    NSOperationQueue *mainQueue = [NSOperationQueue mainQueue];

    // handle device time change
    [center addObserverForName:UIApplicationSignificantTimeChangeNotification
                            object:nil
                            queue:mainQueue
                            usingBlock:^(NSNotification *notification) {
      NSDictionary *ret;
      ret = @{@"iosEvent": @"UIApplicationSignificantTimeChangeNotification", @"reason": @"timeSet"};
      [self sendEventWithName:@"onTimeChanged" body: ret];
    }];

    [center addObserverForName:NSCurrentLocaleDidChangeNotification
                            object:nil
                            queue:mainQueue
                            usingBlock:^(NSNotification * _Nonnull notification) {
      NSDictionary *ret;
      ret = @{@"iosEvent": @"NSCurrentLocaleDidChangeNotification", @"reason": @"timeZoneChanged"};
      [self sendEventWithName:@"onTimeChanged" body: ret];
    }];

    hasListeners = TRUE;
}

- (void) stopObserving {
    [[NSNotificationCenter defaultCenter] removeObserver:self];

    hasListeners = FALSE;
}

+(BOOL) requiresMainQueueSetup
{
  return YES;
}

#pragma mark - Public API
RCT_EXPORT_METHOD(exitAppForSecurity) {
//  exit(9);
    exit(0);
}

@end
