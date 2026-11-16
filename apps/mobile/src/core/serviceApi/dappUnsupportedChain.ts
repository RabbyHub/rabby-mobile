import { CHAINS_ENUM } from '@/constant/chains';
import { BroadcastEvent } from '@/constant/event';
import type { DappInfo } from '@/core/services/dappService';
import { getRegisteredService } from '@/core/services/serviceRegistry';
import { findChain } from '@/utils/chain';
import { ensureCustomTestnetStoreHydrated } from './customTestnet';
import { broadcastSessionEventSync } from './session';

const isOnUnsupportedChain = (dapp: DappInfo) =>
  dapp.chainId ? !findChain({ enum: dapp.chainId }) : !!dapp.isConnected;

/**
 * Disconnects the dapps whose chain is no longer in the chain list (dropped
 * from the synced mainnet list, or a deleted custom network) and moves them to
 * ETH. The provider already falls back to ETH for them on read, but they stayed
 * connected, so transactions and typed data failed on the missing chain.
 *
 * Returns the dapps as they were before the reset. Does nothing until the chain
 * list is final: the mainnet list is the bundled one until syncChainService has
 * a cached or fetched list, and custom networks come from their own snapshot.
 *
 * Never throws: it runs inside the dapp and chain-sync service loaders.
 */
export function disconnectDappsWithUnsupportedChain(): DappInfo[] {
  try {
    return resetDappsWithUnsupportedChain();
  } catch (error) {
    console.error('[dappUnsupportedChain] reset failed', error);
    return [];
  }
}

function resetDappsWithUnsupportedChain(): DappInfo[] {
  // registered, not loaded: this also runs inside both services' loaders
  const dappService = getRegisteredService('dappService');
  // a reset cannot be undone, so never judge chains against the bundled list:
  // with no cached list, wait for the first fetch to call back
  const syncChainService = getRegisteredService('syncChainService');
  if (!dappService || !syncChainService?.hasSyncedMainnetList()) {
    return [];
  }

  // without the custom networks, every dapp on one would look unsupported
  ensureCustomTestnetStoreHydrated();

  const dapps = Object.entries(dappService.getDapps())
    .filter(([, dapp]) => !!dapp && isOnUnsupportedChain(dapp))
    .map(([origin, dapp]) => ({ ...dapp, origin }));
  if (!dapps.length) {
    return dapps;
  }

  // broadcasts only reach connected dapps, so tell them before disconnecting
  const ethChain = findChain({ enum: CHAINS_ENUM.ETH });
  dapps
    .filter(dapp => dapp.isConnected)
    .forEach(dapp => {
      broadcastSessionEventSync(
        BroadcastEvent.accountsChanged,
        [],
        dapp.origin,
      );
      if (ethChain) {
        broadcastSessionEventSync(
          BroadcastEvent.chainChanged,
          {
            chainId: ethChain.hex,
            networkVersion: ethChain.network,
          },
          dapp.origin,
        );
      }
    });

  dappService.patchDapps(
    Object.fromEntries(
      dapps.map(dapp => [
        dapp.origin,
        { chainId: CHAINS_ENUM.ETH, isConnected: false },
      ]),
    ),
  );
  return dapps;
}
