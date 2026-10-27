#import <RCTAppDelegate.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UNUserNotificationCenter.h>

@interface AppDelegate : RCTAppDelegate<UNUserNotificationCenterDelegate>

@property (nonatomic, copy, readonly) NSDictionary *initialLaunchOptions;

// Returns YES only when the process's main React root is first created.
- (BOOL)connectWindowScene:(UIWindowScene *)windowScene launchOptions:(NSDictionary *)launchOptions;

@end
