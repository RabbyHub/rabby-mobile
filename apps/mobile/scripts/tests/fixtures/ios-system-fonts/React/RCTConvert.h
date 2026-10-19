#pragma once

// Standalone harness boundary only: valid JSON scalar/array conversions, not
// React Native view managers. The tested RCTFont and RCTFontUtils stay unmodified.
#import <UIKit/UIKit.h>

#define RCT_EXTERN extern "C" __attribute__((visibility("default")))
#define RCT_DEBUG 0

@interface RCTConvert : NSObject
+ (NSDictionary *)NSDictionary:(id)value;
+ (NSString *)NSString:(id)value;
+ (NSNumber *)NSNumber:(id)value;
+ (NSArray<NSString *> *)NSStringArray:(id)value;
+ (CGFloat)CGFloat:(id)value;
@end

#define RCT_ENUM_CONVERTER(type, values, defaultValue, getter) \
  +(type)type : (id)value                                    \
  {                                                         \
    NSDictionary *mapping = values;                         \
    NSNumber *result = [value isKindOfClass:NSNumber.class]  \
        ? value                                            \
        : (value ? mapping[value] : nil);                   \
    return (type)[(result ?: @(defaultValue)) getter];       \
  }

#define RCT_ARRAY_CONVERTER(type)                           \
  +(NSArray *)type##Array : (NSArray *)values               \
  {                                                        \
    if (!values) return nil;                               \
    NSMutableArray *result = [NSMutableArray new];          \
    for (id value in values) {                             \
      id converted = [self type:value];                    \
      if (converted) [result addObject:converted];          \
    }                                                      \
    return result;                                         \
  }
