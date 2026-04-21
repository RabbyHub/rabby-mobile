package com.rabbywallet.keychain;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReactApplicationContext;
import com.rabbywallet.keychain.KeychainModule.KnownCiphers;
import com.rabbywallet.keychain.cipherStorage.CipherStorage;
import com.rabbywallet.keychain.cipherStorage.CipherStorage.EncryptionResult;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@SuppressWarnings({"unused", "WeakerAccess"})
public class PrefsStorage {
  public static final String KEYCHAIN_DATA = "RN_KEYCHAIN";

  static public class ResultSet extends CipherStorage.CipherResult<byte[]> {
    @KnownCiphers
    public final String cipherStorageName;

    public ResultSet(@KnownCiphers final String cipherStorageName, final byte[] usernameBytes, final byte[] passwordBytes) {
      super(usernameBytes, passwordBytes);

      this.cipherStorageName = cipherStorageName;
    }
  }

  static public class DebugEntry {
    @NonNull public final String service;
    public final boolean hasEntry;
    public final boolean hasUsername;
    public final boolean hasPassword;
    public final boolean hasCipherStorageMarker;
    @Nullable public final String storedUsernameBase64;
    @Nullable public final String storedPasswordBase64;
    @Nullable public final String storedCipherStorageMarkerValue;
    @Nullable public final String storedCipherStorageName;
    @Nullable public final String resolvedCipherStorageName;
    @NonNull public final List<String> candidateCipherStorageNames;
    @Nullable public final String cipherStorageResolutionStrategy;
    @Nullable public final Integer usernameByteSize;
    @Nullable public final Integer passwordByteSize;

    public DebugEntry(
      @NonNull final String service,
      final boolean hasEntry,
      final boolean hasUsername,
      final boolean hasPassword,
      final boolean hasCipherStorageMarker,
      @Nullable final String storedUsernameBase64,
      @Nullable final String storedPasswordBase64,
      @Nullable final String storedCipherStorageMarkerValue,
      @Nullable final String storedCipherStorageName,
      @Nullable final String resolvedCipherStorageName,
      @NonNull final List<String> candidateCipherStorageNames,
      @Nullable final String cipherStorageResolutionStrategy,
      @Nullable final Integer usernameByteSize,
      @Nullable final Integer passwordByteSize
    ) {
      this.service = service;
      this.hasEntry = hasEntry;
      this.hasUsername = hasUsername;
      this.hasPassword = hasPassword;
      this.hasCipherStorageMarker = hasCipherStorageMarker;
      this.storedUsernameBase64 = storedUsernameBase64;
      this.storedPasswordBase64 = storedPasswordBase64;
      this.storedCipherStorageMarkerValue = storedCipherStorageMarkerValue;
      this.storedCipherStorageName = storedCipherStorageName;
      this.resolvedCipherStorageName = resolvedCipherStorageName;
      this.candidateCipherStorageNames = candidateCipherStorageNames;
      this.cipherStorageResolutionStrategy = cipherStorageResolutionStrategy;
      this.usernameByteSize = usernameByteSize;
      this.passwordByteSize = passwordByteSize;
    }
  }

  @NonNull
  private final SharedPreferences prefs;

  public PrefsStorage(@NonNull final ReactApplicationContext reactContext) {
    this.prefs = reactContext.getSharedPreferences(KEYCHAIN_DATA, Context.MODE_PRIVATE);
  }

  @Nullable
  public ResultSet getEncryptedEntry(@NonNull final String service) {
    byte[] bytesForUsername = getBytesForUsername(service);
    byte[] bytesForPassword = getBytesForPassword(service);
    String cipherStorageName = getCipherStorageName(service);

    // in case of wrong password or username
    if (bytesForUsername == null || bytesForPassword == null) {
      return null;
    }

    if (cipherStorageName == null) {
      // If the CipherStorage name is not found, we assume it is because the entry was written by an older
      // version of this library. The older version used Facebook Conceal, so we default to that.
      cipherStorageName = KnownCiphers.RSA;
    }

    return new ResultSet(cipherStorageName, bytesForUsername, bytesForPassword);

  }

  public void removeEntry(@NonNull final String service) {
    final String keyForUsername = getKeyForUsername(service);
    final String keyForPassword = getKeyForPassword(service);
    final String keyForCipherStorage = getKeyForCipherStorage(service);

    prefs.edit()
      .remove(keyForUsername)
      .remove(keyForPassword)
      .remove(keyForCipherStorage)
      .apply();
  }

  @NonNull
  public DebugEntry getDebugEntry(@NonNull final String service) {
    final String storedUsernameBase64 = getString(getKeyForUsername(service));
    final String storedPasswordBase64 = getString(getKeyForPassword(service));
    final byte[] usernameBytes = getBytesForUsername(service);
    final byte[] passwordBytes = getBytesForPassword(service);
    final String storedCipherStorageName = getCipherStorageName(service);
    final boolean hasUsername = usernameBytes != null;
    final boolean hasPassword = passwordBytes != null;
    final boolean hasCipherStorageMarker = storedCipherStorageName != null;
    final boolean hasEntry = hasUsername || hasPassword || hasCipherStorageMarker;
    final List<String> candidateCipherStorageNames =
      (hasUsername && hasPassword)
        ? getCandidateCipherStorageNamesForDebug(storedCipherStorageName)
        : Collections.<String>emptyList();
    final String resolvedCipherStorageName =
      candidateCipherStorageNames.isEmpty() ? null : candidateCipherStorageNames.get(0);
    final String cipherStorageResolutionStrategy =
      (hasUsername && hasPassword)
        ? getCipherStorageResolutionStrategyForDebug(storedCipherStorageName)
        : null;

    return new DebugEntry(
      service,
      hasEntry,
      hasUsername,
      hasPassword,
      hasCipherStorageMarker,
      storedUsernameBase64,
      storedPasswordBase64,
      storedCipherStorageName,
      storedCipherStorageName,
      resolvedCipherStorageName,
      candidateCipherStorageNames,
      cipherStorageResolutionStrategy,
      usernameBytes != null ? usernameBytes.length : null,
      passwordBytes != null ? passwordBytes.length : null
    );
  }

  public boolean removeCipherStorageMarker(@NonNull final String service) {
    final String keyForCipherStorage = getKeyForCipherStorage(service);
    if (!prefs.contains(keyForCipherStorage)) {
      return false;
    }

    prefs.edit().remove(keyForCipherStorage).apply();
    return true;
  }

  public void storeEncryptedEntry(@NonNull final String service, @NonNull final EncryptionResult encryptionResult) {
    final String keyForUsername = getKeyForUsername(service);
    final String keyForPassword = getKeyForPassword(service);
    final String keyForCipherStorage = getKeyForCipherStorage(service);

    prefs.edit()
      .putString(keyForUsername, Base64.encodeToString(encryptionResult.username, Base64.DEFAULT))
      .putString(keyForPassword, Base64.encodeToString(encryptionResult.password, Base64.DEFAULT))
      .putString(keyForCipherStorage, encryptionResult.cipherName)
      .apply();
  }

  /**
   * List all types of cipher which are involved in en/decryption of the data stored herein.
   *
   * A cipher type is stored together with the datum upon encryption so the datum can later be decrypted using correct
   * cipher. This way, a {@link PrefsStorage} can involve different ciphers for different data. This method returns all
   * ciphers involved with this storage.
   *
   * @return set of cipher names
   */
  public Set<String> getUsedCipherNames() {
    Set<String> result = new HashSet<>();

    Set<String> keys = prefs.getAll().keySet();
    for (String key : keys) {
      if (isKeyForCipherStorage(key)) {
        String cipher = prefs.getString(key, null);
        result.add(cipher);
      }
    }

    return result;
  }

  @Nullable
  private byte[] getBytesForUsername(@NonNull final String service) {
    final String key = getKeyForUsername(service);

    return getBytes(key);
  }

  @Nullable
  private byte[] getBytesForPassword(@NonNull final String service) {
    String key = getKeyForPassword(service);
    return getBytes(key);
  }

  @Nullable
  private String getCipherStorageName(@NonNull final String service) {
    String key = getKeyForCipherStorage(service);

    return this.prefs.getString(key, null);
  }

  @NonNull
  public static String getKeyForUsername(@NonNull final String service) {
    return service + ":" + "u";
  }

  @NonNull
  public static String getKeyForPassword(@NonNull final String service) {
    return service + ":" + "p";
  }

  @NonNull
  public static String getKeyForCipherStorage(@NonNull final String service) {
    return service + ":" + "c";
  }

  public static boolean isKeyForCipherStorage(@NonNull final String key) {
    return key.endsWith(":c");
  }

  @Nullable
  private byte[] getBytes(@NonNull final String key) {
    String value = getString(key);

    if (value != null) {
      return Base64.decode(value, Base64.DEFAULT);
    }

    return null;
  }

  @Nullable
  private String getString(@NonNull final String key) {
    return this.prefs.getString(key, null);
  }

  @NonNull
  private static List<String> getCandidateCipherStorageNamesForDebug(@Nullable final String cipherStorageName) {
    if (cipherStorageName != null) {
      return Collections.singletonList(cipherStorageName);
    }

    return Collections.singletonList(KnownCiphers.RSA);
  }

  @NonNull
  private static String getCipherStorageResolutionStrategyForDebug(@Nullable final String cipherStorageName) {
    if (cipherStorageName != null) {
      return "stored-marker";
    }

    return "missing-marker/default-rsa";
  }
}
