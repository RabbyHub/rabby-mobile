package com.debank.rabbymobile;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.Key;
import java.security.KeyStore;
import javax.crypto.KeyGenerator;
import javax.crypto.Mac;
import javax.crypto.SecretKey;

final class SecurePreferenceKey {
  private static final String STORE = "AndroidKeyStore";
  private static final String ALIAS = "com.debank.rabbymobile.secure-preferences.v1";
  private static final String ALGORITHM = KeyProperties.KEY_ALGORITHM_HMAC_SHA256;
  private static final char[] HEX = "0123456789abcdef".toCharArray();
  private static volatile SecretKey key;

  static synchronized String open(boolean create) throws Exception {
    if (key != null) {
      return "ready";
    }
    KeyStore store = KeyStore.getInstance(STORE);
    store.load(null);
    if (store.containsAlias(ALIAS)) {
      Key existing = store.getKey(ALIAS, null);
      if (!(existing instanceof SecretKey) || !ALGORITHM.equals(existing.getAlgorithm())) {
        throw new GeneralSecurityException("Invalid secure preference key");
      }
      key = (SecretKey) existing;
      return "ready";
    }
    if (!create) {
      return "missing";
    }
    KeyGenerator generator = KeyGenerator.getInstance(ALGORITHM, STORE);
    generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN)
        .setKeySize(256)
        .build());
    key = generator.generateKey();
    return "created";
  }

  static String authenticate(String message) throws GeneralSecurityException {
    SecretKey current = key;
    if (current == null) {
      throw new GeneralSecurityException("Secure preference key unavailable");
    }
    Mac mac = Mac.getInstance(ALGORITHM);
    mac.init(current);
    byte[] result = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
    char[] hex = new char[result.length * 2];
    for (int i = 0; i < result.length; i++) {
      int value = result[i] & 0xff;
      hex[i * 2] = HEX[value >>> 4];
      hex[i * 2 + 1] = HEX[value & 0xf];
    }
    return new String(hex);
  }

  private SecurePreferenceKey() {}
}
