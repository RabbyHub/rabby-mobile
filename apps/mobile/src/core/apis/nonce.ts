import BigNumber from 'bignumber.js';
import { t } from 'i18next';

import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { findChain } from '@/utils/chain';
import {
  getServiceReady,
  SERVICE_READY_KEYS,
} from '@/core/services/serviceReady';
import { getProviderController } from '@/core/controllers/provider';
import type { Account } from '@/core/services/preference';
import type { TransactionHistoryService } from '@/core/services/transactionHistory';

export const getRecommendNonce = async ({
  from,
  chainId,
  account,
}: {
  from: string;
  chainId: number;
  account: Account | null;
}) => {
  const chain = findChain({
    id: chainId,
  });
  if (!chain) {
    throw new Error(t('background.error.invalidChainId'));
  }

  const [providerController, transactionHistoryService] = await Promise.all([
    getProviderController(),
    getServiceReady<TransactionHistoryService>(
      SERVICE_READY_KEYS.transactionHistoryService,
    ),
  ]);

  const onChainNonce = await providerController.ethRpc(
    {
      data: {
        method: 'eth_getTransactionCount',
        params: [from, 'latest'],
      },
      session: INTERNAL_REQUEST_SESSION,
      account,
    },
    chain.serverId,
  );
  const localNonce =
    (await transactionHistoryService.getNonceByChain(from, chainId)) || 0;

  return `0x${BigNumber.max(onChainNonce, localNonce).toString(16)}`;
};
