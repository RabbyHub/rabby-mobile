import { findChainByServerID } from '@/utils/chain';
import type { TokenRef } from '../engine/types';

export const getChainNativeToken = (
  chainServerId: string,
): (TokenRef & { logoUrl: string }) | null => {
  const chain = findChainByServerID(chainServerId);
  if (!chain) {
    return null;
  }
  return {
    id: chain.nativeTokenAddress,
    chain: chainServerId,
    symbol: chain.nativeTokenSymbol,
    logoUrl: chain.nativeTokenLogo,
  };
};
