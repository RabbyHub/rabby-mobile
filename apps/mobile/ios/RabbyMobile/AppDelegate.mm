#import "AppDelegate.h"

#import <Firebase.h>
#import <React/RCTBridge.h>
#import <React/RCTBundleURLProvider.h>
#import <React/RCTRootView.h>
#import <React/RCTLinkingManager.h>
#import <React/RCTHTTPRequestHandler.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>

// splash screen
#import "RNSplashScreen.h"

// push notification
#import <UserNotifications/UserNotifications.h>
#import <RNCPushNotificationIOS.h>

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

  NSString *appVersion = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];

  struct utsname systemInfo;
  uname(&systemInfo);
  NSString *model = [NSString stringWithUTF8String:systemInfo.machine];
  NSString *systemName = [[UIDevice currentDevice] systemName];
  NSString *systemVersion = [[UIDevice currentDevice] systemVersion];

  return [NSString stringWithFormat:@"%@/%@ CFNetwork/%@ Darwin/%@ (%@ %@/%@)",
    self.moduleName,
    appVersion,
    cfnVersion,
    [self _getDarwinVersion],
    model,
    systemName,
    systemVersion
  ];
}

- (void)configureUserAgentProvider
{
  NSString *userAgent = [self makeUserAgent];

  RCTSetCustomNSURLSessionConfigurationProvider(^NSURLSessionConfiguration *{
    NSURLSessionConfiguration *configuration = [NSURLSessionConfiguration defaultSessionConfiguration];
    configuration.HTTPAdditionalHeaders = @{ @"User-Agent": userAgent };
    return configuration;
  });
}

- (void)configureBridgeUserAgentIfAvailable
{
  RCTBridge *bridge = self.bridge;
  if (!bridge) {
    return;
  }

  NSString *userAgent = [self makeUserAgent];
  RCTHTTPRequestHandler *requestHandler = [bridge moduleForName:@"RCTHTTPRequestHandler"];
  if ([requestHandler respondsToSelector:@selector(setDefaultRequestHeaders:)]) {
    [requestHandler performSelector:@selector(setDefaultRequestHeaders:)
                         withObject:@{@"User-Agent": userAgent}];
  }
}

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  [FIRApp configure];

  self.moduleName = @"RabbyMobile";
  self.dependencyProvider = [RCTAppDependencyProvider new];

  NSString *rabbitCodeFromBundle = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"rabbit_code"];
  NSString *rabbitCode = rabbitCodeFromBundle ?: @"RABBY_MOBILE_CODE_DEV";
  self.initialProps = @{ @"rabbitCode": rabbitCode };

  [self configureUserAgentProvider];

  // Define UNUserNotificationCenter
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  center.delegate = self;

  BOOL didFinish = [super application:application didFinishLaunchingWithOptions:launchOptions];
  [self configureBridgeUserAgentIfAvailable];

#if DEBUG
  // react-native-splash-screen's iOS `show` implementation blocks the main
  // thread until JS hides it, which can trigger scene-create watchdog when
  // running a Metro-backed debug build on newer iOS versions.
#else
  [RNSplashScreen show];
#endif

  return didFinish;
}

- (void)customizeRootView:(RCTRootView *)rootView
{
  rootView.backgroundColor = [UIColor systemBackgroundColor];
}

//Called when a notification is delivered to a foreground app.
-(void)userNotificationCenter:(UNUserNotificationCenter *)center willPresentNotification:(UNNotification *)notification withCompletionHandler:(void (^)(UNNotificationPresentationOptions options))completionHandler
{
  completionHandler(UNNotificationPresentationOptionSound | UNNotificationPresentationOptionAlert | UNNotificationPresentationOptionBadge);
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
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

// Required for the register event.
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
 [RNCPushNotificationIOS didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}
// Required for the notification event.
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo
fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler
{
  [RNCPushNotificationIOS didReceiveRemoteNotification:userInfo fetchCompletionHandler:completionHandler];
}
// Required for the registrationError event.
- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
{
 [RNCPushNotificationIOS didFailToRegisterForRemoteNotificationsWithError:error];
}
// Required for localNotification event
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler
{
  [RNCPushNotificationIOS didReceiveNotificationResponse:response];
  completionHandler();
}

@end
