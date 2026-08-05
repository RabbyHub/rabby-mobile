import type { Account } from '@/core/startupServices/preference';
import { isSameAddress } from '@rabby-wallet/base-utils/src/isomorphic/address';

export const isSamePerpsFundingAccount = (
  left: Account | null | undefined,
  right: Account | null | undefined,
) =>
  !!left &&
  !!right &&
  left.type === right.type &&
  isSameAddress(left.address, right.address);
