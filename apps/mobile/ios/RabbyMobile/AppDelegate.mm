#import "AppDelegate.h"

#import <Firebase.h>
#import <React/RCTBridge.h>
#import <React/RCTBundleURLProvider.h>
#import <React/RCTRootView.h>
#import <React/RCTLinkingManager.h>
#import <React/RCTHTTPRequestHandler.h>

// splash screen
#import "RNSplashScreen.h"

// device info
#import "RNDeviceInfo/RNDeviceInfo.h"

#import <sys/utsname.h>

@implementation AppDelegate

- (NSString *)_getDarwinVersion
{
  struct utsname u;
  uname(&u);
  return [NSString stringWithUTF8String:u.release];
}

- (NSString *)makeUserAgent
{
  NSDictionary *cfnInfo = [NSBundle bundleWithIdentifier:@"com.apple.CFNetwork"].infoDictionary;
  NSString *cfnVersion = cfnInfo[@"CFBundleVersion"];

  RNDeviceInfo* rnDeviveInfo = [self.bridge moduleForClass:[RNDeviceInfo class]];
  if (rnDeviveInfo == nil) {
    NSLog(@"[app] device-info module not found!");
    rnDeviveInfo = [[RNDeviceInfo alloc] init];
  }

  NSDictionary *deviceInfo = [rnDeviveInfo constantsToExport];

  return [NSString stringWithFormat:@"%@/%@ CFNetwork/%@ Darwin/%@ (%@ %@/%@)",
    self.moduleName,
    deviceInfo[@"appVersion"],
    cfnVersion,
    [self _getDarwinVersion],
    deviceInfo[@"model"],
    deviceInfo[@"systemName"],
    deviceInfo[@"systemVersion"]
  ];
}

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  [FIRApp configure];

  self.moduleName = @"RabbyMobile";

  NSString *rabbitCodeFromBundle = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"rabbit_code"];
  NSString *rabbitCode = rabbitCodeFromBundle ?: @"RABBY_MOBILE_CODE_DEV";
  self.initialProps = @{ @"rabbitCode": rabbitCode };

  RCTBridge *bridge = [[RCTBridge alloc] initWithDelegate:self launchOptions:launchOptions];

  // ✅ 设置 User-Agent 到 RCTHTTPRequestHandler（私有 API，需使用 selector）
  NSString *userAgent = [self makeUserAgent];
  RCTHTTPRequestHandler *requestHandler = [bridge moduleForName:@"RCTHTTPRequestHandler"];
  if ([requestHandler respondsToSelector:@selector(setDefaultRequestHeaders:)]) {
    [requestHandler performSelector:@selector(setDefaultRequestHeaders:)
                         withObject:@{@"User-Agent": userAgent}];
  }

  // set RCTSetCustomNSURLSessionConfigurationProvider
  RCTSetCustomNSURLSessionConfigurationProvider(^NSURLSessionConfiguration *{
    NSURLSessionConfiguration *configuration = [NSURLSessionConfiguration defaultSessionConfiguration];
    configuration.HTTPAdditionalHeaders = @{ @"User-Agent": userAgent };

    // configure the session
    return configuration;
  });

  RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge
                                                   moduleName:self.moduleName
                                            initialProperties:self.initialProps];

  rootView.backgroundColor = [UIColor systemBackgroundColor];

  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  UIViewController *rootViewController = [UIViewController new];
  rootViewController.view = rootView;
  self.window.rootViewController = rootViewController;
  [self.window makeKeyAndVisible];

  [RNSplashScreen show];

  return YES;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

// deep link
- (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
{
  return [RCTLinkingManager application:application openURL:url options:options];
}

// universal link
- (BOOL)application:(UIApplication *)application
continueUserActivity:(NSUserActivity *)userActivity
 restorationHandler:(void (^)(NSArray *))restorationHandler
{
  return [RCTLinkingManager application:application
                   continueUserActivity:userActivity
                     restorationHandler:restorationHandler];
}

@end
