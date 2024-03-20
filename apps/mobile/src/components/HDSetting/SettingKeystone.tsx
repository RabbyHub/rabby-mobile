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

export const SettingKeystone: React.FC<{
  onDone: () => void;
}> = ({ onDone }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = React.useState(false);
  const hdPathOptions = React.useMemo(
    () => [
      {
        title: 'Default',
        description: t('page.newAddress.hd.keystone.hdPathType.bip44'),
        noChainDescription: t(
          'page.newAddress.hd.keystone.hdPathTypeNoChain.bip44',
        ),
        value: LedgerHDPathType.BIP44,
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

    setIsLoaded(true);
    setLoading(true);
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
