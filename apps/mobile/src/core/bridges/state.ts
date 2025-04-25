import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import { urlUtils } from '@rabby-wallet/base-utils';
import { makeEEClass } from '../apis/event';

export type ActiveDappState = {
  dappOrigin: string | null;
  tabId: string | null | undefined;
  isPanning: boolean;
  isScreenHide?: boolean;
};
const activeDappRef: ActiveDappState = {
  dappOrigin: null,
  tabId: null,
  isPanning: false,
  isScreenHide: true,
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
  return !!s.dappOrigin && !!s.tabId && !s.isPanning;
}
export function globalSetActiveDappState(
  input: {
    tabId?: string | null;
    dappOrigin?: string | null;
    isPanning?: boolean;
    isScreenHide?: boolean;
  },
  options?: { delay?: number },
) {
  const { delay = 0 } = options || {};

  if (input.dappOrigin !== undefined) {
    activeDappRef.dappOrigin = input.dappOrigin || null;
  }
  if (input.tabId !== undefined) {
    activeDappRef.tabId = input.tabId || null;
    activeDappStateEvents.emit('updated', activeDappRef.tabId);
  }

  if (input.isScreenHide !== undefined) {
    activeDappRef.isScreenHide = input.isScreenHide;
  }

  const setter = () => {
    if (typeof input.isPanning === 'boolean') {
      activeDappRef.isPanning = input.isPanning;
    }
  };

  if (delay) {
    setTimeout(setter, delay);
  } else {
    setter();
  }
}

/** @deprecated */
export function shouldAllowApprovePopupByOrigin(
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

export function isInternalSession(sessionOrigin: string) {
  return sessionOrigin === INTERNAL_REQUEST_ORIGIN;
}

export function shouldAllowApprovePopupByTabId({
  fromTabId,
  currentActiveId,
}: {
  fromTabId?: string;
  currentActiveId?: string | null;
}) {
  return currentActiveId && fromTabId === currentActiveId;
}
