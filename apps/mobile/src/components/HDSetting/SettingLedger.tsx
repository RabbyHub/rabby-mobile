import { apiLedger } from '@/core/apis';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { MainContainer, Setting } from './MainContainer';
import { InitAccounts } from './type';

export const SettingLedger: React.FC<{
  onDone: () => void;
}> = ({ onDone }) => {
  const { t } = useTranslation();
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

  const [initAccounts, setInitAccounts] = React.useState<InitAccounts>();
  const [setting, setSetting] = React.useState<Setting>({
    hdPath: LedgerHDPathType.LedgerLive,
    startNumber: 1,
  });
  const handleConfirm = React.useCallback(
    value => {
      console.log('confirm', value);
      onDone?.();
    },
    [onDone],
  );

  React.useEffect(() => {
    apiLedger.getCurrentUsedHDPathType().then(res => {
      setSetting(prev => ({
        ...prev,
        hdPath: res ?? LedgerHDPathType.LedgerLive,
      }));
    });
    apiLedger
      .getInitialAccounts()
      .then(res => setInitAccounts(res as InitAccounts));
  }, []);

  return (
    <MainContainer
      initAccounts={initAccounts}
      hdPathOptions={hdPathOptions}
      onConfirm={handleConfirm}
      setting={setting}
    />
  );
};
