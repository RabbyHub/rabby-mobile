import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { useAtom } from 'jotai';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { isLoadedAtom, MainContainer, settingAtom } from './MainContainer';
import { apiTrezor } from '@/core/apis';

export const SettingTrezor: React.FC<{
  onDone: () => void;
}> = ({ onDone }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = React.useState(false);
  const hdPathOptions = React.useMemo(
    () => [
      {
        title: 'Ledger Live',
        description: t('page.newAddress.hd.trezor.hdPathType.ledgerLive'),
        noChainDescription: t(
          'page.newAddress.hd.trezor.hdPathTypeNoChain.ledgerLive',
        ),
        value: LedgerHDPathType.LedgerLive,
      },
      {
        title: 'BIP44',
        description: t('page.newAddress.hd.trezor.hdPathType.bip44'),
        noChainDescription: t(
          'page.newAddress.hd.trezor.hdPathTypeNoChain.bip44',
        ),
        value: LedgerHDPathType.BIP44,
      },
      {
        title: 'Legacy',
        description: t('page.newAddress.hd.trezor.hdPathType.legacy'),
        noChainDescription: t(
          'page.newAddress.hd.trezor.hdPathTypeNoChain.legacy',
        ),
        value: LedgerHDPathType.Legacy,
      },
    ],
    [t],
  );

  const [setting, setSetting] = useAtom(settingAtom);
  const [isLoaded, setIsLoaded] = useAtom(isLoadedAtom);
  const handleConfirm = React.useCallback(
    value => {
      apiTrezor
        .setHDPathType(value.hdPath)
        .then(async () => {
          setSetting(value);
        })
        .finally(() => {
          onDone?.();
        });
    },
    [onDone, setSetting],
  );

  React.useEffect(() => {
    if (isLoaded) {
      return;
    }

    setLoading(false);

    setIsLoaded(true);
  }, [isLoaded, setIsLoaded, setSetting]);

  return (
    <MainContainer
      loading={loading}
      hdPathOptions={hdPathOptions}
      onConfirm={handleConfirm}
      setting={setting}
    />
  );
};
