import RNEncryptor, {
  DERIVATION_OPTIONS_OWASP2023,
  LEGACY_DERIVATION_OPTIONS,
} from '@/core/services/encryptor';

export {
  derivePbkdf2KeyHex,
  derivePbkdf2KeyHexWithAes,
} from '@/core/services/encryptor';

/**
 * Encryptor for the keychain credential wrapper and cloud seed-phrase backups.
 *
 * It intentionally keeps writing 5,000-iteration payloads:
 * - keychain: the secret is the app's rabbitCode, the blob already sits behind
 *   OS keychain protection, and it is decrypted on every biometric unlock;
 * - cloud backup: a backup made here must still restore on devices running
 *   versions that cannot read KDF metadata.
 * It still reads payloads with any supported iteration count.
 */
export const appEncryptorApi = new RNEncryptor({
  keyDerivationOptions: LEGACY_DERIVATION_OPTIONS,
});

/** A vault-strength (600k) encryptor, for compatibility checks only. */
export function createVaultStrengthEncryptor() {
  return new RNEncryptor({
    keyDerivationOptions: DERIVATION_OPTIONS_OWASP2023,
  });
}
