#import "RNFSJsiInstaller.h"

#import <React/RCTBridge+Private.h>
#import <React/RCTUtils.h>
#import <jsi/jsi.h>

#import "../cpp/RabbyNativeFS.h"

@implementation RNFSJsiInstaller

+ (BOOL)installWithBridge:(RCTBridge *)bridge
{
  RCTCxxBridge *cxxBridge = (RCTCxxBridge *)bridge;
  if (cxxBridge == nil) {
    return NO;
  }

  auto runtime = (facebook::jsi::Runtime *)cxxBridge.runtime;
  if (runtime == nil) {
    return NO;
  }

  rabbyfs::install(*runtime);
  return YES;
}

@end
