import { apisPerps } from '@/core/apis/perps';
import {
  fetchClearinghouseStateHttp,
  fetchSpotStateHttp,
  getPerpsAccountRuntimeContext,
  isPerpsUserAbstractionReadyForAccount,
  perpsStore,
  queryUserAbstraction,
  reconcileUserAbstractionSnapshot,
} from '@/hooks/perps/usePerpsStore';

import { signPerpsMasterTypedData } from './signPerpsMasterTypedData';
import {
  executePerpsSpotToPerpsTransferCore,
  type PerpsSpotToPerpsTransferCommand,
  type PerpsSpotToPerpsTransferDependencies,
  type PerpsSpotToPerpsTransferResult,
} from './perpsTransferCore';

export {
  buildPerpsSpotToPerpsTransferCommand,
  type PerpsSpotToPerpsTransferCommand,
  type PerpsSpotToPerpsTransferDependencies,
  type PerpsSpotToPerpsTransferResult,
} from './perpsTransferCore';

const getExchange = () => {
  const exchange = apisPerps.getPerpsSDK().exchange;
  if (!exchange) {
    throw new Error('Hyperliquid exchange client unavailable');
  }
  return exchange;
};

const defaultDependencies: PerpsSpotToPerpsTransferDependencies = {
  getAccountRuntimeGeneration: () => getPerpsAccountRuntimeContext().generation,
  getCurrentAccount: () => perpsStore.getState().currentPerpsAccount,
  getRemoteUserAbstraction: queryUserAbstraction,
  getSpotUsdcAvailable: () =>
    perpsStore.getState().spotState.rawBalancesByToken[0]?.available || '0',
  getUserAbstraction: () => perpsStore.getState().userAbstraction,
  getUserAbstractionReady: () =>
    isPerpsUserAbstractionReadyForAccount(perpsStore.getState()),
  prepareSendAsset: params => getExchange().prepareSendAsset(params),
  refreshPerps: expectedAddress =>
    fetchClearinghouseStateHttp('', expectedAddress),
  refreshSpot: expectedAddress => fetchSpotStateHttp(expectedAddress),
  reconcileRemoteUserAbstraction: reconcileUserAbstractionSnapshot,
  sendSendAsset: params =>
    getExchange().sendSendAsset({
      action: params.action as any,
      nonce: params.nonce,
      signature: params.signature,
    }),
  sign: (action, account) =>
    signPerpsMasterTypedData({
      account,
      action,
    }),
};

export const executePerpsSpotToPerpsTransfer = async (
  command: PerpsSpotToPerpsTransferCommand,
  dependencies: PerpsSpotToPerpsTransferDependencies = defaultDependencies,
): Promise<PerpsSpotToPerpsTransferResult> => {
  return executePerpsSpotToPerpsTransferCore(command, dependencies);
};
