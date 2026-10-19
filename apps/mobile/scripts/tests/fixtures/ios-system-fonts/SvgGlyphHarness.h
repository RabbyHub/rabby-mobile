#pragma once
#import <UIKit/UIKit.h>
#import <CoreText/CoreText.h>
#import <React/RCTFont.h>
#import "RNSVGTextProperties.h"

// Input context only. The getGlyphFont implementation is read verbatim from
// this checkout's installed react-native-svg, rather than reimplemented here.
struct SvgFontInput {
  CGFloat fontSize;
  NSString *fontFamily;
  RNSVGFontStyle fontStyle;
  RNSVGFontWeight fontWeight;
  int absoluteFontWeight;
};

@interface SvgGlyphHarness : NSObject {
 @public
  SvgFontInput *topFont_;
}
- (CTFontRef)getGlyphFont;
@end
