//#import <Foundation/Foundation.h>
#import "RNScreenshotPrevent.h"
#import "UIImage+ImageEffects.h"

@implementation RNScreenshotPrevent {
    BOOL hasListeners;
    BOOL enabled;
    UIImageView *obfuscatingView;
    UITextField *secureField;
}

// To export a module named RNScreenshotPrevent
RCT_EXPORT_MODULE();
- (NSArray<NSString *> *)supportedEvents {
    return @[
      @"userDidTakeScreenshot",
      @"preventScreenshotChanged"
    ];
}

- (dispatch_queue_t)methodQueue
{
    return dispatch_get_main_queue();
}

#pragma mark - Lifecycle

- (void) startObserving {
    NSNotificationCenter *center = [NSNotificationCenter defaultCenter];
    // handle inactive event
    [center addObserver:self selector:@selector(handleAppStateResignActive)
                            name:UIApplicationWillResignActiveNotification
                            object:nil];
    // handle active event
    [center addObserver:self selector:@selector(handleAppStateActive)
                            name:UIApplicationDidBecomeActiveNotification
                            object:nil];
    // handle screenshot taken event
    [center addObserver:self selector:@selector(handleAppScreenshotNotification)
                            name:UIApplicationUserDidTakeScreenshotNotification
                            object:nil];

    hasListeners = TRUE;
}

- (void) stopObserving {
    [[NSNotificationCenter defaultCenter] removeObserver:self];

    hasListeners = FALSE;
}

#pragma mark - App Notification Methods

/** displays blurry view when app becomes inactive */
- (void)handleAppStateResignActive {
    if (self->enabled) {
        UIWindow    *keyWindow = [UIApplication sharedApplication].keyWindow;
        UIImageView *blurredScreenImageView = [[UIImageView alloc] initWithFrame:keyWindow.bounds];

        UIGraphicsBeginImageContext(keyWindow.bounds.size);
        [keyWindow drawViewHierarchyInRect:keyWindow.frame afterScreenUpdates:NO];
        UIImage *viewImage = UIGraphicsGetImageFromCurrentImageContext();
        UIGraphicsEndImageContext();

        blurredScreenImageView.image = [viewImage applyLightEffect];

        self->obfuscatingView = blurredScreenImageView;
        [keyWindow addSubview:self->obfuscatingView];
    }
}

/** removes blurry view when app becomes active */
- (void)handleAppStateActive {
    if  (self->obfuscatingView) {
        [UIView animateWithDuration: 0.3
                         animations: ^ {
                             self->obfuscatingView.alpha = 0;
                         }
                         completion: ^(BOOL finished) {
                             [self->obfuscatingView removeFromSuperview];
                             self->obfuscatingView = nil;
                         }
         ];
    }
}

/** sends screenshot taken event into app */
- (void) handleAppScreenshotNotification {
    // only send events when we have some listeners
    if(hasListeners) {
        [self sendEventWithName:@"userDidTakeScreenshot" body:nil];
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

#pragma mark - Public API

RCT_EXPORT_METHOD(togglePreventScreenshot:(BOOL) isPrevent) {
    self->enabled = isPrevent;
    [self sendEventWithName:@"preventScreenshotChanged" body:@{@"isPrevent": @(isPrevent), @"success": @YES}];
}

RCT_EXPORT_METHOD(iosProtectFromScreenRecording) {
    [[ScreenShield shared] protectFromScreenRecording];
}

RCT_EXPORT_METHOD(iosUnprotectFromScreenRecording) {
    [[ScreenShield shared] unprotectFromScreenRecording];
}

/** adds secure textfield view */
RCT_EXPORT_METHOD(enableSecureView: (NSString *)imagePath) {
    // no-op on iOS
}

/** removes secure textfield from the view */
RCT_EXPORT_METHOD(disableSecureView) {
    // no-op on iOS
}

@end
