/**
 * SecretVault - Ephemeral in-memory storage for securely transferring
 * sensitive data (mnemonics, private keys) between screens.
 *
 * SECURITY PROPERTIES:
 * 1. Data is stored ONLY in memory - never persisted to disk
 * 2. Vault IDs are self-incrementing and single-use
 * 3. Secrets are immediately cleared on retrieval
 *
 * USE CASE:
 * Pass sensitive data between screens without exposing it to:
 * - Navigation state persistence
 * - Deep link logs
 * - React Navigation debugging tools
 */

type VaultEntry = {
  secret: string;
};

// In-memory store - never persisted to disk
const vault = new Map<string, VaultEntry>();

// Self-incrementing ID counter
let vaultIdCounter = 0;

/**
 * Generates a unique vault ID using an incrementing counter.
 */
function generateVaultId(): string {
  vaultIdCounter += 1;
  return `vault_${vaultIdCounter}_${Date.now()}`;
}

/**
 * Stores a secret in the vault and returns a unique vault ID.
 *
 * @param secret - The sensitive data to store (e.g., mnemonic, private key)
 * @returns A unique vault ID that can be used to retrieve the secret once
 *
 * @example
 * const vaultId = SecretVault.store(cleanedMnemonic);
 * navigation.navigate('CreateNewWallet', { seedPhraseVaultId: vaultId });
 */
export function store(secret: string): string {
  const vaultId = generateVaultId();
  vault.set(vaultId, { secret });
  return vaultId;
}

/**
 * Retrieves a secret from the vault by its ID.
 * The secret is IMMEDIATELY removed from the vault after retrieval (single-use).
 *
 * @param vaultId - The vault ID returned by store()
 * @returns The secret if found, null otherwise
 *
 * @example
 * const seedPhrase = SecretVault.retrieve(vaultId);
 * if (!seedPhrase) {
 *   throw new Error('Secret expired or invalid');
 * }
 */
export function retrieve(vaultId: string): string | null {
  const entry = vault.get(vaultId);

  if (!entry) {
    return null;
  }

  // Immediately clear - single use only
  vault.delete(vaultId);

  return entry.secret;
}

/**
 * Clears all secrets from the vault.
 * Call this on app background, logout, or other security events.
 */
export function clearAll(): void {
  vault.clear();
}
