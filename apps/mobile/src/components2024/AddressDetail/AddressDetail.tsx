import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { addressUtils } from '@rabby-wallet/base-utils';
import React from 'react';
import { AddressDetailInner } from './AddressDetailInner';

export interface Props {
  account: KeyringAccountWithAlias;
  onCancel: () => void;
  onDelete?: () => void;
}

export const AddressDetail: React.FC<Props> = ({
  account,
  onCancel,
  onDelete,
}) => {
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
    <AddressDetailInner
      account={currentAccount}
      onCancel={onCancel}
      onDelete={onDelete}
      __IN_SHEET_MODAL__
    />
  );
};
