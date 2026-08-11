import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { apisKeyring } from '@/core/apis/keyring';
import { sendRequest } from '@/core/apis/sendRequest';
import type { Account } from '@/core/startupServices/preference';
import { miniSignTypedData } from '@/hooks/useMiniSignTypedData';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

export const signPerpsMasterTypedData = async ({
  account,
  action,
  miniSignError,
}: {
  account: Account;
  action: Record<string, any>;
  miniSignError?: Error;
}): Promise<string> => {
  if (
    account.type === KEYRING_CLASS.PRIVATE_KEY ||
    account.type === KEYRING_CLASS.MNEMONIC
  ) {
    return apisKeyring.signTypedData(
      account.type,
      account.address.toLowerCase(),
      action as any,
      { version: 'V4' },
    );
  }

  if (
    account.type === KEYRING_CLASS.HARDWARE.ONEKEY ||
    account.type === KEYRING_CLASS.HARDWARE.LEDGER
  ) {
    try {
      const result = await miniSignTypedData({
        account,
        txs: [
          {
            data: action,
            from: account.address,
            version: 'V4',
          },
        ],
      });
      return result[0].txHash;
    } catch (error) {
      throw miniSignError ?? error;
    }
  }

  return sendRequest({
    account,
    data: {
      method: 'eth_signTypedDataV4',
      params: [account.address, JSON.stringify(action)],
    },
    session: INTERNAL_REQUEST_SESSION,
  });
};
