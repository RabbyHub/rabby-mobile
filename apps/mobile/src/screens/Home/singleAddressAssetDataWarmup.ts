import nftListStore, { useNftListComputedStore } from '@/store/nfts';
import useProtocols, { useProtocolListComputedStore } from '@/store/protocols';
import { scheduleStartupTask } from '@/core/utils/startupScheduler';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import {
  createSingleAddressAssetDataCoordinator,
  type SingleAddressAssetDataInput,
} from './singleAddressAssetDataCoordinator';

export type {
  SingleAddressAssetDataInput,
  SingleAddressAssetDataTab,
} from './singleAddressAssetDataCoordinator';

export const singleAddressAssetDataCoordinator =
  createSingleAddressAssetDataCoordinator({
    loadDefi: address => useProtocols.getState().getProtocols(address),
    loadNft: address => nftListStore.getState().getNFTListWithCache(address),
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
  return scheduleStartupTask(
    () => singleAddressAssetDataCoordinator.warm(input),
    STARTUP_TASKS.singleAddressAssetDataWarmup,
  );
}
