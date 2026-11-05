import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import {
  findChainByEnum,
  findChainByID,
  findChainByServerID,
  makeTokenFromChain,
} from '@/utils/chain';
import { lowcaseSame } from '@/utils/common';
import { getLastTimeSendTokenSnapshot } from '@/core/serviceApi/preference';
import { getOrderedChainListSnapshot } from '@/hooks/accountChainBalance';
import type { CHAINS_ENUM } from '@/constant/chains';

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

/** Display only: balance/recipient/gas readiness still belongs to async init. */
export function getInitialSendTokenDisplaySnapshot({
  accountAddress,
  params,
  fallbackToken,
}: {
  accountAddress: string;
  params?: {
    toAddress?: string;
    chainEnum?: CHAINS_ENUM;
    tokenId?: string;
    safeInfo?: { chainId: number };
  };
  fallbackToken: TokenItem;
}): TokenItem | null {
  // A recipient may recommend another token. Do not briefly display the
  // persisted/default selection while that decision is still pending.
  if (params?.toAddress || !accountAddress) return null;

  if (params?.safeInfo) {
    const chain = findChainByID(params.safeInfo.chainId);
    return chain ? makeTokenFromChain(chain) : null;
  }
  if (params?.chainEnum && params.tokenId) {
    const chain = findChainByEnum(params.chainEnum);
    return chain && lowcaseSame(params.tokenId, chain.nativeTokenAddress)
      ? makeTokenFromChain(chain)
      : null;
  }

  const { ready, token: lastToken } =
    getLastTimeSendTokenSnapshot(accountAddress);
  // An unready owning service is not the same as "no last token".
  // The original async initialization remains the convergence path.
  if (!ready) return null;
  if (lastToken) {
    return findChainByServerID(lastToken.chain)
      ? getInitialDisplayToken(lastToken)
      : null;
  }

  const { firstChain } = getOrderedChainListSnapshot({
    address: accountAddress,
  });
  return getInitialDisplayToken(
    firstChain ? makeTokenFromChain(firstChain) : fallbackToken,
  );
}
