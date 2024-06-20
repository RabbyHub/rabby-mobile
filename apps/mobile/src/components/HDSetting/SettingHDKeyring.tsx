import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { MainContainer, settingAtom } from './MainContainer';
import { requestKeyring } from '@/core/apis/keyring';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useAtom } from 'jotai';

export const SettingHDKeyring: React.FC<{
  onDone: () => void;
  mnemonics: string;
  passphrase: string;
  keyringId: number;
}> = ({ onDone, keyringId }) => {
  const { t } = useTranslation();
  const [setting, setSetting] = useAtom(settingAtom);

  const hdPathOptions = React.useMemo(
    () => [
      {
        title: 'BIP44',
        description: t('page.newAddress.hd.ledger.hdPathType.bip44'),
        noChainDescription: t(
          'page.newAddress.hd.ledger.hdPathTypeNoChain.bip44',
        ),
        value: LedgerHDPathType.BIP44,
      },
      {
        title: 'Ledger Live',
        description: t('page.newAddress.hd.ledger.hdPathType.ledgerLive'),
        noChainDescription: t(
          'page.newAddress.hd.ledger.hdPathTypeNoChain.ledgerLive',
        ),
        value: LedgerHDPathType.LedgerLive,
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

  const handleConfirm = React.useCallback(
    async value => {
      await requestKeyring(
        KEYRING_CLASS.MNEMONIC,
        'setHDPathType',
        keyringId || null,
        value.hdPath,
      );

      setSetting(value);
      onDone?.();
    },
    [keyringId, onDone, setSetting],
  );

  return (
    <MainContainer
      hdPathOptions={hdPathOptions}
      onConfirm={handleConfirm}
      setting={setting}
    />
  );
};
