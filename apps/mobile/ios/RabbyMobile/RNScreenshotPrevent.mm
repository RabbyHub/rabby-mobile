#import "RNScreenshotPrevent.h"
#import <React/RCTUtils.h>

#ifdef RCT_NEW_ARCH_ENABLED
using namespace facebook::react;
#endif

@implementation RNScreenshotPrevent {
    BOOL hasListeners;
    BOOL enabled;
    BOOL appSwitcherBlurEnabled;
    BOOL notificationObserversRegistered;
    id screenshotObserver;
    UIImageView *obfuscatingView;
    UITextField *secureField;
    // UIImageView *imageView;
}

- (instancetype)init
{
    self = [super init];
    if (self) {
        appSwitcherBlurEnabled = YES;
    }

    return self;
}

// To export a module named RNScreenshotPrevent
RCT_EXPORT_MODULE();

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<NativeRNScreenshotPreventSpecJSI>(params);
}

- (void)setEventEmitterCallback:(EventEmitterCallbackWrapper *)eventEmitterCallbackWrapper
{
    [super setEventEmitterCallback:eventEmitterCallbackWrapper];
    hasListeners = TRUE;
    [self startNotificationObserversIfNeeded];
}
#endif

- (NSArray<NSString *> *)supportedEvents {
    return @[
      @"userDidTakeScreenshot",
      @"screenCapturedChanged",
      @"appSwitcherBlurChanged",
      @"screenCaptureDetectionChanged",
      @"preventScreenshotChanged",
      @"androidOnLifeCycleChanged" // robust, not really used
    ];
}

- (dispatch_queue_t)methodQueue
{
    return dispatch_get_main_queue();
}

#pragma mark - Lifecycle

- (void) startObserving {
    hasListeners = TRUE;
    [self startNotificationObserversIfNeeded];
}

- (void) stopObserving {
    [self stopNotificationObservers];
    hasListeners = FALSE;
}

- (void) startNotificationObserversIfNeeded {
    if (notificationObserversRegistered) {
        return;
    }

    NSNotificationCenter *center = [NSNotificationCenter defaultCenter];
    NSOperationQueue *mainQueue = [NSOperationQueue mainQueue];

    // handle inactive event
    [center addObserver:self selector:@selector(handleAppStateResignActive)
                            name:UIApplicationWillResignActiveNotification
                            object:nil];
    // handle active event
    [center addObserver:self selector:@selector(handleAppStateActive)
                            name:UIApplicationDidBecomeActiveNotification
                            object:nil];

    __weak RNScreenshotPrevent *weakSelf = self;
    screenshotObserver =
        [center addObserverForName:UIApplicationUserDidTakeScreenshotNotification
                            object:nil
                             queue:mainQueue
                        usingBlock:^(NSNotification *notification) {
                            (void)notification;
                            [weakSelf handleAppScreenshotNotification];
                        }];

    [center addObserver:self selector:@selector(handleScreenCapturedNotification)
                            name:UIScreenCapturedDidChangeNotification
                            object:nil];

    notificationObserversRegistered = TRUE;
}

- (void)stopNotificationObservers {
    if (!notificationObserversRegistered) {
        return;
    }

    NSNotificationCenter *center = [NSNotificationCenter defaultCenter];
    [center removeObserver:self];
    if (screenshotObserver) {
        [center removeObserver:screenshotObserver];
        screenshotObserver = nil;
    }
    notificationObserversRegistered = FALSE;
}

- (void)invalidate {
    [self stopNotificationObservers];
}

- (void)dealloc {
    [self stopNotificationObservers];
}

#pragma mark - App Notification Methods

- (void)emitUserDidTakeScreenshotChanged:(NSDictionary *)body {
    if (!hasListeners) {
        return;
    }
#ifdef RCT_NEW_ARCH_ENABLED
    [self emitUserDidTakeScreenshot:body ?: @{}];
#else
    [self sendEventWithName:@"userDidTakeScreenshot" body:body];
#endif
}

- (void)emitScreenCapturedChangedEvent:(NSDictionary *)body {
    if (!hasListeners) {
        return;
    }
#ifdef RCT_NEW_ARCH_ENABLED
    [self emitScreenCapturedChanged:body];
#else
    [self sendEventWithName:@"screenCapturedChanged" body:body];
#endif
}

- (void)emitPreventScreenshotChangedEvent:(NSDictionary *)body {
    if (!hasListeners) {
        return;
    }
#ifdef RCT_NEW_ARCH_ENABLED
    [self emitPreventScreenshotChanged:body];
#else
    [self sendEventWithName:@"preventScreenshotChanged" body:body];
#endif
}

- (void)emitAppSwitcherBlurChangedEvent:(BOOL)visible {
    if (hasListeners) {
        // The JS overlay owns the normal app-switcher blur presentation so we only
        // emit a deterministic lifecycle signal here and avoid depending on RN AppState.
#ifdef RCT_NEW_ARCH_ENABLED
        [self emitAppSwitcherBlurChanged:@{@"visible": @(visible)}];
#else
        [self sendEventWithName:@"appSwitcherBlurChanged" body:@{@"visible": @(visible)}];
#endif
    }
}

/** displays blurry view when app becomes inactive */
- (void)handleAppStateResignActive {
    if (!(self->enabled || self->appSwitcherBlurEnabled)) {
        return;
    }

    if (self->appSwitcherBlurEnabled) {
        [self emitAppSwitcherBlurChangedEvent:YES];
    }

    // Keep the legacy native snapshot blur only for the prevent-screenshot flow.
    // In regular backgrounding, JS renders the designed BlurView overlay instead.
    if (!self->enabled || self->obfuscatingView) {
        return;
    }

    UIWindow *keyWindow = [UIApplication sharedApplication].keyWindow;
    if (!keyWindow) {
        return;
    }

    UIImageView *blurredScreenImageView = [[UIImageView alloc] initWithFrame:keyWindow.bounds];

    UIGraphicsBeginImageContext(keyWindow.bounds.size);
    [keyWindow drawViewHierarchyInRect:keyWindow.frame afterScreenUpdates:NO];
    UIImage *viewImage = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();

    blurredScreenImageView.image = viewImage;
    UIBlurEffect *blurEffect = [UIBlurEffect effectWithStyle:UIBlurEffectStyleLight];
    UIVisualEffectView *blurView = [[UIVisualEffectView alloc] initWithEffect:blurEffect];
    blurView.frame = blurredScreenImageView.bounds;
    blurView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    [blurredScreenImageView addSubview:blurView];

    self->obfuscatingView = blurredScreenImageView;
    [keyWindow addSubview:self->obfuscatingView];
}

/** removes blurry view when app becomes active */
- (void)handleAppStateActive {
    if (self->obfuscatingView) {
        [self->obfuscatingView removeFromSuperview];
        self->obfuscatingView = nil;
    }

    // Mirror the resign-active signal so JS can hide the app-switcher overlay
    // without relying on the RN AppState transition timing.
    [self emitAppSwitcherBlurChangedEvent:NO];
}

/** sends screenshot taken event into app */
- (void) handleAppScreenshotNotification {
    if (!hasListeners) {
        return;
    }

    NSMutableDictionary *result = [@{
      @"path": @"Error retrieving file",
      @"name": @"",
      @"height": @"",
      @"width": @"",
      @"imageBase64": @"",
      @"imageType": @"",
      @"captured": @FALSE
    } mutableCopy];

    UIViewController *presentedViewController = RCTPresentedViewController();
    UIView *targetView = presentedViewController.view.superview ?: presentedViewController.view;
    UIImage *image = [self convertViewToImage:targetView];
    NSData *data = UIImagePNGRepresentation(image);
    if (!data) {
        [self emitUserDidTakeScreenshotChanged:result];
        return;
    }

    [result setObject:@(image.size.height) forKey:@"height"];
    [result setObject:@(image.size.width) forKey:@"width"];
    [result setObject:[data base64EncodedStringWithOptions:0] forKey:@"imageBase64"];
    [result setObject:@"png" forKey:@"imageType"];
    [result setObject:@TRUE forKey:@"captured"];

    [self emitUserDidTakeScreenshotChanged:result];
}

- (void) handleScreenCapturedNotification {
    BOOL isCaptured = [UIScreen mainScreen].isCaptured;
#if DEBUG
    NSLog(@"AppStart: Main Screen is captured: %@", [UIScreen mainScreen].isCaptured ? @"YES" : @"NO");
#endif
    // only send events when we have some listeners
    if(hasListeners) {
        [self emitScreenCapturedChangedEvent:@{@"isBeingCaptured": @(isCaptured)}];
    }
}

+(BOOL) requiresMainQueueSetup
{
  return YES;
}

CGSize CGSizeAspectFit(const CGSize aspectRatio, const CGSize boundingSize)
{
    CGSize aspectFitSize = CGSizeMake(boundingSize.width, boundingSize.height);
    float mW = boundingSize.width / aspectRatio.width;
    float mH = boundingSize.height / aspectRatio.height;
    if( mH < mW )
        aspectFitSize.width = mH * aspectRatio.width;
    else if( mW < mH )
        aspectFitSize.height = mW * aspectRatio.height;
    return aspectFitSize;
}

CGSize CGSizeAspectFill(const CGSize aspectRatio, const CGSize minimumSize)
{
    CGSize aspectFillSize = CGSizeMake(minimumSize.width, minimumSize.height);
    float mW = minimumSize.width / aspectRatio.width;
    float mH = minimumSize.height / aspectRatio.height;
    if( mH > mW )
        aspectFillSize.width = mH * aspectRatio.width;
    else if( mW > mH )
        aspectFillSize.height = mW * aspectRatio.height;
    return aspectFillSize;
}

- (void)secureViewWithBackgroundColor: (NSString *)color {
  if (@available(iOS 13.0, *)) {
    if (secureField == nil) {
      [self initTextField];
    }
    [secureField setSecureTextEntry: TRUE];
    [secureField setBackgroundColor: [self colorFromHexString: color]];
  } else return;
}

- (void) initTextField {
    CGRect screenRect = [[UIScreen mainScreen] bounds];
    secureField = [[UITextField alloc] initWithFrame:CGRectMake(0, 0, screenRect.size.width, screenRect.size.height)];
    secureField.translatesAutoresizingMaskIntoConstraints = NO;

    [secureField setTextAlignment:NSTextAlignmentCenter];
    [secureField setUserInteractionEnabled: NO];

    UIWindow *window = [UIApplication sharedApplication].keyWindow;
    [window makeKeyAndVisible];
    [window.layer.superlayer addSublayer:secureField.layer];

    if (secureField.layer.sublayers.firstObject) {
        [secureField.layer.sublayers.firstObject addSublayer: window.layer];
    }
}

- (void)removeScreenShot {
  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  if (secureField != nil) {
      // if (imageView != nil) {
      //     [imageView setImage: nil];
      //     [imageView removeFromSuperview];
      // }
      // if (scrollView != nil) {
      //     [scrollView removeFromSuperview];
      // }
    [secureField setSecureTextEntry: FALSE];
    [secureField setBackgroundColor: [UIColor clearColor]];
    [secureField setBackground: nil];
    CALayer *secureFieldLayer = secureField.layer.sublayers.firstObject;
    if ([window.layer.superlayer.sublayers containsObject:secureFieldLayer]) {
       [secureFieldLayer removeFromSuperlayer];
    }
  }
}

- (UIColor *)colorFromHexString:(NSString *)hexString {
    unsigned rgbValue = 0;
    NSScanner *scanner = [NSScanner scannerWithString:hexString];
    [scanner setScanLocation:1]; // bypass '#' character
    [scanner scanHexInt:&rgbValue];
    return [UIColor colorWithRed:((rgbValue & 0xFF0000) >> 16)/255.0 green:((rgbValue & 0xFF00) >> 8)/255.0 blue:(rgbValue & 0xFF)/255.0 alpha:1.0];
}

- (UIImage *)convertViewToImage:(UIView *)view {
    // UIGraphicsBeginImageContextWithOptions(view.bounds.size, view.opaque, 0.0);
    // [view.layer renderInContext:UIGraphicsGetCurrentContext()];
    UIGraphicsBeginImageContextWithOptions(view.bounds.size, NO, 0.0);
    [view drawViewHierarchyInRect:view.bounds afterScreenUpdates:YES];
    UIImage *image = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();
    return image;
}

#pragma mark - Public API

RCT_EXPORT_METHOD(addListener:(NSString *)eventType) {
    (void)eventType;
    hasListeners = TRUE;
    [self startNotificationObserversIfNeeded];
}

RCT_EXPORT_METHOD(removeListeners:(double)count) {
    (void)count;
}

RCT_EXPORT_METHOD(scanScreenshotDirectory) {
}

RCT_EXPORT_METHOD(startScreenCaptureDetection:
  (RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
) {
    (void)reject;
    resolve(nil);
}

RCT_EXPORT_METHOD(stopScreenCaptureDetection:
  (RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
) {
    (void)reject;
    resolve(nil);
}

RCT_EXPORT_METHOD(togglePreventScreenshot:(BOOL) isPrevent) {
    self->enabled = isPrevent;
    [self emitPreventScreenshotChangedEvent:@{@"isPrevent": @(isPrevent), @"success": @YES}];

    if (isPrevent) {
      dispatch_async(dispatch_get_main_queue(), ^{
          [self secureViewWithBackgroundColor: @"#7084FF"];
      });
    } else {
      dispatch_async(dispatch_get_main_queue(), ^{
          [self removeScreenShot];
          // [[NSNotificationCenter defaultCenter]removeObserver:UIScreenCapturedDidChangeNotification];
      });
    }
}

RCT_EXPORT_METHOD(setAppSwitcherBlurEnabled:(BOOL)isEnabled) {
    self->appSwitcherBlurEnabled = isEnabled;
}

RCT_EXPORT_METHOD(iosProtectFromScreenRecording:
  (RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
) {
    (void)reject;
    [[ScreenShield shared] protectFromScreenRecording];
    resolve(nil);
}

RCT_EXPORT_METHOD(iosUnprotectFromScreenRecording:
  (RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
) {
    (void)reject;
    [[ScreenShield shared] unprotectFromScreenRecording];
    resolve(nil);
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(iosIsBeingCaptured) {
    BOOL isCaptured = [UIScreen mainScreen].isCaptured;
    return @(isCaptured);
}

@end
