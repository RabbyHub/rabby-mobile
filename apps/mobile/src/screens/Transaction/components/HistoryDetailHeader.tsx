import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { Account } from '@/core/startupServices/preference';
import { ScreenHeaderAccountTitle } from '@/components/AccountSwitcher/OnScreenHeader';
import { AutoFitCenterHeader } from '@/components/AutoFitCenterHeader';
import { useAccounts } from '@/hooks/account';
import { findAccountByPriority } from '@/utils/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

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
  account,
  address,
  keyringType,
}: {
  title?: string;
  /** The account the history item was opened for (route param). */
  account?: Account | null;
  address?: string;
  keyringType?: string;
}) => {
  const { t } = useTranslation();
  // Full account list (watch-only / Gnosis / WalletConnect included): the
  // header must be able to show the account the history item belongs to.
  const { accounts } = useAccounts({ disableAutoFetch: true });

  const currentAccount = useMemo(() => {
    // Prefer the account carried by the route: several accounts can share one
    // address (watch-only vs local, different keyrings), and the item knows
    // which one the user opened.
    if (account && (!address || isSameAddress(account.address, address))) {
      return account as any;
    }
    if (!address) {
      return undefined;
    }
    const candidates = accounts.filter(item =>
      isSameAddress(item.address, address),
    );
    if (keyringType) {
      const matched = candidates.find(item => item.type === keyringType);
      if (matched) {
        return matched;
      }
    }
    return candidates.length ? findAccountByPriority(candidates) : undefined;
  }, [account, accounts, address, keyringType]);

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
