import { apiLedger } from '@/core/apis';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { useAtom } from 'jotai';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  initAccountsAtom,
  isLoadedAtom,
  MainContainer,
  settingAtom,
} from './MainContainer';
import { InitAccounts } from './type';

export const SettingLedger: React.FC<{
  onDone: () => void;
}> = ({ onDone }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = React.useState(false);
  const hdPathOptions = React.useMemo(
    () => [
      {
        title: 'Ledger Live',
        description: t('page.newAddress.hd.ledger.hdPathType.ledgerLive'),
        noChainDescription: t(
          'page.newAddress.hd.ledger.hdPathTypeNoChain.ledgerLive',
        ),
        value: LedgerHDPathType.LedgerLive,
      },
      {
        title: 'BIP44',
        description: t('page.newAddress.hd.ledger.hdPathType.bip44'),
        noChainDescription: t(
          'page.newAddress.hd.ledger.hdPathTypeNoChain.bip44',
        ),
        value: LedgerHDPathType.BIP44,
      },
      {
        title: 'Legacy',
        description: t('page.newAddress.hd.ledger.hdPathType.legacy'),
        noChainDescription: t(
          'page.newAddress.hd.ledger.hdPathTypeNoChain.legacy',
        ),
        value: LedgerHDPathType.Legacy,
      },
    ],
    [t],
  );

  const [initAccounts, setInitAccounts] = useAtom(initAccountsAtom);
  const [setting, setSetting] = useAtom(settingAtom);
  const [isLoaded, setIsLoaded] = useAtom(isLoadedAtom);
  const handleConfirm = React.useCallback(
    value => {
      apiLedger
        .setCurrentUsedHDPathType(value.hdPath)
        .then(() => setSetting(value));
      onDone?.();
    },
    [onDone, setSetting],
  );

  React.useEffect(() => {
    if (isLoaded) {
      return;
    }

    setLoading(true);
    apiLedger
      .getInitialAccounts()
      .then(res => setInitAccounts(res as InitAccounts))
      .finally(() => setLoading(false));
    setIsLoaded(true);
  }, [isLoaded, setInitAccounts, setIsLoaded, setSetting]);

  return (
    <MainContainer
      loading={loading}
      initAccounts={initAccounts}
      hdPathOptions={hdPathOptions}
      onConfirm={handleConfirm}
      setting={setting}
    />
  );
};
