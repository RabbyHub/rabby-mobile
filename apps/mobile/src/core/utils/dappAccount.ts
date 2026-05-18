import {
  preferenceService,
  transactionHistoryService,
} from '@/core/services/shared';
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
    transactions: transactionHistoryService.store.transactions,
    fallbackAccount: preferenceService.getFallbackAccount(),
  });
};
