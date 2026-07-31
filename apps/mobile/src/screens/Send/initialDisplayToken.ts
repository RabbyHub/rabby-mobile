import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import { findChainByServerID, makeTokenFromChain } from '@/utils/chain';
import { lowcaseSame } from '@/utils/common';

export function getInitialDisplayToken(token: TokenItem): TokenItem | null {
  const chain = findChainByServerID(token.chain);
  if (chain && lowcaseSame(token.id, chain.nativeTokenAddress)) {
    return makeTokenFromChain(chain);
  }

  if (token.optimized_symbol || token.display_symbol || token.symbol) {
    return token;
  }

  return null;
}
