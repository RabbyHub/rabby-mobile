//#import <Foundation/Foundation.h>
#import "RNScreenshotPrevent.h"
#import "UIImage+ImageEffects.h"

@implementation RNScreenshotPrevent {
    BOOL hasListeners;
    BOOL enabled;
    UIImageView *obfuscatingView;
    UITextField *secureField;
    // UIImageView *imageView;
}

// To export a module named RNScreenshotPrevent
RCT_EXPORT_MODULE();
- (NSArray<NSString *> *)supportedEvents {
    return @[
      @"userDidTakeScreenshot",
      @"screenCapturedChanged",
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
    NSNotificationCenter *center = [NSNotificationCenter defaultCenter];
    NSOperationQueue *mainQueue = [NSOperationQueue mainQueue];

    // TODO: allow configure that
    BOOL getScreenShotPath = TRUE;

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

    [center addObserverForName:UIApplicationUserDidTakeScreenshotNotification
                            object:nil
                            queue:mainQueue
                            usingBlock:^(NSNotification *notification) {
      if (self->hasListeners && getScreenShotPath) {
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

          UIImage *image = [self convertViewToImage:presentedViewController.view.superview];
          NSData *data = UIImagePNGRepresentation(image);
          if (!data) {
              [self sendEventWithName:@"userDidTakeScreenshot" body: result];
            // reject(@"error", @"Failed to convert image to PNG", nil);
            return;
          }

          [result setObject:@(image.size.height) forKey:@"height"];
          [result setObject:@(image.size.width) forKey:@"width"];
          [result setObject:[data base64EncodedStringWithOptions:0] forKey:@"imageBase64"];
          [result setObject:@"png" forKey:@"imageType"];
          [result setObject:@TRUE forKey:@"captured"];

          // NSString *tempDir = NSTemporaryDirectory();
          // NSString *fileName = [[NSUUID UUID] UUIDString];
          // NSString *filePath = [tempDir stringByAppendingPathComponent:[NSString stringWithFormat:@"%@.png", fileName]];

          // NSError *error = nil;
          // BOOL success = [data writeToFile:filePath options:NSDataWritingAtomic error:&error];
          // if (success) {
          //   [result setObject:filePath forKey:@"path"];
          //   [result setObject:fileName forKey:@"name"];
          // }
          [self sendEventWithName:@"userDidTakeScreenshot" body: result];
      } else if (self->hasListeners) {
          [self sendEventWithName:@"userDidTakeScreenshot" body: nil];
      }
    }];

    [center addObserver:self selector:@selector(handleScreenCapturedNotification)
                            name:UIScreenCapturedDidChangeNotification
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

- (void) handleScreenCapturedNotification {
    BOOL isCaptured = [UIScreen mainScreen].isCaptured;
#if DEBUG
    NSLog(@"AppStart: Main Screen is captured: %@", [UIScreen mainScreen].isCaptured ? @"YES" : @"NO");
#endif
    // only send events when we have some listeners
    if(hasListeners) {
        [self sendEventWithName:@"screenCapturedChanged" body:@{@"isBeingCaptured": @(isCaptured)}];
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

RCT_EXPORT_METHOD(togglePreventScreenshot:(BOOL) isPrevent) {
    self->enabled = isPrevent;
    [self sendEventWithName:@"preventScreenshotChanged" body:@{@"isPrevent": @(isPrevent), @"success": @YES}];

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

RCT_EXPORT_METHOD(iosProtectFromScreenRecording) {
    [[ScreenShield shared] protectFromScreenRecording];
}

RCT_EXPORT_METHOD(iosUnprotectFromScreenRecording) {
    [[ScreenShield shared] unprotectFromScreenRecording];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(iosIsBeingCaptured) {
    BOOL isCaptured = [UIScreen mainScreen].isCaptured;
    return @(isCaptured);
}

@end
