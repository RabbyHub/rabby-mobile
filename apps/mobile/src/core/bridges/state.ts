import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import { urlUtils } from '@rabby-wallet/base-utils';

const activeDappOriginRef = { current: null as string | null };
export function getActiveDappOrigin() {
  return activeDappOriginRef.current;
}

export function setGlobalActiveDappOrigin(origin: string | null) {
  activeDappOriginRef.current = origin || null;
}

export function shouldAllowApprovePopup({
  dappOrigin = '',
  currentOrigin,
}: {
  dappOrigin?: string;
  currentOrigin: string | null;
}) {
  if (dappOrigin === INTERNAL_REQUEST_ORIGIN) return true;
  if (!currentOrigin || !dappOrigin) return false;

  return (
    urlUtils.canoicalizeDappUrl(currentOrigin).httpOrigin ===
    urlUtils.canoicalizeDappUrl(dappOrigin).httpOrigin
  );
}
