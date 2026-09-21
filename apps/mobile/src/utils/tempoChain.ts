import { TEMPO_CHAIN_SERVER_ID } from '@/constant/tempo';

export const normalizeTempoChainServerId = (chainServerId?: string | null) =>
  (chainServerId || '').toLowerCase();

export const isTempoChain = (chainServerId?: string | null) => {
  const normalized = normalizeTempoChainServerId(chainServerId);
  return normalized === normalizeTempoChainServerId(TEMPO_CHAIN_SERVER_ID);
};
