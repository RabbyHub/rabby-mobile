import { isNonPublicProductionEnv } from '@/constant/env';
import { PERPS_ASTER_INVITE_URL, PERPS_INVITE_URL } from '@/constant/perps';
import { apisPerps } from '@/core/apis';
import { preferenceService } from '@/core/services';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useRequest } from 'ahooks';
import { useMemo, useState } from 'react';

export const useHyperliquidReferral = (options?: {
  url?: string | null;
  connectedAddress?: string | null;
}) => {
  const [isShowInvite, setIsShowInvite] = useState(false);
  const { url, connectedAddress } = options || {};

  const origin = useMemo(() => {
    return url ? safeGetOrigin(url) : null;
  }, [url]);

  useRequest(
    async () => {
      const sdk = apisPerps.getPerpsSDK();
      if (!origin || !url || !connectedAddress) {
        return false;
      }

      if (origin !== 'https://app.hyperliquid.xyz') {
        return false;
      }

      if (url?.toLowerCase() === PERPS_INVITE_URL.toLowerCase()) {
        return false;
      }

      const inviteConfig = preferenceService.getPreference('hyperliquidInvite');

      if (isNonPublicProductionEnv) {
        if (Date.now() - (inviteConfig?.lastTime || 0) < 5 * 60 * 1000) {
          return false;
        }
      } else {
        if (Date.now() - (inviteConfig?.lastTime || 0) < 24 * 60 * 60 * 1000) {
          return false;
        }
      }
      const data = await sdk.info.getReferral(connectedAddress);

      const isReferred = !!data?.referredBy;

      return !isReferred;
    },
    {
      refreshDeps: [origin, connectedAddress],
      onError(e) {
        console.log('check hyperliquid referral error', e);
      },
      onSuccess(shouldInvite) {
        setIsShowInvite(shouldInvite);
      },
    },
  );

  return {
    isShowInvite,
    setIsShowInvite,
  };
};

export const useAsterReferral = (options?: {
  url?: string | null;
  connectedAddress?: string | null;
}) => {
  const [isShowInvite, setIsShowInvite] = useState(false);
  const { url, connectedAddress } = options || {};

  const origin = useMemo(() => {
    return url ? safeGetOrigin(url) : null;
  }, [url]);

  useRequest(
    async () => {
      if (!origin || !url || !connectedAddress) {
        return false;
      }

      if (origin !== 'https://www.asterdex.com') {
        return false;
      }

      if (url?.toLowerCase() === PERPS_ASTER_INVITE_URL.toLowerCase()) {
        return false;
      }

      const hasShowAsterReferral =
        preferenceService.getPreference('hasShowAsterReferralMap')?.[
          connectedAddress
        ] || false;

      if (hasShowAsterReferral) {
        return false;
      }

      return true;
    },
    {
      refreshDeps: [origin, connectedAddress],
      onError(e) {
        console.log('check aster referral error', e);
      },
      onSuccess(shouldInvite) {
        setIsShowInvite(shouldInvite);
      },
    },
  );

  return {
    isShowInvite,
    setIsShowInvite,
  };
};
