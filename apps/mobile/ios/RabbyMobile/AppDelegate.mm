#import "AppDelegate.h"

#import <Firebase.h>
// #import <React/RCTAppSetupUtils.h>
#import <React/RCTBridge.h>
#import <React/RCTBundleURLProvider.h>
#import <React/RCTRootView.h>
#import <React/RCTHTTPRequestHandler.h>
// Import RNSplashScreen
#import "RNSplashScreen.h"

#import "RNDeviceInfo/RNDeviceInfo.h"

#if DEBUG
void devLog(NSString *format, ...) {
  va_list args;
  va_start(args, format);
  NSLogv(format, args);
  va_end(args);
}
#else
void devLog(NSString *format, ...) {}
#endif

// #ifdef FB_SONARKIT_ENABLED
// #import <FlipperKit/FlipperClient.h>
// #import <FlipperKitLayoutPlugin/FlipperKitLayoutPlugin.h>
// #import <FlipperKitUserDefaultsPlugin/FKUserDefaultsPlugin.h>
// #import <FlipperKitNetworkPlugin/FlipperKitNetworkPlugin.h>
// #import <SKIOSNetworkPlugin/SKIOSNetworkAdapter.h>
// #import <FlipperKitReactPlugin/FlipperKitReactPlugin.h>
// static void InitializeFlipper(UIApplication *application) {
//   FlipperClient *client = [FlipperClient sharedClient];
//   SKDescriptorMapper *layoutDescriptorMapper = [[SKDescriptorMapper alloc] initWithDefaults];
//   [client addPlugin:[[FlipperKitLayoutPlugin alloc] initWithRootNode:application withDescriptorMapper:layoutDescriptorMapper]];
//   [client addPlugin:[[FKUserDefaultsPlugin alloc] initWithSuiteName:nil]];
//   [client addPlugin:[FlipperKitReactPlugin new]];
//   [client addPlugin:[[FlipperKitNetworkPlugin alloc] initWithNetworkAdapter:[SKIOSNetworkAdapter new]]];
//   [client start];
// }
// #endif

@implementation AppDelegate
- (NSString *)_getDarwinVersion
{
    struct utsname u;
    (void) uname(&u);
    return [NSString stringWithUTF8String:u.release];
}
// make userAgent
- (NSString *)makeUserAgent
{
  NSDictionary * cfnInfo = [NSBundle bundleWithIdentifier:@"com.apple.CFNetwork"].infoDictionary;
  // devLog(@"[app] cfnInfo: %@", cfnInfo);

  NSString * cfnVersion = cfnInfo[@"CFBundleVersion"];
  // NSString * cfnShortVersion = cfnInfo[@"CFBundleShortVersionString"];
  RNDeviceInfo* rnDeviveInfo = [self.bridge moduleForClass:[RNDeviceInfo class]];
  // we don't expect logic here triggered, if it does, we need check codebase
  if (rnDeviveInfo == nil) {
    NSLog(@"[app] device-info module not found!");
    rnDeviveInfo = [[RNDeviceInfo alloc] init];
  }
  NSDictionary * deviceInfo = [rnDeviveInfo constantsToExport];
  NSString * userAgent =
    [NSString stringWithFormat:@"%@/%@ CFNetwork/%@ Darwin/%@ (%@ %@/%@)",
      self.moduleName,
      deviceInfo[@"appVersion"],
      // deviceInfo[@"buildNumber"],
      cfnVersion,
      [self _getDarwinVersion],
      deviceInfo[@"model"],
      deviceInfo[@"systemName"],
      deviceInfo[@"systemVersion"]
    ];

  devLog(@"[app] userAgent: %@; deviceInfo: %@", userAgent, deviceInfo);

  return userAgent;
}

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
// #ifdef FB_SONARKIT_ENABLED
//   InitializeFlipper(application);
// #endif
  [FIRApp configure];
  self.moduleName = @"RabbyMobile";

  NSString *rabbitCodeFromBundle = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"rabbit_code"];
  NSString *rabbitCode;

  if(rabbitCodeFromBundle != nil){ rabbitCode = rabbitCodeFromBundle; }
  else { rabbitCode = @"RABBY_MOBILE_CODE_DEV"; }

  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{ @"rabbitCode": rabbitCode };

  // RCTBridge *bridge = [self.reactDelegate createBridgeWithDelegate:self launchOptions:launchOptions];
  // RCTRootView *rootView = [self.reactDelegate createRootViewWithBridge:bridge
  //                                                  moduleName:@"RabbyMobile"
  //                                           initialProperties:nil];
  // if (@available(iOS 13.0, *)) {
  //     rootView.backgroundColor = [UIColor systemBackgroundColor];
  // } else {
  //     rootView.backgroundColor = [UIColor whiteColor];
  // }
  // self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  // UIViewController *rootViewController = [self.reactDelegate createRootViewController];
  // rootViewController.view = rootView;
  // self.window.rootViewController = rootViewController;
  // [self.window makeKeyAndVisible];

  [super application:application didFinishLaunchingWithOptions:launchOptions];
  NSString * userAgent = [self makeUserAgent];

  // set RCTSetCustomNSURLSessionConfigurationProvider
  RCTSetCustomNSURLSessionConfigurationProvider(^NSURLSessionConfiguration *{
    NSURLSessionConfiguration *configuration = [NSURLSessionConfiguration defaultSessionConfiguration];
    configuration.HTTPAdditionalHeaders = @{ @"User-Agent": userAgent };

    // configure the session
    return configuration;
  });

  [RNSplashScreen show]; // react-native-splash-screen

  return true;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
