import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { MainContainer, type Setting, settingAtom } from './MainContainer';
import { useAtom } from 'jotai';
import { apiMnemonic } from '@/core/apis';

type MnemonicKeyring = NonNullable<
  ReturnType<typeof apiMnemonic.getKeyringByMnemonic>
>;

export const SettingHDKeyring: React.FC<{
  onDone: (setting: Setting) => void;
  mnemonics: string;
  passphrase: string;
}> = ({ onDone, mnemonics, passphrase }) => {
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

  const mnemonicKeyringRef = React.useRef<
    ReturnType<typeof apiMnemonic.getKeyringByMnemonic> | undefined
  >(undefined);
  const getMnemonicKeyring = React.useCallback(() => {
    if (mnemonics) {
      if (!mnemonicKeyringRef.current) {
        mnemonicKeyringRef.current = apiMnemonic.getKeyringByMnemonic(
          mnemonics!,
          passphrase!,
        );
      }
      return mnemonicKeyringRef.current;
    }
    return undefined;
  }, [mnemonics, passphrase]);

  const handleConfirm = React.useCallback(
    async (value: Setting) => {
      const keyring = await getMnemonicKeyring();
      await keyring?.setHDPathType(
        value.hdPath as unknown as Parameters<
          MnemonicKeyring['setHDPathType']
        >[0],
      );
      setSetting(value);
      onDone?.(value);
    },
    [getMnemonicKeyring, onDone, setSetting],
  );

  return (
    <MainContainer
      hdPathOptions={hdPathOptions}
      onConfirm={handleConfirm}
      setting={setting}
    />
  );
};
