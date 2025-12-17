import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { atom, useAtom } from 'jotai';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Text, View } from 'react-native';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { addressUtils } from '@rabby-wallet/base-utils';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { FooterButtonGroup } from '@/components2024/FooterButtonGroup';
import { apisSingleHome } from '@/screens/Home/hooks/singleHome';

const { isSameAddress } = addressUtils;

const visibleAtom = atom(false);
const accountAtom = atom<KeyringAccountWithAlias | undefined>(undefined);

export const useDuplicateAddressModal = () => {
  const [_, setVisible] = useAtom(visibleAtom);
  const [_1, setAccount] = useAtom(accountAtom);

  const show = React.useCallback(
    (a: KeyringAccountWithAlias) => {
      setVisible(true);
      setAccount(a);
    },
    [setAccount, setVisible],
  );

  const hide = React.useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  return { show, hide };
};

export const DuplicateAddressModal: React.FC = () => {
  const [visible, setVisible] = useAtom(visibleAtom);
  const [account] = useAtom(accountAtom);
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { accounts } = useAccounts();

  const currentAccount = React.useMemo(() => {
    if (!account) {
      return;
    }

    return accounts.find(
      a =>
        isSameAddress(a.address, account.address) &&
        a.type === account.type &&
        a.brandName === account.brandName,
    );
  }, [accounts, account]);

  const handleSwitch = React.useCallback(async () => {
    if (currentAccount) {
      apisSingleHome.navigateToSingleHome(currentAccount);
    }
  }, [currentAccount]);

  const onCancel = React.useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  const onConfirm = React.useCallback(() => {
    handleSwitch();
    setVisible(false);
  }, [handleSwitch, setVisible]);

  return (
    <Modal
      style={styles.modal}
      visible={visible}
      transparent
      animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>
            {t('page.newAddress.privateKey.repeatImportTips')}
          </Text>
          <View style={styles.body}>
            {currentAccount && <AddressItem account={currentAccount} />}
          </View>

          <FooterButtonGroup
            style={styles.btns}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        </View>
      </View>
    </Modal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  modal: { maxWidth: 353, width: '100%' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    maxWidth: 352,
    backgroundColor: colors2024['neutral-bg-1'],
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    borderRadius: 20,
  },
  title: {
    fontSize: 18,
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    paddingHorizontal: 20,
  },
  body: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 12,
  },
  btns: {
    padding: 0,
    marginTop: 20,
    paddingHorizontal: 20,
  },
}));
