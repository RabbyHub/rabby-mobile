#import "ThreadSelfModule.h"
#include <stdlib.h>

@implementation ThreadSelfModule

RCT_EXPORT_MODULE();

// @synthesize bridge = _bridge;
// @synthesize parentBridge = _parentBridge;
// @synthesize threadId = _threadId;

RCT_EXPORT_METHOD(postMessage: (NSString *)message)
{
  if (self.parentModule == nil) {
    NSLog(@"No parent module defined - abord sending thread message");
    return;
  }

  // NSString *eventName = [NSString stringWithFormat:@"Thread%i", self.threadId];

  NSDictionary *ret;
  ret = @{
    @"tid": [NSNumber numberWithInt:self.threadId],
    @"message": message
  };
//  [self.parentBridge.eventDispatcher sendAppEventWithName:@"msgFromThread"
//                                     body:ret];
  [self.parentModule sendEventWithName:@"msgFromThread"
                                        body:ret];
}

@end
