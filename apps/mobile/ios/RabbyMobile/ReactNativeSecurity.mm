// ReactNativeSecurity.mm
#import "ReactNativeSecurity.h"
#import <CommonCrypto/CommonDigest.h>
#import <CommonCrypto/CommonHMAC.h>
#import <Security/Security.h>
#include <errno.h>
#include <fcntl.h>
#include <unistd.h>

static NSString *const SecurePreferenceService = @"com.debank.rabbymobile.secure-preferences.v1";

@interface ReactNativeSecurity ()
@property (atomic, strong) NSData *securePreferenceKey;
@property (atomic, strong) NSData *stagedSecurePreferenceKey;
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

static BOOL SyncSecurePreferenceFile(NSString *path) {
  int fd = open(path.fileSystemRepresentation, O_RDWR | O_CLOEXEC);
  if (fd == -1) {
    return NO;
  }
  int result;
  do {
    result = fsync(fd);
  } while (result == -1 && errno == EINTR);
  close(fd);
  return result == 0;
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

RCT_EXPORT_METHOD(openSecurePreferencesKey:(BOOL)stage
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  if (self.securePreferenceKey) {
    resolve(@"ready");
    return;
  }

  NSData *key = nil;
  OSStatus status = ReadSecurePreferenceKey(&key);
  if (status == errSecSuccess && key) {
    self.securePreferenceKey = key;
    self.stagedSecurePreferenceKey = nil;
    resolve(@"ready");
    return;
  }
  if (status == errSecItemNotFound) {
    if (!stage) {
      resolve(@"missing");
      return;
    }
    if (!self.stagedSecurePreferenceKey) {
      NSMutableData *random = [NSMutableData dataWithLength:32];
      if (SecRandomCopyBytes(kSecRandomDefault, random.length, random.mutableBytes) == errSecSuccess) {
        self.stagedSecurePreferenceKey = random;
      }
    }
    if (self.stagedSecurePreferenceKey) {
      resolve(@"staged");
      return;
    }
  }
  reject(@"E_SECURE_PREFERENCES_KEY", @"Secure preference key unavailable", nil);
}

RCT_EXPORT_METHOD(commitSecurePreferencesKey:(NSString *)storagePath
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  NSData *key = self.stagedSecurePreferenceKey;
  if (!key ||
      !SyncSecurePreferenceFile(storagePath) ||
      !SyncSecurePreferenceFile([storagePath stringByAppendingString:@".crc"])) {
    reject(@"E_SECURE_PREFERENCES_KEY", @"Secure preference migration could not be synchronized", nil);
    return;
  }
  NSMutableDictionary *entry = [SecurePreferenceKeyQuery() mutableCopy];
  entry[(__bridge id)kSecValueData] = key;
  entry[(__bridge id)kSecAttrAccessible] = (__bridge id)kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly;
  if (SecItemAdd((__bridge CFDictionaryRef)entry, NULL) != errSecSuccess) {
    reject(@"E_SECURE_PREFERENCES_KEY", @"Secure preference key could not be saved", nil);
    return;
  }
  self.securePreferenceKey = key;
  self.stagedSecurePreferenceKey = nil;
  resolve(nil);
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(computeSecurePreferenceHmac:(NSString *)message) {
  NSData *key = self.securePreferenceKey ?: self.stagedSecurePreferenceKey;
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
