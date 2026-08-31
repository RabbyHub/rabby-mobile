import { apisPerps } from '@/core/apis';
import type { Account } from '@/core/startupServices/preference';
import { isSamePerpsActionAccount } from '@/hooks/perps/actions/accountGuard';
import { ensurePerpsActionApproval } from '@/hooks/perps/actions/perpsActionApproval';
import { runPerpsAction } from '@/hooks/perps/perpsActionError';
import { showToast } from '@/hooks/perps/showToast';
import { perpsStore } from '@/hooks/perps/usePerpsStore';

import type { PerpsStableCoinOrderParams } from './types';

export const executePerpsStableCoinOrder = (
  account: Account | null,
  params: PerpsStableCoinOrderParams,
) =>
  runPerpsAction(
    {
      fallback: null,
      label: 'spot order',
      getToastMessage: error => error?.message || 'Swap failed',
      context: params,
    },
    async () => {
      if (!account) {
        throw new Error('No current Perps account');
      }
      if (
        params.coin !== 'USDH' &&
        params.coin !== 'USDT' &&
        params.coin !== 'USDE'
      ) {
        throw new Error('Invalid stablecoin');
      }
      await ensurePerpsActionApproval(account, { builderFee: false });
      if (
        !isSamePerpsActionAccount(
          perpsStore.getState().currentPerpsAccount,
          account,
        )
      ) {
        throw new Error('Perps account changed');
      }

      const sdk = apisPerps.getPerpsSDK();
      const response = await sdk.exchange?.stableCoinOrder(params);
      const filled = response?.response?.data?.statuses[0]?.filled;
      if (filled) {
        showToast('Swap completed successfully', 'success');
        return filled;
      }
      const error = response?.response?.data?.statuses[0]?.error;
      throw new Error(error || 'Swap failed');
    },
  );
