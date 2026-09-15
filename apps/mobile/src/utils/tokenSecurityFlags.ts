/**
 * DebankCore labels are tri-state: true, false, or null (unlabeled).
 * `is_verified === false` means explicit scam/fake, so custom tokens must
 * keep null instead of defaulting to false.
 */
export const unlabeledCustomTokenSecurityFlags = {
  is_core: false as boolean | null,
  is_verified: null as boolean | null,
  is_wallet: false,
  is_scam: false,
  is_suspicious: false,
};
