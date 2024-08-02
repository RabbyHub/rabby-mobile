import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import { urlUtils } from '@rabby-wallet/base-utils';
import { makeEEClass } from '../apis/event';

export type ActiveDappState = {
  dappOrigin: string | null;
  tabId: string | null | undefined;
};
const activeDappRef: ActiveDappState = {
  dappOrigin: null,
  tabId: null,
};
type Listeners = {
  updated: (info: ActiveDappState) => void;
};
export const activeDappStateEvents =
  new (makeEEClass<Listeners>().EventEmitter)();
export function getActiveDappTabId() {
  return activeDappRef.tabId;
}
export function globalSetActiveDappState(input: {
  tabId?: string | null;
  dappOrigin?: string | null;
}) {
  activeDappRef.dappOrigin = input.dappOrigin || null;
  activeDappRef.tabId = input.tabId || null;
  activeDappStateEvents.emit('updated', { ...activeDappRef });
}

export function shouldAllowApprovePopup(
  {
    targetOrigin = '',
    currentActiveOrigin,
  }: {
    targetOrigin?: string;
    currentActiveOrigin: string | null;
  },
  options?: { noNeedStrict?: boolean },
) {
  if (targetOrigin === INTERNAL_REQUEST_ORIGIN) return true;
  if (!currentActiveOrigin || !targetOrigin) return false;

  const { noNeedStrict = false } = options || {};

  const currentInfo = urlUtils.canoicalizeDappUrl(currentActiveOrigin);
  const targetInfo = urlUtils.canoicalizeDappUrl(targetOrigin);

  if (currentInfo.httpOrigin === targetInfo.httpOrigin) return true;

  if (
    noNeedStrict &&
    targetInfo.secondaryDomain === currentInfo.secondaryDomain
  ) {
    return true;
  }

  return false;
}
