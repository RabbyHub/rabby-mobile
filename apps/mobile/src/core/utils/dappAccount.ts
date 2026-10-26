import { getFallbackAccountSnapshot } from '@/core/serviceApi/preference';
import type { DappInfo } from '@/core/services/dappService';
import type { TransactionHistoryItem } from '@/core/services/transactionHistory';
import type { KeyringAccountWithAlias } from '@/types/account';
import { resolveDappAccount } from '@/utils/dappAccount';

export const getDappAccount = ({
  dappInfo,
  accounts,
  transactions,
}: {
  dappInfo?: DappInfo;
  accounts: KeyringAccountWithAlias[];
  transactions: TransactionHistoryItem[];
}) => {
  return resolveDappAccount({
    dappInfo,
    accounts,
    transactions,
    fallbackAccount: getFallbackAccountSnapshot(),
  });
};
