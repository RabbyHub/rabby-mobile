// ReactNativeSecurity.mm
#import "ReactNativeSecurity.h"
#import <CommonCrypto/CommonDigest.h>
#import <CommonCrypto/CommonHMAC.h>
#import <Security/Security.h>

static NSString *const SecurePreferenceService = @"com.debank.rabbymobile.secure-preferences.v1";

@interface ReactNativeSecurity ()
@property (atomic, strong) NSData *securePreferenceKey;
@end

static NSDictionary *SecurePreferenceKeyQuery(void) {
  return @{
    (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
    (__bridge id)kSecAttrService: SecurePreferenceService,
    (__bridge id)kSecAttrAccount: @"hmac-sha256",
    (__bridge id)kSecAttrSynchronizable: @NO
  };
}

static OSStatus ReadSecurePreferenceKey(NSData **key) {
  NSMutableDictionary *query = [SecurePreferenceKeyQuery() mutableCopy];
  query[(__bridge id)kSecReturnData] = @YES;
  query[(__bridge id)kSecMatchLimit] = (__bridge id)kSecMatchLimitOne;
  CFTypeRef result = NULL;
  OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &result);
  if (status == errSecSuccess) {
    NSData *data = CFBridgingRelease(result);
    if (![data isKindOfClass:[NSData class]] || data.length != 32) {
      return errSecDecode;
    }
    *key = data;
  }
  return status;
}

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

RCT_EXPORT_METHOD(openSecurePreferencesKey:(BOOL)create
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  if (self.securePreferenceKey) {
    resolve(@"ready");
    return;
  }

  NSData *key = nil;
  BOOL created = NO;
  OSStatus status = ReadSecurePreferenceKey(&key);
  if (status == errSecItemNotFound && create) {
    NSMutableData *random = [NSMutableData dataWithLength:32];
    status = SecRandomCopyBytes(kSecRandomDefault, random.length, random.mutableBytes);
    if (status == errSecSuccess) {
      NSMutableDictionary *entry = [SecurePreferenceKeyQuery() mutableCopy];
      entry[(__bridge id)kSecValueData] = random;
      entry[(__bridge id)kSecAttrAccessible] = (__bridge id)kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly;
      status = SecItemAdd((__bridge CFDictionaryRef)entry, NULL);
      if (status == errSecDuplicateItem) {
        status = ReadSecurePreferenceKey(&key);
      } else if (status == errSecSuccess) {
        key = random;
        created = YES;
      }
    }
  }

  if (status == errSecItemNotFound && !create) {
    resolve(@"missing");
  } else if (status == errSecSuccess && key) {
    self.securePreferenceKey = key;
    resolve(created ? @"created" : @"ready");
  } else {
    reject(@"E_SECURE_PREFERENCES_KEY", @"Secure preference key unavailable", nil);
  }
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(computeSecurePreferenceHmac:(NSString *)message) {
  NSData *key = self.securePreferenceKey;
  NSData *bytes = [message dataUsingEncoding:NSUTF8StringEncoding];
  if (!key || !bytes) {
    return @"";
  }
  unsigned char hmac[CC_SHA256_DIGEST_LENGTH];
  CCHmac(kCCHmacAlgSHA256, key.bytes, key.length, bytes.bytes, bytes.length, hmac);
  NSMutableString *hex = [NSMutableString stringWithCapacity:sizeof(hmac) * 2];
  for (unsigned int i = 0; i < sizeof(hmac); i++) {
    [hex appendFormat:@"%02x", hmac[i]];
  }
  return hex;
}
@end
