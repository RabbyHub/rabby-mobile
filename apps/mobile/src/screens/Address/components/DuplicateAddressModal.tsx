import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { atom, useAtom } from 'jotai';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components';
import {
  KeyringAccountWithAlias,
  useAccounts,
  useCurrentAccount,
} from '@/hooks/account';
import { addressUtils } from '@rabby-wallet/base-utils';
import { AddressItemInner } from './AddressItemInner';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';

const { isSameAddress } = addressUtils;

const visibleAtom = atom(true);
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
  const { styles } = useThemeStyles(getStyles);
  const { t } = useTranslation();
  const { accounts } = useAccounts();
  const { switchAccount } = useCurrentAccount();

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
      switchAccount(currentAccount);
      navigate(RootNames.StackRoot, { screen: RootNames.Home });
    }
  }, [switchAccount, currentAccount]);

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
            The address has been imported, do you want to switch to this
            address?
          </Text>
          <View style={styles.body}>
            {currentAccount && (
              <AddressItemInner isInModal wallet={currentAccount} />
            )}
          </View>

          <View style={styles.buttonGroup}>
            <Button
              title={t('global.Cancel')}
              containerStyle={styles.btnContainer}
              buttonStyle={styles.cancelStyle}
              titleStyle={styles.cancelTitleStyle}
              onPress={onCancel}
            />
            <View style={styles.btnGap} />

            <Button
              title={t('global.Confirm')}
              containerStyle={styles.btnContainer}
              buttonStyle={styles.confirmStyle}
              titleStyle={styles.confirmTitleStyle}
              onPress={onConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = createGetStyles(colors => ({
  modal: { maxWidth: 353, width: '100%' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    maxWidth: 350,
    backgroundColor: colors['neutral-bg1'],
    paddingVertical: 20,
    borderRadius: 16,
  },
  title: {
    fontSize: 18,
    color: colors['neutral-title1'],
    fontWeight: '500',
    paddingHorizontal: 20,
  },
  body: {
    backgroundColor: colors['neutral-card2'],
    borderRadius: 6,
    marginHorizontal: 20,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonGroup: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopColor: colors['neutral-line'],
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 20,
    marginTop: 28,
  },

  btnContainer: {
    flex: 1,
    height: 50,
  },

  cancelStyle: {
    backgroundColor: colors['neutral-card-1'],
    borderColor: colors['blue-default'],
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 8,
    height: '100%',
    width: '100%',
  },
  cancelTitleStyle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
    color: colors['blue-default'],
    flex: 1,
  },
  btnGap: {
    width: 13,
  },
  confirmStyle: {
    backgroundColor: colors['blue-default'],
    borderRadius: 8,
    width: '100%',
    height: '100%',
  },
  confirmTitleStyle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
    color: colors['neutral-title2'],
    flex: 1,
  },
}));
