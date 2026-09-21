import { openapi } from '@/core/request';
import { getCustomTestnetStoreSnapshot } from '@/core/serviceApi/customTestnet';
import { zCreate } from '@/core/utils/reexports';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import useAppChainStore from '@/store/appchain';
import { syncCustomTestnetStore } from '@/store/customTestnet';
import type { KeyringAccountWithAlias } from '@/types/account';
import {
  collectSingleAddressNoAssetsEvidence,
  createSingleAddressNoAssetsDecisionCoordinator,
  getSingleAddressNoAssetsDecisionKey,
  IDLE_SINGLE_ADDRESS_NO_ASSETS_DECISION,
  type SingleAddressNoAssetsDecision,
} from './singleAddressNoAssetsDecision';

type SingleAddressNoAssetsDecisionState = {
  decisionMap: Record<string, SingleAddressNoAssetsDecision>;
};

const singleAddressNoAssetsDecisionStore =
  zCreate<SingleAddressNoAssetsDecisionState>(() => ({ decisionMap: {} }));

const noAssetsEvidenceSources = {
  loadAppChains: (address: string) =>
    useAppChainStore.getState().getAppChains(address),
  loadAddressBorned: async (address: string) => {
    const addressDesc = await openapi.addrDesc(address);
    return addressDesc.desc.born_at != null;
  },
  loadHasCustomTestnet: async () => {
    const snapshot = getCustomTestnetStoreSnapshot();
    syncCustomTestnetStore(snapshot);
    return Object.keys(snapshot.customTestnet).length > 0;
  },
};

export const singleAddressNoAssetsDecisionCoordinator =
  createSingleAddressNoAssetsDecisionCoordinator({
    loadEvidence: account =>
      collectSingleAddressNoAssetsEvidence(account, noAssetsEvidenceSources),
    publisher: {
      publish(key, state) {
        singleAddressNoAssetsDecisionStore.setState(previous => ({
          decisionMap: { ...previous.decisionMap, [key]: state },
        }));
      },
    },
  });

export function useSingleAddressNoAssetsDecision(
  account?: KeyringAccountWithAlias | null,
) {
  const key = account ? getSingleAddressNoAssetsDecisionKey(account) : '';

  return useActivityStore(
    singleAddressNoAssetsDecisionStore,
    state =>
      (key && state.decisionMap[key]) || IDLE_SINGLE_ADDRESS_NO_ASSETS_DECISION,
    Object.is,
    { storeLabel: 'single-address-no-assets-decision' },
  );
}
