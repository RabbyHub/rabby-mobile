// ReactNativeSecurity.mm
#import "ReactNativeSecurity.h"
#import <LocalAuthentication/LocalAuthentication.h>
#import <Security/Security.h>

@implementation ReactNativeSecurity

// To export a module named ReactNativeSecurity
RCT_EXPORT_MODULE();

#pragma mark - Public API
RCT_EXPORT_METHOD(blockScreen) {
  RCTLogInfo(@"`blockScreen` hasn't been supported on iOS");
}

RCT_EXPORT_METHOD(unblockScreen) {
  RCTLogInfo(@"`unblockScreen` hasn't been supported on iOS");
}

RCT_EXPORT_METHOD(updateGenericPassword:(NSString *)username
                  value:(NSString *)value
                  options:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  NSString *service = options[@"service"];
  NSString *accessGroup = options[@"accessGroup"];
  NSNumber *cloudSync = options[@"cloudSync"];
  if (![service isKindOfClass:[NSString class]] || service.length == 0 ||
      username.length == 0 || value == nil ||
      (accessGroup != nil &&
        (![accessGroup isKindOfClass:[NSString class]] || accessGroup.length == 0)) ||
      (cloudSync != nil && ![cloudSync isKindOfClass:[NSNumber class]])) {
    reject(@"E_KEYCHAIN_UPDATE_ARGUMENT", @"Invalid Keychain update options", nil);
    return;
  }

  LAContext *authenticationContext = [LAContext new];
  authenticationContext.interactionNotAllowed = YES;
  NSMutableDictionary *query = [@{
    (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
    (__bridge id)kSecAttrService: service,
    (__bridge id)kSecAttrAccount: username,
    (__bridge id)kSecAttrSynchronizable: @([cloudSync boolValue]),
    (__bridge id)kSecReturnPersistentRef: @YES,
    (__bridge id)kSecMatchLimit: (__bridge id)kSecMatchLimitAll,
    (__bridge id)kSecUseAuthenticationContext: authenticationContext
  } mutableCopy];
  if (accessGroup != nil) {
    query[(__bridge id)kSecAttrAccessGroup] = accessGroup;
  }

  CFTypeRef result = NULL;
  OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &result);
  NSArray *matches = CFBridgingRelease(result);
  if (status != errSecSuccess || ![matches isKindOfClass:[NSArray class]] ||
      matches.count != 1 || ![matches.firstObject isKindOfClass:[NSData class]]) {
    NSString *code = status == errSecSuccess ? @"E_KEYCHAIN_UPDATE_AMBIGUOUS" : @"E_KEYCHAIN_UPDATE_LOOKUP";
    reject(code, @"Could not locate exactly one Keychain entry", nil);
    return;
  }

  NSDictionary *target = @{
    (__bridge id)kSecValuePersistentRef: matches.firstObject,
    (__bridge id)kSecUseAuthenticationContext: authenticationContext
  };
  NSDictionary *replacement = @{
    (__bridge id)kSecValueData: [value dataUsingEncoding:NSUTF8StringEncoding]
  };
  status = SecItemUpdate((__bridge CFDictionaryRef)target, (__bridge CFDictionaryRef)replacement);
  if (status != errSecSuccess) {
    reject(@"E_KEYCHAIN_UPDATE_WRITE", @"Could not update Keychain entry", nil);
    return;
  }
  resolve(nil);
}
@end
