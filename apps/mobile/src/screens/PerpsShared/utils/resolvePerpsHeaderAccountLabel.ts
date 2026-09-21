import type { Account } from '@/core/startupServices/preference';
import { ellipsisAddress } from '@/utils/address';

type PerpsHeaderAccount = Pick<Account, 'address' | 'aliasName'>;

export const resolvePerpsHeaderAccountLabel = (
  account?: PerpsHeaderAccount | null,
  contactAlias?: string | null,
) => {
  if (!account?.address) {
    return null;
  }

  return account.aliasName || contactAlias || ellipsisAddress(account.address);
};
