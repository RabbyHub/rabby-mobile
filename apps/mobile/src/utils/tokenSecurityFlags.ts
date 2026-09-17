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

type TokenSecurityFields = {
  is_verified?: boolean | null;
  is_suspicious?: boolean | null;
  is_scam?: boolean | null;
  is_core?: boolean | null;
};

const pickRemoteSecurityField = <T>(remote: T | undefined, fallback: T): T =>
  remote !== undefined ? remote : fallback;

/**
 * Keep explicit API `null` (unlabeled). Only fall back when the field is
 * missing (`undefined`), so a stale route `is_verified: false` cannot win
 * over a fresh unlabeled response.
 */
export const mergeTokenSecurityFields = (
  token: TokenSecurityFields,
  remote?: TokenSecurityFields | null,
) => ({
  is_verified: pickRemoteSecurityField(remote?.is_verified, token.is_verified),
  is_suspicious: pickRemoteSecurityField(
    remote?.is_suspicious,
    token.is_suspicious,
  ),
  is_scam: pickRemoteSecurityField(remote?.is_scam, token.is_scam),
  is_core: pickRemoteSecurityField(remote?.is_core, token.is_core),
});
