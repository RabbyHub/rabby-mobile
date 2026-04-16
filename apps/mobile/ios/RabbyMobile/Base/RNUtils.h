// RNUtils.h
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

NSDictionary<NSString *, id> *RNParseOptionValue(id _Nullable value);

NSDictionary<NSString *, id> *RNParseOptionDict(NSDictionary<NSString *, id> * _Nullable options,
                                                NSString *key);

NS_ASSUME_NONNULL_END
