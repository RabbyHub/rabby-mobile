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
export function getActiveDappState() {
  return { ...activeDappRef };
}
export function isRpcAllowed(s: ActiveDappState) {
  return !!s.dappOrigin && s.tabId;
}
export function globalSetActiveDappState(input: {
  tabId?: string | null;
  dappOrigin?: string | null;
}) {
  if (input.dappOrigin !== undefined) {
    activeDappRef.dappOrigin = input.dappOrigin || null;
  }
  if (input.tabId !== undefined) {
    activeDappRef.tabId = input.tabId || null;
    activeDappStateEvents.emit('updated', activeDappRef.tabId);
  }
}

export function shouldAllowApprovePopup(
  {
    fromOrigin: fromDappOrigin = '',
    currentActiveOrigin,
  }: {
    fromOrigin?: string;
    currentActiveOrigin: string | null;
  },
  options?: { allowSecondaryDomainMatch?: boolean },
) {
  if (fromDappOrigin === INTERNAL_REQUEST_ORIGIN) return true;

  if (!currentActiveOrigin || !fromDappOrigin) return false;

  const { allowSecondaryDomainMatch = false } = options || {};

  if (currentActiveOrigin) {
    const currentInfo = urlUtils.canoicalizeDappUrl(currentActiveOrigin);
    const targetInfo = urlUtils.canoicalizeDappUrl(fromDappOrigin);

    if (currentInfo.httpOrigin === targetInfo.httpOrigin) return true;

    if (
      allowSecondaryDomainMatch &&
      targetInfo.secondaryDomain === currentInfo.secondaryDomain
    ) {
      return true;
    }
  }

  return false;
}
