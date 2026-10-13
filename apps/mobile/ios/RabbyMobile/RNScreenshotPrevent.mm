//#import <Foundation/Foundation.h>
#import "RNScreenshotPrevent.h"
#import "UIImage+ImageEffects.h"
#import <React/RCTUtils.h>

@implementation RNScreenshotPrevent {
    BOOL hasListeners;
    NSUInteger listenerCount;
    BOOL legacyObservationRequested;
    BOOL codegenEventEmitterReady;
    BOOL notificationObserversInvalidated;
    NSUInteger screenshotCaptureConsumers;
    BOOL enabled;
    BOOL appSwitcherBlurEnabled;
    UIImageView *obfuscatingView;
    UITextField *secureField;
    id screenshotObserver;
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
- (NSArray<NSString *> *)supportedEvents {
    return @[
      @"userDidTakeScreenshot",
      @"screenCapturedChanged",
      @"appSwitcherBlurChanged",
      @"preventScreenshotChanged",
      @"androidOnLifeCycleChanged" // robust, not really used
    ];
}

#if RCT_NEW_ARCH_ENABLED
- (void)setEventEmitterCallback:(EventEmitterCallbackWrapper *)eventEmitterCallbackWrapper {
    @synchronized (self) {
        if (notificationObserversInvalidated) {
            return;
        }
        [super setEventEmitterCallback:eventEmitterCallbackWrapper];
        // Codegen subscriptions do not call the legacy addListener: method.
        codegenEventEmitterReady = YES;
    }
    [self synchronizeNotificationObservers];
}

- (void)addListener:(NSString *)eventType {
    (void)eventType;
    @synchronized (self) {
        if (notificationObserversInvalidated) {
            return;
        }
        listenerCount += 1;
        if (listenerCount == 1) {
            [self startObserving];
        }
    }
}

- (void)removeListeners:(double)count {
    @synchronized (self) {
        listenerCount = count >= listenerCount ? 0 : listenerCount - (NSUInteger)count;
        if (listenerCount == 0) {
            [self stopObserving];
        }
    }
}
#endif

- (dispatch_queue_t)methodQueue
{
    return dispatch_get_main_queue();
}

#pragma mark - Lifecycle

- (void) startObserving {
    @synchronized (self) {
        if (notificationObserversInvalidated) {
            return;
        }
        legacyObservationRequested = YES;
    }
    [self synchronizeNotificationObservers];
}

- (void) stopObserving {
    @synchronized (self) {
        legacyObservationRequested = NO;
    }
    [self synchronizeNotificationObservers];
}

- (void)synchronizeNotificationObservers {
    __weak RNScreenshotPrevent *weakSelf = self;
    RCTExecuteOnMainQueue(^{
        RNScreenshotPrevent *strongSelf = weakSelf;
        if (!strongSelf) {
            return;
        }
        @synchronized (strongSelf) {
            // Re-read demand on the main queue: a queued start must not revive
            // a module that was invalidated before this block could run.
            BOOL shouldObserve = !strongSelf->notificationObserversInvalidated &&
                (strongSelf->legacyObservationRequested || strongSelf->codegenEventEmitterReady);
            if (shouldObserve) {
                [strongSelf startNotificationObserversIfNeeded];
            } else {
                [strongSelf stopNotificationObservers];
                if (strongSelf->notificationObserversInvalidated) {
                    [strongSelf clearOwnedObfuscatingView];
                }
            }
        }
    });
}

- (BOOL)canHandleNotification {
    @synchronized (self) {
        return hasListeners && !notificationObserversInvalidated;
    }
}

- (BOOL)canCaptureScreenshot {
    @synchronized (self) {
        return [self canHandleNotification] && screenshotCaptureConsumers > 0 && !enabled;
    }
}

- (void)invalidate {
    @synchronized (self) {
        notificationObserversInvalidated = YES;
        screenshotCaptureConsumers = 0;
    }
    [self synchronizeNotificationObservers];
#if !RCT_NEW_ARCH_ENABLED
    [super invalidate];
#endif
}

- (void)dealloc {
    // Notification cleanup is thread-safe; the owned view is removed on main
    // without capturing the deallocating module in the queued block.
    [self stopNotificationObservers];
    [self clearOwnedObfuscatingView];
}

- (void)clearOwnedObfuscatingView {
    UIImageView *view = obfuscatingView;
    obfuscatingView = nil;
    RCTExecuteOnMainQueue(^{
        [view removeFromSuperview];
    });
}

- (void)startNotificationObserversIfNeeded {
    if (hasListeners) {
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

    // handle screenshot taken event
    // [center addObserver:self selector:@selector(handleAppScreenshotNotification)
    //                         name:UIApplicationUserDidTakeScreenshotNotification
    //                         // queue:mainQueue
    //                         object:nil];

    __weak RNScreenshotPrevent *weakSelf = self;
    screenshotObserver = [center addObserverForName:UIApplicationUserDidTakeScreenshotNotification
                                               object:nil
                                                queue:mainQueue
                                           usingBlock:^(NSNotification *notification) {
      RNScreenshotPrevent *strongSelf = weakSelf;
      if (![strongSelf canHandleNotification]) {
          return;
      }
      // A Codegen emitter can exist before JS has subscribed. Capture files
      // only after the feedback owner explicitly confirms its cleanup is ready.
      // Other listeners still receive the screenshot signal without an image.
      if ([strongSelf canCaptureScreenshot]) {
          NSMutableDictionary *result = [@{
            @"path": @"Error retrieving file",
            @"name": @"",
            @"height": @"",
            @"width": @"",
            @"imageBase64": @"",
            @"imageType": @"",
            @"captured": @FALSE
          } mutableCopy];
          UIImage *image = [strongSelf convertVisibleWindowsToImage];
          if (!image) {
              UIViewController *presentedViewController = RCTPresentedViewController();
              UIView *fallbackView = presentedViewController.view.superview ?: presentedViewController.view;
              image = [strongSelf convertViewToImage:fallbackView];
          }
          NSData *data = UIImagePNGRepresentation(image);
          if (!data) {
              [strongSelf emitUserDidTakeScreenshotEvent:result];
            // reject(@"error", @"Failed to convert image to PNG", nil);
            return;
          }

          NSString *tempDir = [NSTemporaryDirectory() stringByAppendingPathComponent:@"rabby-screen-capture"];
          BOOL directoryReady = [[NSFileManager defaultManager]
            createDirectoryAtPath:tempDir
            withIntermediateDirectories:YES
            attributes:nil
            error:nil];
          if (!directoryReady) {
              [strongSelf emitUserDidTakeScreenshotEvent:result];
              return;
          }

          NSString *fileName = [NSString stringWithFormat:@"rabby-screen-capture-%@.png", [[NSUUID UUID] UUIDString]];
          NSString *filePath = [tempDir stringByAppendingPathComponent:fileName];
          BOOL success = [data writeToFile:filePath options:NSDataWritingAtomic error:nil];
          if (success) {
            [result setObject:filePath forKey:@"path"];
            [result setObject:fileName forKey:@"name"];
            [result setObject:@(image.size.height) forKey:@"height"];
            [result setObject:@(image.size.width) forKey:@"width"];
            [result setObject:@"" forKey:@"imageBase64"];
            [result setObject:@"png" forKey:@"imageType"];
            [result setObject:@TRUE forKey:@"captured"];
          }
          BOOL emitted = [strongSelf emitUserDidTakeScreenshotEvent:result];
          if (success && !emitted) {
              // Invalidation can race image capture. JS cannot clean up a file
              // whose event was not emitted, so remove only this capture.
              [[NSFileManager defaultManager] removeItemAtPath:filePath error:nil];
          }
      } else {
          [strongSelf emitUserDidTakeScreenshotEvent:nil];
      }
    }];

    [center addObserver:self selector:@selector(handleScreenCapturedNotification)
                            name:UIScreenCapturedDidChangeNotification
                            object:nil];

    hasListeners = TRUE;
}

- (void)stopNotificationObservers {
    if (!hasListeners) {
        return;
    }

    [[NSNotificationCenter defaultCenter] removeObserver:self];
    if (screenshotObserver != nil) {
        [[NSNotificationCenter defaultCenter] removeObserver:screenshotObserver];
        screenshotObserver = nil;
    }

    hasListeners = FALSE;
}

#pragma mark - App Notification Methods

- (void)emitAppSwitcherBlurVisibilityChanged:(BOOL)visible {
    if (hasListeners) {
        // The JS overlay owns the normal app-switcher blur presentation so we only
        // emit a deterministic lifecycle signal here and avoid depending on RN AppState.
        [self emitAppSwitcherBlurChangedEvent:@{@"visible": @(visible)}];
    }
}

- (BOOL)emitUserDidTakeScreenshotEvent:(NSDictionary *)body {
    @synchronized (self) {
        if (![self canHandleNotification]) {
            return NO;
        }
        if ([body[@"captured"] boolValue] && ![self canCaptureScreenshot]) {
            return NO;
        }
#if RCT_NEW_ARCH_ENABLED
        [self emitUserDidTakeScreenshot:body ?: @{}];
#else
        [self sendEventWithName:@"userDidTakeScreenshot" body:body];
#endif
        // This reports invocation only, not acknowledgement by a JS consumer.
        return YES;
    }
}

- (void)emitAppSwitcherBlurChangedEvent:(NSDictionary *)body {
    @synchronized (self) {
        if (![self canHandleNotification]) {
            return;
        }
#if RCT_NEW_ARCH_ENABLED
        [self emitAppSwitcherBlurChanged:body];
#else
        [self sendEventWithName:@"appSwitcherBlurChanged" body:body];
#endif
    }
}

- (void)emitScreenCapturedChangedEvent:(NSDictionary *)body {
    @synchronized (self) {
        if (![self canHandleNotification]) {
            return;
        }
#if RCT_NEW_ARCH_ENABLED
        [self emitScreenCapturedChanged:body];
#else
        [self sendEventWithName:@"screenCapturedChanged" body:body];
#endif
    }
}

- (void)emitPreventScreenshotChangedEvent:(NSDictionary *)body {
    @synchronized (self) {
        if (![self canHandleNotification]) {
            return;
        }
#if RCT_NEW_ARCH_ENABLED
        [self emitPreventScreenshotChanged:body];
#else
        [self sendEventWithName:@"preventScreenshotChanged" body:body];
#endif
    }
}

/** displays blurry view when app becomes inactive */
- (void)handleAppStateResignActive {
    if (![self canHandleNotification]) {
        return;
    }
    if (!(self->enabled || self->appSwitcherBlurEnabled)) {
        return;
    }

    if (self->appSwitcherBlurEnabled) {
        [self emitAppSwitcherBlurVisibilityChanged:YES];
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

    blurredScreenImageView.image = [viewImage applyLightEffect];

    self->obfuscatingView = blurredScreenImageView;
    [keyWindow addSubview:self->obfuscatingView];
}

/** removes blurry view when app becomes active */
- (void)handleAppStateActive {
    [self clearOwnedObfuscatingView];

    // Mirror the resign-active signal so JS can hide the app-switcher overlay
    // without relying on the RN AppState transition timing.
    [self emitAppSwitcherBlurVisibilityChanged:NO];
}

/** sends screenshot taken event into app */
- (void) handleAppScreenshotNotification {
    // only send events when we have some listeners
    if(hasListeners) {
        [self emitUserDidTakeScreenshotEvent:nil];
    }
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
    if (!view) {
        return nil;
    }

    // UIGraphicsBeginImageContextWithOptions(view.bounds.size, view.opaque, 0.0);
    // [view.layer renderInContext:UIGraphicsGetCurrentContext()];
    UIGraphicsBeginImageContextWithOptions(view.bounds.size, NO, 0.0);
    [view drawViewHierarchyInRect:view.bounds afterScreenUpdates:YES];
    UIImage *image = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();
    return image;
}

- (NSArray<UIWindow *> *)visibleWindowsForScreenshot {
    NSMutableArray<UIWindow *> *windows = [NSMutableArray array];

    if (@available(iOS 13.0, *)) {
        for (UIScene *scene in [UIApplication sharedApplication].connectedScenes) {
            if (![scene isKindOfClass:[UIWindowScene class]]) {
                continue;
            }

            BOOL isForeground = scene.activationState == UISceneActivationStateForegroundActive ||
                scene.activationState == UISceneActivationStateForegroundInactive;
            if (!isForeground) {
                continue;
            }

            UIWindowScene *windowScene = (UIWindowScene *)scene;
            for (UIWindow *window in windowScene.windows) {
                if (!window.hidden && window.alpha > 0.01 && !CGRectIsEmpty(window.bounds)) {
                    [windows addObject:window];
                }
            }
        }
    }

    if (windows.count == 0) {
        for (UIWindow *window in [UIApplication sharedApplication].windows) {
            if (!window.hidden && window.alpha > 0.01 && !CGRectIsEmpty(window.bounds)) {
                [windows addObject:window];
            }
        }
    }

    [windows sortUsingComparator:^NSComparisonResult(UIWindow *left, UIWindow *right) {
        if (left.windowLevel < right.windowLevel) {
            return NSOrderedAscending;
        }

        if (left.windowLevel > right.windowLevel) {
            return NSOrderedDescending;
        }

        return NSOrderedSame;
    }];

    return windows;
}

- (UIWindow *)baseWindowForScreenshot:(NSArray<UIWindow *> *)windows {
    for (UIWindow *window in windows) {
        if (window.isKeyWindow) {
            return window;
        }
    }

    return windows.firstObject;
}

- (UIImage *)convertVisibleWindowsToImage {
    NSArray<UIWindow *> *windows = [self visibleWindowsForScreenshot];
    if (windows.count == 0) {
        return nil;
    }

    UIWindow *baseWindow = [self baseWindowForScreenshot:windows];
    CGSize canvasSize = baseWindow.bounds.size;
    CGFloat scale = baseWindow.screen.scale;
    if (canvasSize.width <= 0 || canvasSize.height <= 0) {
        canvasSize = [UIScreen mainScreen].bounds.size;
    }
    if (scale <= 0) {
        scale = 0.0;
    }

    UIGraphicsBeginImageContextWithOptions(canvasSize, NO, scale);
    for (UIWindow *window in windows) {
        CGRect drawRect = window.frame;
        if (CGRectIsEmpty(drawRect)) {
            drawRect = (CGRect){CGPointZero, window.bounds.size};
        }

        [window drawViewHierarchyInRect:drawRect afterScreenUpdates:NO];
    }
    UIImage *image = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();
    return image;
}

#pragma mark - Public API

- (void)applyPreventScreenshot:(BOOL)isPrevent {
    self->enabled = isPrevent;
    [self emitPreventScreenshotChangedEvent:@{@"isPrevent": @(isPrevent), @"success": @YES}];

    if (isPrevent) {
      dispatch_async(dispatch_get_main_queue(), ^{
          [self secureViewWithBackgroundColor: @"#7084FF"];
      });
    } else {
      dispatch_async(dispatch_get_main_queue(), ^{
          [self removeScreenShot];
          [[NSNotificationCenter defaultCenter]removeObserver:UIApplicationUserDidTakeScreenshotNotification];
          // [[NSNotificationCenter defaultCenter]removeObserver:UIScreenCapturedDidChangeNotification];
      });
    }
}

- (void)applyAppSwitcherBlurEnabled:(BOOL)isEnabled {
    self->appSwitcherBlurEnabled = isEnabled;
}

- (void)applyProtectFromScreenRecording {
    [[ScreenShield shared] protectFromScreenRecording];
}

- (void)applyUnprotectFromScreenRecording {
    [[ScreenShield shared] unprotectFromScreenRecording];
}

- (NSNumber *)currentScreenCaptureState {
    BOOL isCaptured = [UIScreen mainScreen].isCaptured;
    return @(isCaptured);
}

- (void)beginScreenshotCapture:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject {
    @synchronized (self) {
        if (notificationObserversInvalidated) {
            reject(@"E_SCREENSHOT_INVALIDATED", @"Screenshot module is invalidated", nil);
            return;
        }
        // Each started feedback subscription owns one demand. A delayed stop
        // from an older subscription must not disable a newer subscription.
        screenshotCaptureConsumers += 1;
    }
    resolve(nil);
}

- (void)endScreenshotCapture:(RCTPromiseResolveBlock)resolve {
    @synchronized (self) {
        if (screenshotCaptureConsumers > 0) {
            screenshotCaptureConsumers -= 1;
        }
    }
    resolve(nil);
}

#if RCT_NEW_ARCH_ENABLED
- (void)scanScreenshotDirectory {
    // Android-only API. Keep the cross-platform TurboModule contract a no-op on iOS.
}

- (void)startScreenCaptureDetection:(RCTPromiseResolveBlock)resolve
                             reject:(RCTPromiseRejectBlock)reject {
    [self beginScreenshotCapture:resolve reject:reject];
}

- (void)stopScreenCaptureDetection:(RCTPromiseResolveBlock)resolve
                            reject:(RCTPromiseRejectBlock)reject {
    (void)reject;
    [self endScreenshotCapture:resolve];
}

- (void)togglePreventScreenshot:(BOOL)isPrevent {
    [self applyPreventScreenshot:isPrevent];
}

- (void)setAppSwitcherBlurEnabled:(BOOL)isEnabled {
    [self applyAppSwitcherBlurEnabled:isEnabled];
}

- (NSNumber *)iosIsBeingCaptured {
    return [self currentScreenCaptureState];
}

- (void)iosProtectFromScreenRecording:(RCTPromiseResolveBlock)resolve
                               reject:(RCTPromiseRejectBlock)reject {
    (void)reject;
    [self applyProtectFromScreenRecording];
    resolve(nil);
}

- (void)iosUnprotectFromScreenRecording:(RCTPromiseResolveBlock)resolve
                                 reject:(RCTPromiseRejectBlock)reject {
    (void)reject;
    [self applyUnprotectFromScreenRecording];
    resolve(nil);
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
    return std::make_shared<facebook::react::NativeRNScreenshotPreventSpecJSI>(params);
}
#else
RCT_EXPORT_METHOD(startScreenCaptureDetection:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    [self beginScreenshotCapture:resolve reject:reject];
}

RCT_EXPORT_METHOD(stopScreenCaptureDetection:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    (void)reject;
    [self endScreenshotCapture:resolve];
}

RCT_EXPORT_METHOD(togglePreventScreenshot:(BOOL)isPrevent) {
    [self applyPreventScreenshot:isPrevent];
}

RCT_EXPORT_METHOD(setAppSwitcherBlurEnabled:(BOOL)isEnabled) {
    [self applyAppSwitcherBlurEnabled:isEnabled];
}

RCT_EXPORT_METHOD(iosProtectFromScreenRecording) {
    [self applyProtectFromScreenRecording];
}

RCT_EXPORT_METHOD(iosUnprotectFromScreenRecording) {
    [self applyUnprotectFromScreenRecording];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(iosIsBeingCaptured) {
    return [self currentScreenCaptureState];
}
#endif

@end
