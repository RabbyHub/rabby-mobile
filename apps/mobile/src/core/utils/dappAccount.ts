import { getFallbackAccountSnapshot } from '@/core/serviceApi/preference';
import { getTransactionHistoryTransactionsSnapshot } from '@/core/serviceApi/transactionHistory';
import type { DappInfo } from '@/core/services/dappService';
import type { KeyringAccountWithAlias } from '@/types/account';
import { resolveDappAccount } from '@/utils/dappAccount';

export const getDappAccount = ({
  dappInfo,
  accounts,
}: {
  dappInfo?: DappInfo;
  accounts: KeyringAccountWithAlias[];
}) => {
  return resolveDappAccount({
    dappInfo,
    accounts,
    transactions: getTransactionHistoryTransactionsSnapshot(),
    fallbackAccount: getFallbackAccountSnapshot(),
  });
};
