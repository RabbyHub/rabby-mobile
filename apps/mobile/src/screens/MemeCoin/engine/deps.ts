import BigNumber from 'bignumber.js';
import pRetry from 'p-retry';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { MINI_SIGN_ERROR } from '@/components2024/MiniSignV2/state/SignatureManager';
import { uiRefreshTimeout } from '@/core/apis/autoLock';
import { gasMarketV2 } from '@/core/apis/provider';
import { openapi } from '@/core/request';
import type { Account } from '@/core/startupServices/preference';
import { twoStepChains } from '@/screens/Swap/hooks/twoStepSwap';
import { getSwapGasReserveGasLimit } from '@/screens/Swap/utils';
import { findChainByServerID } from '@/utils/chain';
import { waitForTxCompleted } from '@/utils/waitForTxCompleted';
import { gasReserveInNativeUnits } from './gas';
import type { LegRunnerDeps } from './legRunner';
import { ExecutionStoppedError } from './pauseGate';
import { createBridgeRoute } from './routes/bridgeRoute';
import type { GetDexQuote } from './routes/dexQuotes';
import { createSwapRoute } from './routes/swapRoute';
import { classifySignError } from './signErrors';
import {
  createHeadlessDirectSigner,
  type HeadlessDirectSigner,
} from './signer';

export const createProductionLegRunnerDeps = ({
  account,
  getDexQuote,
  supportedDexList,
  maxPriceImpactPct,
}: {
  account: Account;
  getDexQuote: GetDexQuote;
  supportedDexList: string[];
  maxPriceImpactPct: number;
}): { deps: LegRunnerDeps; dispose(): void } => {
  const signers = new Map<string, HeadlessDirectSigner>();
  const bridge = createBridgeRoute({ account });

  const deps: LegRunnerDeps = {
    maxPriceImpactPct,
    routes: {
      swap: createSwapRoute({ account, getDexQuote, supportedDexList }),
      bridge: bridge.route,
    },
    getToken: (chainServerId, tokenId) =>
      pRetry(() => openapi.getToken(account.address, chainServerId, tokenId), {
        retries: 1,
      }),
    isNativeToken: (chainServerId, tokenId) =>
      isSameAddress(
        tokenId,
        findChainByServerID(chainServerId)?.nativeTokenAddress || '',
      ),
    isTwoStepChain: chainServerId => {
      const chainEnum = findChainByServerID(chainServerId)?.enum;
      return !!chainEnum && twoStepChains.includes(chainEnum);
    },
    getNativeGasReserve: async chainServerId => {
      const chain = findChainByServerID(chainServerId);
      if (!chain) {
        return new BigNumber(0);
      }
      const levels = await gasMarketV2({ chainId: chainServerId }, account);
      return gasReserveInNativeUnits({
        gasLimit: getSwapGasReserveGasLimit(chain.enum),
        gasPriceWei: levels.find(l => l.level === 'normal')?.price || 0,
        nativeDecimals: chain.nativeTokenDecimals || 18,
      });
    },
    getSigner: chainServerId => {
      let signer = signers.get(chainServerId);
      if (!signer) {
        signer = createHeadlessDirectSigner({ account });
        signers.set(chainServerId, signer);
      }
      return signer;
    },
    classifySignError: error => classifySignError(error, MINI_SIGN_ERROR),
    waitForTxCompleted: async ({ hash, chainServerId, isCancelled }) => {
      try {
        await waitForTxCompleted({
          hash,
          chainServerId,
          isTaskCancelled: isCancelled,
          createCancelledError: () => new ExecutionStoppedError(),
        });
        return true;
      } catch (error) {
        if (error instanceof ExecutionStoppedError) {
          throw error;
        }
        return false;
      }
    },
    waitForBridgeArrival: bridge.waitForArrival,
    refreshAutoLock: uiRefreshTimeout,
  };

  return {
    deps,
    dispose: () => signers.forEach(signer => signer.close()),
  };
};
