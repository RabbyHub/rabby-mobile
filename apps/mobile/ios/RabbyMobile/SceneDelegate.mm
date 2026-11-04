#import "SceneDelegate.h"
#import "AppDelegate.h"
#import <React/RCTLinkingManager.h>
#import <UserNotifications/UserNotifications.h>

@implementation SceneDelegate

- (void)scene:(UIScene *)scene
    willConnectToSession:(UISceneSession *)session
                 options:(UISceneConnectionOptions *)connectionOptions
{
  if (![scene isKindOfClass:[UIWindowScene class]]) {
    return;
  }

  AppDelegate *appDelegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
  NSMutableDictionary *launchOptions = [appDelegate.initialLaunchOptions mutableCopy];

  UIOpenURLContext *URLContext = connectionOptions.URLContexts.anyObject;
  if (URLContext) {
    launchOptions[UIApplicationLaunchOptionsURLKey] = URLContext.URL;
    if (URLContext.options.sourceApplication) {
      launchOptions[UIApplicationLaunchOptionsSourceApplicationKey] = URLContext.options.sourceApplication;
    }
    if (URLContext.options.annotation) {
      launchOptions[UIApplicationLaunchOptionsAnnotationKey] = URLContext.options.annotation;
    }
  }

  for (NSUserActivity *activity in connectionOptions.userActivities) {
    if ([activity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb] && activity.webpageURL) {
      // RN 0.81's getInitialURL reads this legacy launch-options structure.
      launchOptions[UIApplicationLaunchOptionsUserActivityDictionaryKey] = @{
        UIApplicationLaunchOptionsUserActivityTypeKey: NSUserActivityTypeBrowsingWeb,
        @"UIApplicationLaunchOptionsUserActivityKey": activity,
      };
      break;
    }
  }

  UNNotification *notification = connectionOptions.notificationResponse.notification;
  if ([notification.request.trigger isKindOfClass:[UNPushNotificationTrigger class]]) {
    launchOptions[UIApplicationLaunchOptionsRemoteNotificationKey] = notification.request.content.userInfo;
  }

  BOOL started = [appDelegate connectWindowScene:(UIWindowScene *)scene launchOptions:launchOptions];
  self.window = appDelegate.window;

  if (!started) {
    // A reconnect has an existing JS listener. A fresh root instead consumes
    // the launch options above, so do not deliver the same URL twice.
    [self scene:scene openURLContexts:connectionOptions.URLContexts];
    for (NSUserActivity *activity in connectionOptions.userActivities) {
      [self scene:scene continueUserActivity:activity];
    }
  }
}

- (void)scene:(UIScene *)scene openURLContexts:(NSSet<UIOpenURLContext *> *)URLContexts
{
  for (UIOpenURLContext *context in URLContexts) {
    NSMutableDictionary<UIApplicationOpenURLOptionsKey, id> *options = [NSMutableDictionary new];
    options[UIApplicationOpenURLOptionsOpenInPlaceKey] = @(context.options.openInPlace);
    if (context.options.sourceApplication) {
      options[UIApplicationOpenURLOptionsSourceApplicationKey] = context.options.sourceApplication;
    }
    if (context.options.annotation) {
      options[UIApplicationOpenURLOptionsAnnotationKey] = context.options.annotation;
    }
    [RCTLinkingManager application:UIApplication.sharedApplication openURL:context.URL options:options];
  }
}

- (void)scene:(UIScene *)scene continueUserActivity:(NSUserActivity *)userActivity
{
  [RCTLinkingManager application:UIApplication.sharedApplication
           continueUserActivity:userActivity
             restorationHandler:^(NSArray<id<UIUserActivityRestoring>> *restorableObjects) {}];
}

@end
