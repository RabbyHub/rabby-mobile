package com.debank.rabbymobile;

import android.security.keystore.KeyProperties;
import android.security.keystore.KeyProtection;
import android.system.ErrnoException;
import android.system.Os;
import android.system.OsConstants;
import java.io.FileDescriptor;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.Key;
import java.security.KeyStore;
import java.security.SecureRandom;
import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

final class SecurePreferenceKey {
  private static final String STORE = "AndroidKeyStore";
  private static final String ALIAS = "com.debank.rabbymobile.secure-preferences.v1";
  private static final String ALGORITHM = KeyProperties.KEY_ALGORITHM_HMAC_SHA256;
  private static final char[] HEX = "0123456789abcdef".toCharArray();
  private static volatile SecretKey key;
  private static volatile SecretKey stagedKey;

  static synchronized String open(boolean stage) throws Exception {
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
      stagedKey = null;
      return "ready";
    }
    if (!stage) {
      return "missing";
    }
    if (stagedKey == null) {
      byte[] random = new byte[32];
      new SecureRandom().nextBytes(random);
      stagedKey = new SecretKeySpec(random, ALGORITHM);
    }
    return "staged";
  }

  static synchronized void commit(String storagePath) throws Exception {
    if (stagedKey == null) {
      throw new GeneralSecurityException("Secure preference key was not staged");
    }
    syncFile(storagePath);
    syncFile(storagePath + ".crc");

    KeyStore store = KeyStore.getInstance(STORE);
    store.load(null);
    if (store.containsAlias(ALIAS)) {
      throw new GeneralSecurityException("Secure preference key already exists");
    }
    store.setEntry(
        ALIAS,
        new KeyStore.SecretKeyEntry(stagedKey),
        new KeyProtection.Builder(KeyProperties.PURPOSE_SIGN)
            .setDigests(KeyProperties.DIGEST_SHA256)
            .build());
    key = (SecretKey) store.getKey(ALIAS, null);
    stagedKey = null;
    if (key == null) {
      throw new GeneralSecurityException("Secure preference key unavailable after import");
    }
  }

  private static void syncFile(String path) throws ErrnoException {
    FileDescriptor fd = Os.open(path, OsConstants.O_RDWR | OsConstants.O_CLOEXEC, 0);
    try {
      Os.fsync(fd);
    } finally {
      Os.close(fd);
    }
  }

  static String authenticate(String message) throws GeneralSecurityException {
    SecretKey current = key;
    if (current == null) {
      current = stagedKey;
    }
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
