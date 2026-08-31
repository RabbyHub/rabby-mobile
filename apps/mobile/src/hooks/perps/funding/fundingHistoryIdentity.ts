export type PerpsFundingDirection = 'deposit' | 'withdraw';

export type PerpsFundingSettlementIdentity = {
  direction: PerpsFundingDirection;
  hash?: string;
  settlementNonce?: number;
};

const MICROSECONDS_PER_MILLISECOND = 1000;
const MIN_MICROSECOND_TIMESTAMP_NONCE = 1_000_000_000_000_000;

export const getPerpsFundingLedgerSettlementNonce = ({
  nonce,
  type,
}: {
  nonce?: unknown;
  type: string;
}) => {
  if (
    (type !== 'send' && type !== 'withdraw') ||
    typeof nonce !== 'number' ||
    !Number.isSafeInteger(nonce) ||
    nonce <= 0
  ) {
    return undefined;
  }

  // Hyperliquid's withdraw3 ledger exposes the signed millisecond nonce in
  // microseconds, while sendAsset exposes the signed nonce unchanged.
  if (
    type === 'withdraw' &&
    nonce >= MIN_MICROSECOND_TIMESTAMP_NONCE &&
    nonce % MICROSECONDS_PER_MILLISECOND === 0
  ) {
    return nonce / MICROSECONDS_PER_MILLISECOND;
  }
  return nonce;
};

export const getPerpsFundingSettlementIdentityKeys = ({
  direction,
  hash,
  settlementNonce,
}: PerpsFundingSettlementIdentity): string[] => {
  const keys: string[] = [];
  if (
    typeof settlementNonce === 'number' &&
    Number.isSafeInteger(settlementNonce) &&
    settlementNonce > 0
  ) {
    keys.push(`hyperliquid-nonce:${settlementNonce}:${direction}`);
  }
  const normalizedHash = hash?.trim();
  if (normalizedHash && !normalizedHash.startsWith('hl-nonce:')) {
    keys.push(`ledger-hash:${normalizedHash.toLowerCase()}:${direction}`);
  }
  return keys;
};

export const isSamePerpsFundingSettlement = (
  left: PerpsFundingSettlementIdentity,
  right: PerpsFundingSettlementIdentity,
) => {
  const rightKeys = new Set(getPerpsFundingSettlementIdentityKeys(right));
  return getPerpsFundingSettlementIdentityKeys(left).some(key =>
    rightKeys.has(key),
  );
};
