import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ScreenHeaderAccountTitle } from '@/components/AccountSwitcher/OnScreenHeader';
import { AutoFitCenterHeader } from '@/components/AutoFitCenterHeader';
import { useMyAccounts } from '@/hooks/account';
import { findAccountByPriority } from '@/utils/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

import { HistoryHeaderTitle } from './HistoryHeaderTitle';

/**
 * Shared JS header for the history detail screens.
 *
 * It is registered on the route (`header: () => <HistoryDetailHeader />`) so the
 * push transition starts with the same header it ends with. Installing the
 * custom header from an effect after mount swapped the header type mid
 * transition, which made iOS animate the previous native header out as a
 * duplicated copy (and could duplicate the back arrow).
 */
export const HistoryDetailHeader = ({
  title,
  address,
  keyringType,
}: {
  title?: string;
  address?: string;
  keyringType?: string;
}) => {
  const { t } = useTranslation();
  const { accounts } = useMyAccounts({ disableAutoFetch: true });

  const currentAccount = useMemo(() => {
    if (!address) {
      return undefined;
    }
    const candidates = accounts.filter(
      acc =>
        isSameAddress(acc.address, address) &&
        acc.type !== KEYRING_TYPE.WatchAddressKeyring,
    );
    if (keyringType) {
      const matched = candidates.find(acc => acc.type === keyringType);
      if (matched) {
        return matched;
      }
    }
    return findAccountByPriority(candidates);
  }, [accounts, address, keyringType]);

  const titleText = title || t('page.transactions.itemTitle.Default');

  return (
    <AutoFitCenterHeader
      title={titleText}
      titleNode={
        <ScreenHeaderAccountTitle
          account={currentAccount}
          titleText={<HistoryHeaderTitle>{titleText}</HistoryHeaderTitle>}
        />
      }
    />
  );
};
