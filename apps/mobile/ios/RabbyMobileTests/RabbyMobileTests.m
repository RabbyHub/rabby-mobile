#import <UIKit/UIKit.h>
#import <XCTest/XCTest.h>

#import <React/RCTLog.h>
#import <React/RCTRootView.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTBridgeProxy.h>
#import <React/RCTBundleManager.h>
#import <React/RCTViewManager.h>
#import <React/UIView+React.h>

#define TIMEOUT_SECONDS 600
#define TEXT_TO_LOOK_FOR @"Welcome to React"

@interface RabbyMobileTests : XCTestCase

@end

// Native child-management coverage for the legacy menu's Fabric interop
// contract. This intentionally uses UIKit, the real view managers, and RN's
// child registry rather than mocking them in a React component test.
@interface RNIContextMenuChildrenTests : XCTestCase {
  // The proxy requires a non-null opaque pointer. These native-only tests must
  // never dereference it or invoke a JavaScript operation.
  uint8_t _unusedRuntime;
}
@property (nonatomic, strong) RCTBridgeProxy *bridgeProxy;
@end

@implementation RNIContextMenuChildrenTests

- (void)setUp
{
  [super setUp];
  XCTAssertTrue([NSThread isMainThread]);
  // The views need a bridge reference, but these tests never load JS or access
  // a running app's modules. Use the same bridge proxy class as Fabric interop.
  self.bridgeProxy = [[RCTBridgeProxy alloc]
      initWithViewRegistry:[RCTViewRegistry new]
      moduleRegistry:[RCTModuleRegistry new]
      bundleManager:[RCTBundleManager new]
      callableJSModules:[RCTCallableJSModules new]
      dispatchToJSThread:^(dispatch_block_t block) {
        XCTFail(@"Child management must not dispatch JavaScript");
      }
      registerSegmentWithId:^(NSNumber *segmentId, NSString *path) {
        XCTFail(@"Child management must not register JavaScript segments");
      }
      runtime:&_unusedRuntime
      launchOptions:nil];
}

- (void)tearDown
{
  self.bridgeProxy = nil;
  [super tearDown];
}

- (UIView *)viewFromManager:(NSString *)managerName tag:(NSNumber *)tag
{
  Class managerClass = NSClassFromString(managerName);
  XCTAssertNotNil(managerClass, @"The real menu manager must be linked");
  RCTViewManager *manager = [managerClass new];
  manager.bridge = (RCTBridge *)self.bridgeProxy;
  UIView *view = [manager view];
  XCTAssertNotNil(view);
  view.reactTag = tag;
  return view;
}

- (void)testVisibleChildrenStayRegisteredAcrossRepeatedReordering
{
  UIView *menu = [self viewFromManager:@"RNIContextMenuViewManager" tag:@101];
  [menu setValue:@"disabled" forKey:@"internalCleanupMode"];
  UIView *address = [UIView new];
  UILabel *name = [UILabel new];
  name.text = @"Whitelist address";
  [address addSubview:name];
  UIView *other = [UIView new];

  [menu insertReactSubview:address atIndex:0];
  [menu insertReactSubview:other atIndex:1];
  [menu didUpdateReactSubviews];
  XCTAssertEqualObjects(menu.reactSubviews, (@[ address, other ]));
  XCTAssertEqualObjects(menu.subviews, (@[ address, other ]));

  for (NSUInteger iteration = 0; iteration < 20; iteration++) {
    // RN's Fabric interop removes by the registered React index before mounting
    // that same child at its new index. UIKit subviews alone are insufficient.
    UIView *first = menu.reactSubviews.firstObject;
    XCTAssertNotNil(first);
    if (first == nil) {
      return;
    }
    [menu removeReactSubview:first];
    [menu insertReactSubview:first atIndex:1];
    [menu didUpdateReactSubviews];
    XCTAssertEqualObjects(menu.subviews, menu.reactSubviews);
    XCTAssertEqual(menu.reactSubviews.count, 2u);
    XCTAssertEqual(address.superview, menu);
    XCTAssertEqual(name.superview, address);
  }
}

- (void)testPreviewChildrenKeepReactIndicesWithoutBecomingVisible
{
  UIView *menu = [self viewFromManager:@"RNIContextMenuViewManager" tag:@201];
  [menu setValue:@"disabled" forKey:@"internalCleanupMode"];
  UIView *preview = [self viewFromManager:@"RNIWrapperViewManager" tag:@202];
  preview.nativeID = @"contextMenuPreview";
  UIView *auxiliary = [self viewFromManager:@"RNIWrapperViewManager" tag:@203];
  auxiliary.nativeID = @"contextMenuAuxiliaryPreview";
  UIView *address = [UIView new];
  UIView *other = [UIView new];

  [menu insertReactSubview:preview atIndex:0];
  [menu insertReactSubview:address atIndex:1];
  [menu insertReactSubview:auxiliary atIndex:2];
  [menu insertReactSubview:other atIndex:3];
  [menu didUpdateReactSubviews];

  XCTAssertEqualObjects(menu.reactSubviews, (@[ preview, address, auxiliary, other ]));
  XCTAssertEqualObjects(menu.subviews, (@[ address, other ]));
  XCTAssertNil(preview.superview);
  XCTAssertNil(auxiliary.superview);

  // Retain the React indices, including detached previews, while moving a
  // visible child. Never translate them into the shorter UIKit subview array.
  [menu removeReactSubview:address];
  [menu insertReactSubview:address atIndex:2];
  [menu didUpdateReactSubviews];
  XCTAssertEqualObjects(menu.reactSubviews, (@[ preview, auxiliary, address, other ]));
  XCTAssertEqualObjects(menu.subviews, (@[ address, other ]));
  XCTAssertNil(preview.superview);
  XCTAssertNil(auxiliary.superview);

  [menu removeReactSubview:preview];
  [menu removeReactSubview:auxiliary];
  [menu didUpdateReactSubviews];
  XCTAssertEqualObjects(menu.reactSubviews, (@[ address, other ]));
  XCTAssertEqualObjects(menu.subviews, (@[ address, other ]));
}

@end

@implementation RabbyMobileTests

- (BOOL)findSubviewInView:(UIView *)view matching:(BOOL (^)(UIView *view))test
{
  if (test(view)) {
    return YES;
  }
  for (UIView *subview in [view subviews]) {
    if ([self findSubviewInView:subview matching:test]) {
      return YES;
    }
  }
  return NO;
}

- (void)testRendersWelcomeScreen
{
  UIViewController *vc = [[[RCTSharedApplication() delegate] window] rootViewController];
  NSDate *date = [NSDate dateWithTimeIntervalSinceNow:TIMEOUT_SECONDS];
  BOOL foundElement = NO;

  __block NSString *redboxError = nil;
#ifdef DEBUG
  RCTSetLogFunction(
      ^(RCTLogLevel level, RCTLogSource source, NSString *fileName, NSNumber *lineNumber, NSString *message) {
        if (level >= RCTLogLevelError) {
          redboxError = message;
        }
      });
#endif

  while ([date timeIntervalSinceNow] > 0 && !foundElement && !redboxError) {
    [[NSRunLoop mainRunLoop] runMode:NSDefaultRunLoopMode beforeDate:[NSDate dateWithTimeIntervalSinceNow:0.1]];
    [[NSRunLoop mainRunLoop] runMode:NSRunLoopCommonModes beforeDate:[NSDate dateWithTimeIntervalSinceNow:0.1]];

    foundElement = [self findSubviewInView:vc.view
                                  matching:^BOOL(UIView *view) {
                                    if ([view.accessibilityLabel isEqualToString:TEXT_TO_LOOK_FOR]) {
                                      return YES;
                                    }
                                    return NO;
                                  }];
  }

#ifdef DEBUG
  RCTSetLogFunction(RCTDefaultLogFunction);
#endif

  XCTAssertNil(redboxError, @"RedBox error: %@", redboxError);
  XCTAssertTrue(foundElement, @"Couldn't find element with text '%@' in %d seconds", TEXT_TO_LOOK_FOR, TIMEOUT_SECONDS);
}

@end
