import { INTERNAL_REQUEST_SESSION, isNonPublicProductionEnv } from '@/constant';
import {
  PERPS_ASTER_INVITE_URL,
  PERPS_INVITE_URL,
  PERPS_REFERENCE_CODE,
} from '@/constant/perps';
import { apisPerps } from '@/core/apis';
import { sendRequest } from '@/core/apis/sendRequest';
import { preferenceService } from '@/core/services';
import { Account } from '@/core/services/preference';
import { miniSignTypedData } from '@/hooks/useMiniSignTypedData';
import { checkPerpsReference } from '@/utils/perps';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useMemoizedFn, useRequest } from 'ahooks';
import { useMemo, useState } from 'react';

export const useHyperliquidReferral = (options?: {
  url?: string | null;
  account?: Account | null;
}) => {
  const [isShowInvite, setIsShowInvite] = useState(false);
  const { url, account } = options || {};

  const origin = useMemo(() => {
    return url ? safeGetOrigin(url) : null;
  }, [url]);

  useRequest(
    async () => {
      if (!origin || !url || !account) {
        return false;
      }

      if (origin !== 'https://app.hyperliquid.xyz') {
        return false;
      }

      if (url?.toLowerCase() === PERPS_INVITE_URL.toLowerCase()) {
        return false;
      }

      return checkPerpsReference({
        account,
        scene: 'connect',
      });
    },
    {
      refreshDeps: [origin, account?.type, account?.address],
      onError(e) {
        console.log('check hyperliquid referral error', e);
      },
      onSuccess(shouldInvite) {
        setIsShowInvite(shouldInvite);
      },
    },
  );

  const handleInvite = useMemoizedFn(async () => {
    const sdk = apisPerps.getPerpsSDK();
    if (!account) {
      throw new Error('Account is required for referral');
    }

    const resp = sdk.exchange?.prepareSetReferrer(PERPS_REFERENCE_CODE);

    if (!resp) {
      throw new Error('Prepare set referrer failed');
    }

    let signature: string | undefined = '';

    const useMiniApprovalSign =
      account &&
      [
        KEYRING_CLASS.PRIVATE_KEY,
        KEYRING_CLASS.MNEMONIC,
        KEYRING_CLASS.HARDWARE.ONEKEY,
        KEYRING_CLASS.HARDWARE.LEDGER,
      ].includes(account?.type);

    if (useMiniApprovalSign) {
      try {
        const result = await miniSignTypedData({
          txs: [
            {
              data: resp?.typedData,
              from: account.address,
              version: 'V4',
            },
          ],
          account,
        });
        signature = result[0]?.txHash;
      } catch (e) {
        throw e;
      }
    } else {
      signature = await sendRequest({
        data: {
          method: 'eth_signTypedDataV4',
          params: [account.address, JSON.stringify(resp?.typedData)],
        },
        session: INTERNAL_REQUEST_SESSION,
        account: account,
      });
    }

    if (!signature) {
      throw new Error('Signature failed');
    }

    await sdk.exchange?.sendSetReferrer({
      action: resp?.action,
      nonce: resp?.nonce || 0,
      signature,
    });
  });

  return {
    isShowInvite,
    setIsShowInvite,
    handleInvite,
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
        preferenceService.getPreference('hasShowAsterPopup');

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
