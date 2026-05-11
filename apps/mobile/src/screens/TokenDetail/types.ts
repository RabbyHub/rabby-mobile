import type { AbstractProject } from '@/screens/Home/types';
import type { KEYRING_TYPE } from '@rabby-wallet/keyring-utils/src/types';

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
