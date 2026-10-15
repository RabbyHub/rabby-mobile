#import <UIKit/UIKit.h>
#import <XCTest/XCTest.h>

#import <React/RCTPullToRefreshViewComponentView.h>
#import <React/RCTScrollViewComponentView.h>

#include <react/renderer/components/FBReactNativeSpec/Props.h>
#include <react/renderer/graphics/Color.h>

using namespace facebook::react;

// Native component contracts, not a Hermes or full-App refresh scenario. The
// real Fabric views own the real UIRefreshControl; no private ivars are changed.
@interface RCTPullToRefreshViewComponentViewTests : XCTestCase
@end

@implementation RCTPullToRefreshViewComponentViewTests

- (void)setUp
{
  [super setUp];
  XCTAssertTrue([NSThread isMainThread]);
}

- (void)assertColor:(UIColor *)actual equals:(UIColor *)expected
{
  CGFloat actualRed = 0, actualGreen = 0, actualBlue = 0, actualAlpha = 0;
  CGFloat expectedRed = 0, expectedGreen = 0, expectedBlue = 0, expectedAlpha = 0;
  XCTAssertNotNil(actual);
  XCTAssertTrue([actual getRed:&actualRed green:&actualGreen blue:&actualBlue alpha:&actualAlpha]);
  XCTAssertTrue([expected getRed:&expectedRed green:&expectedGreen blue:&expectedBlue alpha:&expectedAlpha]);
  XCTAssertEqualWithAccuracy(actualRed, expectedRed, 0.001);
  XCTAssertEqualWithAccuracy(actualGreen, expectedGreen, 0.001);
  XCTAssertEqualWithAccuracy(actualBlue, expectedBlue, 0.001);
  XCTAssertEqualWithAccuracy(actualAlpha, expectedAlpha, 0.001);
}

- (void)testInitialLayoutAppliesLatestCachedPropsAfterMountAndRecycle
{
  RCTScrollViewComponentView *scroll =
      [[RCTScrollViewComponentView alloc] initWithFrame:CGRectMake(0, 0, 320, 600)];
  RCTPullToRefreshViewComponentView *refresh = [RCTPullToRefreshViewComponentView new];
  UIRefreshControl *previousControl = nil;

  for (NSUInteger cycle = 0; cycle < 2; cycle++) {
    auto supersededProps = std::make_shared<PullToRefreshViewProps>();
    supersededProps->title = "Superseded before layout";
    supersededProps->progressViewOffset = 12;
    [refresh updateProps:supersededProps oldProps:nullptr];

    auto latestProps = std::make_shared<PullToRefreshViewProps>();
    latestProps->title = cycle == 0 ? "Initial title" : "Recycled title";
    latestProps->tintColor = colorFromRGBA(255, 0, 0, 255);
    latestProps->titleColor = colorFromRGBA(0, 0, 255, 255);
    latestProps->progressViewOffset = cycle == 0 ? 37 : 19;
    [refresh updateProps:latestProps oldProps:supersededProps];
    [scroll mountChildComponentView:refresh index:0];

    UIRefreshControl *control = scroll.scrollView.refreshControl;
    XCTAssertNotNil(control);
    XCTAssertNotEqual(control, previousControl);
    // Confirm this fixture really exercises the deferred first-layout replay,
    // rather than an ordinary prop update after the component is laid out.
    XCTAssertNil(control.attributedTitle);
    XCTAssertEqualWithAccuracy(control.bounds.origin.y, 0, 0.001);

    [refresh layoutSubviews];

    [self assertColor:control.tintColor equals:UIColor.redColor];
    XCTAssertEqualObjects(control.attributedTitle.string,
                          cycle == 0 ? @"Initial title" : @"Recycled title");
    XCTAssertEqualWithAccuracy(control.bounds.origin.y, -latestProps->progressViewOffset, 0.001);
    if (control.attributedTitle.length > 0) {
      [self assertColor:[control.attributedTitle attribute:NSForegroundColorAttributeName
                                                  atIndex:0
                                           effectiveRange:NULL]
                 equals:UIColor.blueColor];
    }

    [scroll unmountChildComponentView:refresh index:0];
    XCTAssertNil(scroll.scrollView.refreshControl);
    previousControl = control;
    [refresh prepareForRecycle];
  }
}

- (void)testReinsertWithNullOldPropsUsesLastAppliedSnapshot
{
  RCTScrollViewComponentView *scroll =
      [[RCTScrollViewComponentView alloc] initWithFrame:CGRectMake(0, 0, 320, 600)];
  RCTPullToRefreshViewComponentView *refresh = [RCTPullToRefreshViewComponentView new];
  auto defaults = std::make_shared<PullToRefreshViewProps>();
  [refresh updateProps:defaults oldProps:nullptr];
  [scroll mountChildComponentView:refresh index:0];
  [refresh layoutSubviews];
  UIRefreshControl *control = scroll.scrollView.refreshControl;
  XCTAssertNotNil(control);

  auto firstProps = std::make_shared<PullToRefreshViewProps>();
  firstProps->title = "Before reinsertion";
  firstProps->tintColor = colorFromRGBA(255, 0, 0, 255);
  firstProps->progressViewOffset = 11;
  [refresh updateProps:firstProps oldProps:defaults];
  XCTAssertEqualObjects(control.attributedTitle.string, @"Before reinsertion");

  [scroll unmountChildComponentView:refresh index:0];
  XCTAssertNil(scroll.scrollView.refreshControl);

  auto reinsertedProps = std::make_shared<PullToRefreshViewProps>();
  reinsertedProps->title = "After reinsertion";
  reinsertedProps->tintColor = colorFromRGBA(0, 0, 255, 255);
  reinsertedProps->progressViewOffset = 29;
  // Fabric Insert sends nullptr even when a previously laid-out view is
  // reinserted without prepareForRecycle. Keep the production call order.
  [refresh updateProps:reinsertedProps oldProps:nullptr];
  [scroll mountChildComponentView:refresh index:0];
  [refresh layoutSubviews];

  XCTAssertEqual(scroll.scrollView.refreshControl, control);
  XCTAssertEqualObjects(control.attributedTitle.string, @"After reinsertion");
  [self assertColor:control.tintColor equals:UIColor.blueColor];
  XCTAssertEqualWithAccuracy(control.bounds.origin.y, -29, 0.001);

  [refresh updateProps:defaults oldProps:nullptr];
  XCTAssertNil(control.attributedTitle);
  XCTAssertEqualWithAccuracy(control.bounds.origin.y, 0, 0.001);
  [scroll unmountChildComponentView:refresh index:0];
}

- (void)testInitiallyRefreshingControlStartsAfterAttachedLayout
{
  UIWindow *window = [[UIWindow alloc] initWithFrame:CGRectMake(0, 0, 320, 600)];
  UIViewController *controller = [UIViewController new];
  window.rootViewController = controller;
  RCTScrollViewComponentView *scroll =
      [[RCTScrollViewComponentView alloc] initWithFrame:window.bounds];
  [controller.view addSubview:scroll];
  // A test-owned window provides real UIKit attachment without replacing the
  // app's key window or relying on a particular device's indicator height.
  window.hidden = NO;

  RCTPullToRefreshViewComponentView *refresh = [RCTPullToRefreshViewComponentView new];
  auto refreshingProps = std::make_shared<PullToRefreshViewProps>();
  refreshingProps->refreshing = true;
  [refresh updateProps:refreshingProps oldProps:nullptr];

  @try {
    [scroll mountChildComponentView:refresh index:0];
    UIRefreshControl *control = scroll.scrollView.refreshControl;
    XCTAssertNotNil(control);
    XCTAssertNotNil(control.window);
    XCTAssertFalse(control.isRefreshing);

    [refresh layoutSubviews];
    XCTAssertTrue(control.isRefreshing);

    auto stoppedProps = std::make_shared<PullToRefreshViewProps>();
    [refresh updateProps:stoppedProps oldProps:refreshingProps];
    XCTAssertFalse(control.isRefreshing);
  } @finally {
    [scroll unmountChildComponentView:refresh index:0];
    window.hidden = YES;
    window.rootViewController = nil;
  }
}

@end
