import type {
  DappInfo,
  DappService,
  DappStore,
} from '@/core/services/dappService';
import type { FieldNilable } from '@rabby-wallet/base-utils';
import {
  getRegisteredService,
  waitForCoreService,
} from '@/core/services/serviceRegistry';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type DappServiceApiContract = DappService;

registerLegacyCoreServiceLoader('dappService');

export const dappServiceApi = createDeferredServiceApi<
  'dappService',
  DappServiceApiContract
>('dappService');

const EMPTY_DAPPS: Record<string, DappInfo> = {};

export function getDappSnapshot(origin: string) {
  return getRegisteredService('dappService')?.getDapp(origin);
}

export function addDappSync(...args: Parameters<DappService['addDapp']>) {
  const service = getRegisteredService('dappService');
  if (!service) {
    throw new Error('dappService is not ready');
  }
  service.addDapp(...args);
}

export function removeDappSync(...args: Parameters<DappService['removeDapp']>) {
  const service = getRegisteredService('dappService');
  if (!service) {
    throw new Error('dappService is not ready');
  }
  service.removeDapp(...args);
}

export function updateDappSync(...args: Parameters<DappService['updateDapp']>) {
  const service = getRegisteredService('dappService');
  if (!service) {
    throw new Error('dappService is not ready');
  }
  service.updateDapp(...args);
}

export function patchDappsSync(...args: Parameters<DappService['patchDapps']>) {
  const service = getRegisteredService('dappService');
  if (!service) {
    throw new Error('dappService is not ready');
  }
  service.patchDapps(...args);
}

export function disconnectDappSync(
  ...args: Parameters<DappService['disconnect']>
) {
  const service = getRegisteredService('dappService');
  if (!service) {
    throw new Error('dappService is not ready');
  }
  service.disconnect(...args);
}

export function getDappsSnapshot() {
  return getRegisteredService('dappService')?.getDapps() || EMPTY_DAPPS;
}

export function getDappStoreSnapshot(): DappStore {
  return {
    dapps: getDappsSnapshot(),
  };
}

export function getConnectedDappSnapshot(origin: string) {
  return getRegisteredService('dappService')?.getConnectedDapp(origin) || null;
}

export function hasDappPermissionSnapshot(origin: string) {
  return getRegisteredService('dappService')?.hasPermission(origin) || false;
}

export function isInternalDappSnapshot(origin: string) {
  return getRegisteredService('dappService')?.isInternalDapp(origin) || false;
}

export async function bindDappStoreListener(
  listener: <K extends keyof DappStore>(
    key: K,
    value: FieldNilable<DappStore>[K],
  ) => void,
) {
  const service = await waitForCoreService('dappService');
  listener('dapps', service.store.dapps);
  return service.setBeforeSetKV(listener);
}
