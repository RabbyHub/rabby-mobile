import { CHAINS_ENUM } from '@/constant/chains';
import { getDappSnapshot } from '@/core/serviceApi/dapp';
import { findChainByEnum } from '@/utils/chain';

export type ProviderNetworkState = {
  chainId: string;
  networkVersion: string;
};

/**
 * Last-resort value, only used when the chain list is empty (which should never
 * happen once the app has booted). Keeps callers non-nullable so the dapp page
 * always receives a valid `chainId`.
 */
const ETH_FALLBACK_NETWORK_STATE: ProviderNetworkState = {
  chainId: '0x1',
  networkVersion: '1',
};

/**
 * Single source of truth for the network state a dapp page sees.
 *
 * Both `rabby_getProviderState` (the state the inpage provider bootstraps from)
 * and the `chainChanged` notification pushed when a BackgroundBridge is created
 * must be derived from here. If the two are computed independently they can
 * disagree, the inpage provider then observes a chain change that never
 * happened and emits `chainChanged` on every page load — dapps following the
 * `chainChanged -> location.reload()` pattern reload forever.
 */
export function getProviderNetworkState(origin: string): ProviderNetworkState {
  const chainEnum = getDappSnapshot(origin)?.chainId || CHAINS_ENUM.ETH;

  let chain = findChainByEnum(chainEnum);
  if (!chain) {
    console.warn(
      `[getProviderNetworkState] chain ${chainEnum} not found, fallback to ETH`,
    );
    chain = findChainByEnum(CHAINS_ENUM.ETH);
  }

  if (!chain) {
    return ETH_FALLBACK_NETWORK_STATE;
  }

  return {
    chainId: chain.hex,
    networkVersion: chain.network,
  };
}
