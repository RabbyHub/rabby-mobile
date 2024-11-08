import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { addressUtils } from '@rabby-wallet/base-utils';
import React from 'react';
import { ScrollView } from 'react-native';
import { AddressDetailInner } from './AddressDetailInner';

export interface Props {
  account: KeyringAccountWithAlias;
  onCancel: () => void;
}

export const AddressDetail: React.FC<Props> = ({ account, onCancel }) => {
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const currentAccount = React.useMemo(
    () =>
      accounts?.find(
        item =>
          addressUtils.isSameAddress(item.address, account.address) &&
          item.type === account.type,
      ),
    [accounts, account],
  );

  if (!currentAccount) {
    return null;
  }

  return (
    <ScrollView>
      <AddressDetailInner account={currentAccount} onCancel={onCancel} />
    </ScrollView>
  );
};
