import { apisPerps } from '@/core/apis';
import { runPerpsAction } from '@/hooks/perps/perpsActionError';
import { showToast } from '@/hooks/perps/showToast';

import type { PerpsStableCoinOrderParams } from './types';

export const executePerpsStableCoinOrder = (
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
      if (
        params.coin !== 'USDH' &&
        params.coin !== 'USDT' &&
        params.coin !== 'USDE'
      ) {
        throw new Error('Invalid stablecoin');
      }

      const sdk = apisPerps.getPerpsSDK();
      const response = await sdk.exchange?.stableCoinOrder(params);
      const filled = response?.response?.data?.statuses[0]?.filled;
      if (filled) {
        showToast('Swap completed successfully', 'success');
        return filled;
      }
      const error = response?.response?.data?.statuses[0]?.error;
      showToast(error || 'Swap failed', 'error');
      return null;
    },
  );
