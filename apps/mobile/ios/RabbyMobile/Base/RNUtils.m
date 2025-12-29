// RNUtils.m
#import "RNUtils.h"

NSDictionary<NSString *, id> *RNParseOptionValue(id _Nullable value) {
    NSString *jstype = @"nil";
    NSNumber *boolVal = @NO;
    NSString *stringVal = nil;
    NSNumber *numberVal = @0;

    if (value == nil || value == [NSNull null]) {
        jstype = @"nil";
    }
    else if ([value isKindOfClass:[NSString class]]) {
        jstype = @"string";
        stringVal = value;
    }
    else if ([value isKindOfClass:[NSNumber class]]) {
        if (CFGetTypeID((__bridge CFTypeRef)value) == CFBooleanGetTypeID()) {
            jstype = @"boolean";
            boolVal = value;
        } else {
            jstype = @"number";
            numberVal = value;
        }
    }

    return @{
        @"jstype": jstype,
        @"boolVal": boolVal,
        @"stringVal": stringVal ?: [NSNull null],
        @"numberVal": numberVal
    };
}

NSDictionary<NSString *, id> *RNParseOptionDict(NSDictionary<NSString *, id> * _Nullable options,
                                                NSString *key) {
    id value = options ? options[key] : nil;
    return RNParseOptionValue(value);
}
