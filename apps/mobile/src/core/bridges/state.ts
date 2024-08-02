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
  updated: (info: ActiveDappState['tabId']) => void;
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
  activeDappStateEvents.emit('updated', activeDappRef.tabId);
}

export function shouldAllowApprovePopup(
  {
    targetOrigin = '',
    currentActiveOrigin,
  }: {
    targetOrigin?: string;
    currentActiveOrigin: string | null;
  },
  options?: { allowSecondaryDomainMatch?: boolean },
) {
  if (targetOrigin === INTERNAL_REQUEST_ORIGIN) return true;
  if (!currentActiveOrigin || !targetOrigin) return false;

  const { allowSecondaryDomainMatch = false } = options || {};

  const currentInfo = urlUtils.canoicalizeDappUrl(currentActiveOrigin);
  const targetInfo = urlUtils.canoicalizeDappUrl(targetOrigin);

  if (currentInfo.httpOrigin === targetInfo.httpOrigin) return true;

  if (
    allowSecondaryDomainMatch &&
    targetInfo.secondaryDomain === currentInfo.secondaryDomain
  ) {
    return true;
  }

  return false;
}
