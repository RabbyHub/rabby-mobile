import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { apisKeyring } from '@/core/apis/keyring';
import { sendRequest } from '@/core/apis/sendRequest';
import type { Account } from '@/core/startupServices/preference';
import { miniSignTypedData } from '@/hooks/useMiniSignTypedData';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

import { PerpsActionUserCancelledError } from './actionError';

export type PerpsTypedDataSignAction = {
  action: any;
  signature: string;
};

export const signPerpsTypedDataActions = async <
  TAction extends PerpsTypedDataSignAction,
>(
  actions: TAction[],
  account: Account,
): Promise<void> => {
  const isLocalWallet =
    account.type === KEYRING_CLASS.PRIVATE_KEY ||
    account.type === KEYRING_CLASS.MNEMONIC;
  const usesMiniApproval =
    account.type === KEYRING_CLASS.HARDWARE.ONEKEY ||
    account.type === KEYRING_CLASS.HARDWARE.LEDGER;

  if (usesMiniApproval) {
    try {
      const results = await miniSignTypedData({
        account,
        txs: actions.map(item => ({
          data: item.action,
          from: account.address,
          version: 'V4',
        })),
      });
      results.forEach((item, index) => {
        const action = actions[index];
        if (action) {
          action.signature = item.txHash;
        }
      });
      return;
    } catch {
      throw new PerpsActionUserCancelledError();
    }
  }

  for (const item of actions) {
    item.signature = isLocalWallet
      ? await apisKeyring.signTypedData(
          account.type,
          account.address,
          item.action,
          { version: 'V4' },
        )
      : await sendRequest({
          account,
          data: {
            method: 'eth_signTypedDataV4',
            params: [account.address, JSON.stringify(item.action)],
          },
          session: INTERNAL_REQUEST_SESSION,
        });
  }
};
