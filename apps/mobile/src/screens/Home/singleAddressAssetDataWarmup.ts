import nftListStore, { useNftListComputedStore } from '@/store/nfts';
import useProtocols, { useProtocolListComputedStore } from '@/store/protocols';
import { scheduleStartupTask } from '@/core/utils/startupScheduler';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import {
  createSingleAddressAssetDataCoordinator,
  type SingleAddressAssetDataInput,
} from './singleAddressAssetDataCoordinator';
import { beginAssetDataLoadDiagnostic } from '@/core/utils/assetDataLoadDiagnostics';

export type {
  SingleAddressAssetDataInput,
  SingleAddressAssetDataTab,
} from './singleAddressAssetDataCoordinator';

export const singleAddressAssetDataCoordinator =
  createSingleAddressAssetDataCoordinator({
    loadDefi: address => useProtocols.getState().getProtocols(address),
    loadNftCache: address =>
      nftListStore.getState().hydrateSingleNftCache(address),
    loadNftRemote: address =>
      nftListStore
        .getState()
        .getNFTListWithCache(address, false, false, { skipCache: true }),
    registerDefi: (address, chainServerId) => {
      useProtocolListComputedStore
        .getState()
        .registerSingleProtocols(address, chainServerId);
    },
    registerNft: (address, chainServerId) => {
      useNftListComputedStore
        .getState()
        .registerSingleNfts(address, chainServerId);
    },
  });

export function scheduleSingleAddressAssetDataWarmup(
  input: SingleAddressAssetDataInput,
) {
  const trace = beginAssetDataLoadDiagnostic(
    'single-address-warmup',
    input.address,
    {
      chainServerId: input.chainServerId || null,
    },
  );
  trace.mark('scheduled');
  return scheduleStartupTask(async () => {
    trace.mark('task-started');
    try {
      await singleAddressAssetDataCoordinator.warm(input);
      trace.finish();
    } catch (error) {
      trace.fail({ phase: 'warm' });
      throw error;
    }
  }, STARTUP_TASKS.singleAddressAssetDataWarmup);
}
