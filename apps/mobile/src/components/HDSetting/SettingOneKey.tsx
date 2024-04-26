import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { useAtom } from 'jotai';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { isLoadedAtom, MainContainer, settingAtom } from './MainContainer';

export const SettingOneKey: React.FC<{
  onDone: () => void;
}> = ({ onDone }) => {
  const { t } = useTranslation();
  const [, setLoading] = React.useState(false);
  const hdPathOptions = React.useMemo(
    () => [
      {
        title: 'Default',
        description: t('page.newAddress.hd.onekey.hdPathType.bip44'),
        noChainDescription: t(
          'page.newAddress.hd.onekey.hdPathTypeNoChain.bip44',
        ),
        value: LedgerHDPathType.BIP44,
      },
    ],
    [t],
  );
  const [setting, setSetting] = useAtom(settingAtom);
  const [isLoaded, setIsLoaded] = useAtom(isLoadedAtom);

  const handleConfirm = React.useCallback(
    value => {
      setSetting(value);
      onDone?.();
    },
    [onDone, setSetting],
  );

  React.useEffect(() => {
    setLoading(false);

    if (isLoaded) {
      return;
    }

    setIsLoaded(true);
  }, [isLoaded, setIsLoaded, setSetting]);

  return (
    <MainContainer
      hdPathOptions={hdPathOptions}
      onConfirm={handleConfirm}
      setting={setting}
    />
  );
};
