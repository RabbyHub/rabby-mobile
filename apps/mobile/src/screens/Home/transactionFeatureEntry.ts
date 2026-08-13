import type { SwapBridgeTab } from '@/navigation-type';
import type { KeyringAccountWithAlias } from '@/types/account';
import {
  beginFeatureActivation,
  markFeatureActivation,
} from '@/core/utils/featureActivationDiagnostics';

export type SingleAddressTransactionFeature = 'send' | SwapBridgeTab;

export type SingleAddressTransactionEntryDependencies = {
  switchSceneCurrentAccount: (
    account: KeyringAccountWithAlias,
  ) => Promise<unknown>;
  navigateToSend: () => unknown;
  navigateToSwapBridge: (activeTab: SwapBridgeTab) => unknown;
};

export async function enterSingleAddressTransactionFeature(
  feature: SingleAddressTransactionFeature,
  currentAccount: KeyringAccountWithAlias | null | undefined,
  dependencies: SingleAddressTransactionEntryDependencies,
) {
  if (!currentAccount) {
    return false;
  }

  const cycleId = beginFeatureActivation(feature, `home_${feature}_press`);
  await dependencies.switchSceneCurrentAccount(currentAccount);
  markFeatureActivation(feature, 'context-ready', {
    cycleId,
    reason: 'scene_account_switched',
  });
  markFeatureActivation(feature, 'navigation-dispatched', {
    cycleId,
    reason: 'home_navigation_push',
  });

  if (feature === 'send') {
    dependencies.navigateToSend();
  } else {
    dependencies.navigateToSwapBridge(feature);
  }

  return true;
}
