import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { Account } from '@rabby-wallet/eth-walletconnect-keyring/type';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { sortBy } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../Button';
import { AppBottomSheetModal } from '../customized/BottomSheet';
import { AccountSelectItem } from './AccountSelectItem';

interface AccountSelectDrawerProps {
  onChange(account: Account): void;
  onCancel(): void;
  title: string;
  visible: boolean;
  isLoading?: boolean;
  networkId: string;
}

export const AccountSelectPopup = ({
  onChange,
  title,
  onCancel,
  visible,
  isLoading = false,
  networkId,
}: AccountSelectDrawerProps) => {
  const [checkedAccount, setCheckedAccount] =
    useState<KeyringAccountWithAlias | null>(null);
  const { accounts: _accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const accounts = useMemo(() => {
    return sortBy(
      _accounts.filter(item => item.type !== KEYRING_TYPE.GnosisKeyring),
      account => (account.type === KEYRING_TYPE.WalletConnectKeyring ? 0 : 1),
    );
  }, [_accounts]);

  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);
  const modalRef = React.useRef<AppBottomSheetModal>(null);
  const { bottom } = useSafeAreaInsets();

  React.useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);
  return (
    <AppBottomSheetModal
      ref={modalRef}
      onDismiss={() => onCancel?.()}
      snapPoints={[440]}>
      <BottomSheetView>
        <View
          style={[
            styles.popupContainer,
            {
              paddingBottom: bottom,
            },
          ]}>
          <Text style={styles.title}>{title}</Text>
          <FlatList
            data={accounts}
            renderItem={item => {
              const account = item.item;
              const checked = checkedAccount
                ? isSameAddress(account.address, checkedAccount.address) &&
                  checkedAccount.brandName === account.brandName
                : false;
              return (
                <AccountSelectItem
                  account={account}
                  onSelect={setCheckedAccount}
                  checked={checked}
                  networkId={networkId}
                />
              );
            }}
          />
          <View style={styles.footer}>
            <Button
              type="primary"
              onPress={onCancel}
              title={t('component.AccountSelectDrawer.btn.cancel')}
              containerStyle={styles.buttonContainer}
            />
            <Button
              type="primary"
              onPress={() => checkedAccount && onChange(checkedAccount)}
              disabled={!checkedAccount}
              title={t('component.AccountSelectDrawer.btn.proceed')}
              loading={isLoading}
              containerStyle={styles.buttonContainer}
            />
          </View>
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles(colors => ({
  popupContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    height: '100%',
  },
  title: {
    color: colors['neutral-title-1'],
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 10,
    lineHeight: 20,
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflow: 'scroll',
  },
  footer: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  buttonContainer: {
    flex: 1,
  },
}));
