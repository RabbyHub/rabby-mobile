import type { Account } from '@/core/startupServices/preference';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

export const isSamePerpsActionAccount = (
  left: Pick<Account, 'address' | 'type'> | null | undefined,
  right: Pick<Account, 'address' | 'type'> | null | undefined,
) =>
  !!left &&
  !!right &&
  left.type === right.type &&
  isSameAddress(left.address, right.address);
