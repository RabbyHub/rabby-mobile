import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import React from 'react';
import { View } from 'react-native';

export interface Props {
  params: {
    type: KEYRING_TYPE;
    mnemonics?: string;
    passphrase?: string;
    keyringId?: number;
  };
}

export const ImportMoreAddress: React.FC<Props> = ({ params }) => {
  return <View></View>;
};
