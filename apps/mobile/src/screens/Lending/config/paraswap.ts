import { ChainId } from '@aave/contract-helpers';
import {
  BuildTxFunctions,
  constructBuildTx,
  constructFetchFetcher,
  constructGetRate,
  constructPartialSDK,
  GetRateFunctions,
} from '@paraswap/sdk';

// TODO: get fee target from config
const feeTarget = '0xe4ef35384A3cc4D0B15385cc9fc74Bd239dC8411';

const ParaSwap = (chainId: number) => {
  const fetcher = constructFetchFetcher(fetch); // alternatively constructFetchFetcher
  return constructPartialSDK(
    {
      chainId,
      fetcher,
      version: '6.2',
    },
    constructBuildTx,
    constructGetRate,
  );
};

type ParaswapChainMap = {
  [key in ChainId]?: {
    paraswap: BuildTxFunctions & GetRateFunctions;
    feeTarget: string;
  };
};

const paraswapNetworks: ParaswapChainMap = {
  [ChainId.mainnet]: {
    paraswap: ParaSwap(ChainId.mainnet),
    feeTarget,
  },
  [ChainId.polygon]: {
    paraswap: ParaSwap(ChainId.polygon),
    feeTarget,
  },
  [ChainId.avalanche]: {
    paraswap: ParaSwap(ChainId.avalanche),
    feeTarget,
  },
  [ChainId.arbitrum_one]: {
    paraswap: ParaSwap(ChainId.arbitrum_one),
    feeTarget,
  },
  [ChainId.optimism]: {
    paraswap: ParaSwap(ChainId.optimism),
    feeTarget,
  },
  [ChainId.base]: {
    paraswap: ParaSwap(ChainId.base),
    feeTarget,
  },
  [ChainId.bnb]: {
    paraswap: ParaSwap(ChainId.bnb),
    feeTarget,
  },
  [ChainId.xdai]: {
    paraswap: ParaSwap(ChainId.xdai),
    feeTarget,
  },
  [ChainId.sonic]: {
    paraswap: ParaSwap(ChainId.sonic),
    feeTarget,
  },
};

export const getParaswap = (chainId: ChainId) => {
  const paraswap = paraswapNetworks[chainId];
  if (paraswap) {
    return paraswap;
  }

  throw new Error('Chain not supported');
};

export const isMarketSupported = (chainId: ChainId) => {
  return Object.keys(paraswapNetworks).includes(chainId.toString());
};
