#import <UIKit/UIKit.h>
#import <CoreText/CoreText.h>
#import <objc/runtime.h>
#import <React/RCTFont.h>
#import <react/renderer/textlayoutmanager/RCTFontUtils.h>
#import "SvgGlyphHarness.h"
#include <cmath>
#include <cstdio>

@implementation RCTConvert
+ (NSDictionary *)NSDictionary:(id)value { return value; }
+ (NSString *)NSString:(id)value { return value; }
+ (NSNumber *)NSNumber:(id)value { return value; }
+ (NSArray<NSString *> *)NSStringArray:(id)value { return value; }
+ (CGFloat)CGFloat:(id)value { return [value doubleValue]; }
@end

static NSMutableArray<NSDictionary *> *results;

static void Check(NSString *name, BOOL passed)
{
  [results addObject:@{@"name" : name, @"passed" : @(passed)}];
}

static UIFont *ExpectedRounded(CGFloat size, UIFontWeight weight)
{
  UIFont *system = [UIFont systemFontOfSize:size weight:weight];
  UIFontDescriptor *descriptor =
      [system.fontDescriptor fontDescriptorWithDesign:UIFontDescriptorSystemDesignRounded];
  return descriptor ? [UIFont fontWithDescriptor:descriptor size:size] : nil;
}

static BOOL SameFont(UIFont *actual, UIFont *expected)
{
  return actual && expected && [actual.fontName isEqualToString:expected.fontName] &&
      fabs(actual.pointSize - expected.pointSize) < 0.001 &&
      fabs(RCTGetFontWeight(actual) - RCTGetFontWeight(expected)) < 0.01;
}

static UIFont *Legacy(NSString *family, NSString *weight, CGFloat size = 20, CGFloat multiplier = 1)
{
  return [RCTFont updateFont:nil
                 withFamily:family
                       size:@(size)
                     weight:weight
                      style:nil
                    variant:nil
            scaleMultiplier:multiplier];
}

static UIFont *Fabric(NSString *family, UIFontWeight weight, CGFloat size = 20, CGFloat multiplier = 1,
                      RCTFontStyle style = RCTFontStyleNormal, RCTFontVariant variant = RCTFontVariantDefault)
{
  RCTFontProperties properties;
  properties.family = family;
  properties.size = size;
  properties.weight = weight;
  properties.style = style;
  properties.variant = variant;
  properties.sizeMultiplier = multiplier;
  return RCTFontWithFontProperties(properties);
}

static BOOL HasTabularFeature(UIFont *font)
{
  NSArray *features = [font.fontDescriptor objectForKey:UIFontDescriptorFeatureSettingsAttribute];
  for (NSDictionary *feature in features) {
    if ([feature[UIFontFeatureTypeIdentifierKey] integerValue] == kNumberSpacingType &&
        [feature[UIFontFeatureSelectorIdentifierKey] integerValue] == kMonospacedNumbersSelector) {
      return YES;
    }
  }
  return NO;
}

static IMP originalDesign;
static UIFontDescriptor *NoRoundedDesign(id self, SEL selector, UIFontDescriptorSystemDesign design)
{
  if ([design isEqualToString:UIFontDescriptorSystemDesignRounded]) return nil;
  return ((UIFontDescriptor *(*)(id, SEL, UIFontDescriptorSystemDesign))originalDesign)(self, selector, design);
}

int main()
{
  @autoreleasepool {
    results = [NSMutableArray new];
    NSDictionary *svgObservation = nil;
    @try {
      struct WeightCase { __unsafe_unretained NSString *css; UIFontWeight input; UIFontWeight expected; };
      const WeightCase weights[] = {
          {@"400", UIFontWeightRegular, UIFontWeightRegular},
          {@"500", UIFontWeightMedium, UIFontWeightMedium},
          {@"700", UIFontWeightBold, UIFontWeightBold},
          {@"900", UIFontWeightBlack, UIFontWeightHeavy}};
      for (const auto &item : weights) {
        UIFont *expected = ExpectedRounded(20, item.expected);
        Check([@"legacy-weight-" stringByAppendingString:item.css],
              SameFont(Legacy(@"SF Pro Rounded", item.css), expected));
        Check([@"fabric-weight-" stringByAppendingString:item.css],
              SameFont(Fabric(@"SF Pro Rounded", item.input), expected));
      }

      NSArray *aliases = @[@"SFProRounded-Regular", @"SFProRounded-Medium", @"SFProRounded-Bold", @"SFProRounded-Heavy"];
      for (NSUInteger i = 0; i < aliases.count; i++) {
        UIFont *expected = ExpectedRounded(20, weights[i].expected);
        Check([@"legacy-alias-" stringByAppendingString:aliases[i]], SameFont(Legacy(aliases[i], nil), expected));
        Check([@"fabric-alias-" stringByAppendingString:aliases[i]], SameFont(Fabric(aliases[i], NAN), expected));
        Check([@"legacy-explicit-regular-" stringByAppendingString:aliases[i]],
              SameFont(Legacy(aliases[i], @"400"), ExpectedRounded(20, UIFontWeightRegular)));
        Check([@"fabric-explicit-regular-" stringByAppendingString:aliases[i]],
              SameFont(Fabric(aliases[i], UIFontWeightRegular), ExpectedRounded(20, UIFontWeightRegular)));
      }

      Check(@"legacy-size-multiplier-retains-rounding", fabs(Legacy(@"SF Pro Rounded", @"500", 15.2, 1.3).pointSize - 20) < 0.001);
      Check(@"fabric-size-multiplier-retains-fraction", fabs(Fabric(@"SF Pro Rounded", UIFontWeightMedium, 15.2, 1.3).pointSize - 19.76) < 0.001);

      UIFont *legacyVariant = [RCTFont updateFont:nil withFamily:@"SF Pro Rounded" size:@20 weight:@"700"
                                           style:nil variant:@[@"tabular-nums"] scaleMultiplier:1];
      UIFont *fabricVariant = Fabric(@"SF Pro Rounded", UIFontWeightBold, 20, 1, RCTFontStyleNormal, RCTFontVariantTabularNums);
      Check(@"legacy-tabular-nums", HasTabularFeature(legacyVariant));
      Check(@"fabric-tabular-nums", HasTabularFeature(fabricVariant));
      UIFont *expected = ExpectedRounded(20, UIFontWeightBold);
      UIFontDescriptor *italicDescriptor = [expected.fontDescriptor fontDescriptorWithSymbolicTraits:
          expected.fontDescriptor.symbolicTraits | UIFontDescriptorTraitItalic];
      UIFont *expectedItalic = italicDescriptor ? [UIFont fontWithDescriptor:italicDescriptor size:20] : expected;
      UIFont *legacyItalic = [RCTFont updateFont:nil withFamily:@"SF Pro Rounded" size:@20 weight:@"700"
                                          style:@"italic" variant:nil scaleMultiplier:1];
      UIFont *fabricItalic = Fabric(@"SF Pro Rounded", UIFontWeightBold, 20, 1, RCTFontStyleItalic);
      Check(@"legacy-italic", SameFont(legacyItalic, expectedItalic));
      Check(@"fabric-italic", SameFont(fabricItalic, expectedItalic));

      for (UIFont *derived in @[legacyVariant, fabricVariant, legacyItalic, fabricItalic]) {
        UIFont *medium = [RCTFont updateFont:derived withWeight:@"500"];
        UIFont *resized = [RCTFont updateFont:medium withSize:@31];
        UIFont *normal = [RCTFont updateFont:resized withStyle:@"normal"];
        Check([NSString stringWithFormat:@"derived-rounded-weight-resize-%lu", (unsigned long)results.count],
              SameFont(normal, ExpectedRounded(31, UIFontWeightMedium)));
      }

      NSArray *others = @[@"System", @"SystemCondensed", @"Helvetica", @"Menlo", @"ui-rounded", @"MissingCustomFont"];
      for (NSString *family in others) {
        Check([@"resolver-declines-" stringByAppendingString:family],
              RCTFontWithSystemFontAlias(family, 20, UIFontWeightRegular, YES, NO, NO, nil) == nil);
      }
      Check(@"legacy-system-unchanged", SameFont(Legacy(@"System", @"700"), [UIFont systemFontOfSize:20 weight:UIFontWeightBold]));
      Check(@"legacy-sf-pro-system", SameFont(Legacy(@"SF Pro", @"700"), [UIFont systemFontOfSize:20 weight:UIFontWeightBold]));
      Check(@"fabric-sf-pro-system", SameFont(Fabric(@"SF Pro", UIFontWeightBold), [UIFont systemFontOfSize:20 weight:UIFontWeightBold]));
      Check(@"default-handler-not-installed", !RCTHasFontHandlerSet());

      // A public-API fault injection confined to this standalone test process.
      // Unique sizes avoid a previous successful cache entry hiding the failure.
      Class descriptorClass = [[UIFont systemFontOfSize:73.125].fontDescriptor class];
      Method designMethod = class_getInstanceMethod(descriptorClass, @selector(fontDescriptorWithDesign:));
      originalDesign = method_setImplementation(designMethod, (IMP)NoRoundedDesign);
      UIFont *legacyFallback = nil;
      UIFont *fabricFallback = nil;
      @try {
        legacyFallback = Legacy(@"SF Pro Rounded", @"500", 73.125);
        fabricFallback = Fabric(@"SF Pro Rounded", UIFontWeightMedium, 74.125);
        Check(@"legacy-nil-design-safe-fallback", SameFont(legacyFallback, [UIFont systemFontOfSize:73.125 weight:UIFontWeightMedium]));
        Check(@"fabric-nil-design-safe-fallback", SameFont(fabricFallback, [UIFont systemFontOfSize:74.125 weight:UIFontWeightMedium]));
      } @finally {
        method_setImplementation(designMethod, originalDesign);
      }
      Check(@"fallback-does-not-mark-shared-system-font",
            SameFont([RCTFont updateFont:legacyFallback withSize:@75], [UIFont systemFontOfSize:75 weight:UIFontWeightMedium]));
      Check(@"fabric-fallback-does-not-mark-shared-system-font",
            SameFont([RCTFont updateFont:fabricFallback withSize:@76], [UIFont systemFontOfSize:76 weight:UIFontWeightMedium]));
      Check(@"failed-design-not-stuck-in-cache", SameFont(Legacy(@"SF Pro Rounded", @"500", 73.125), ExpectedRounded(73.125, UIFontWeightMedium)));

      // This method body is extracted unchanged from the installed react-native-svg.
      // Only its enclosing font-context inputs are replaced by a minimal fixture.
      SvgFontInput input;
      input.fontSize = 20;
      input.fontFamily = @"SF Pro Rounded";
      input.fontStyle = RNSVGFontStyleNormal;
      input.fontWeight = RNSVGFontWeight900;
      input.absoluteFontWeight = 900;
      SvgGlyphHarness *svg = [SvgGlyphHarness new];
      svg->topFont_ = &input;
      UIFont *svgFont = (__bridge UIFont *)[svg getGlyphFont];
      UIFont *heavy = ExpectedRounded(20, UIFontWeightHeavy);
      NSArray *axes = CFBridgingRelease(CTFontCopyVariationAxes((__bridge CTFontRef)heavy));
      svgObservation = @{
        @"axisCount" : @(axes.count),
        @"beforeWeight" : @(RCTGetFontWeight(heavy)),
        @"afterWeight" : @(RCTGetFontWeight(svgFont)),
        @"beforeName" : heavy.fontName,
        @"afterName" : svgFont.fontName,
        @"heavyPreserved" : @(SameFont(svgFont, heavy)),
      };
      Check(@"svg-glyph-900-heavy-preserved", SameFont(svgFont, heavy));
    } @catch (NSException *exception) {
      [results addObject:@{@"name" : @"uncaught-native-exception", @"passed" : @NO, @"exception" : exception.name}];
    }

    NSUInteger failed = 0;
    for (NSDictionary *result in results) if (![result[@"passed"] boolValue]) failed++;
    NSDictionary *report = @{
      @"layer" : @"UIKit simulator integration; real RN font resolver sources; converter/logging/context shims",
      @"tests" : results,
      @"failed" : @(failed),
      @"svgObservation" : svgObservation ?: @{},
    };
    NSData *json = [NSJSONSerialization dataWithJSONObject:report options:0 error:nil];
    fwrite(json.bytes, 1, json.length, stdout);
    fputc('\n', stdout);
    return failed == 0 ? 0 : 1;
  }
}
