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
  runServiceSideEffectWhenReady,
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
  runServiceSideEffectWhenReady(
    'dappService',
    service => service.addDapp(...args),
    'dappService.addDapp',
  );
}

export function removeDappSync(...args: Parameters<DappService['removeDapp']>) {
  runServiceSideEffectWhenReady(
    'dappService',
    service => service.removeDapp(...args),
    'dappService.removeDapp',
  );
}

export function updateDappSync(...args: Parameters<DappService['updateDapp']>) {
  runServiceSideEffectWhenReady(
    'dappService',
    service => service.updateDapp(...args),
    'dappService.updateDapp',
  );
}

export function patchDappsSync(...args: Parameters<DappService['patchDapps']>) {
  runServiceSideEffectWhenReady(
    'dappService',
    service => service.patchDapps(...args),
    'dappService.patchDapps',
  );
}

export function disconnectDappSync(
  ...args: Parameters<DappService['disconnect']>
) {
  runServiceSideEffectWhenReady(
    'dappService',
    service => service.disconnect(...args),
    'dappService.disconnect',
  );
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
