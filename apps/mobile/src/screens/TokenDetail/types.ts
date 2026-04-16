import type { KEYRING_TYPE } from '@rabby-wallet/keyring-utils/src/types';

import type { AbstractProject } from '@/screens/Home/types';

export type TokenFromAddressItem = {
  address: string;
  amountStr: string;
  amount: number;
  type: KEYRING_TYPE;
  aliasName: string;
};

export type RelatedDeFiType = AbstractProject & {
  amount: number;
  address: string;
};
