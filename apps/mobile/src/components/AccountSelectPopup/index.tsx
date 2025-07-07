import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
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
import { RcIconEmptyCC } from '@/assets/icons/gnosis';
import { Account } from '@/core/services/preference';

interface AccountSelectDrawerProps {
  onChange(account: Account): void;
  onCancel(): void;
  title: string;
  visible: boolean;
  isLoading?: boolean;
  networkId: string;
  owners?: string[];
}

export const AccountSelectPopup = ({
  onChange,
  title,
  onCancel,
  visible,
  isLoading = false,
  networkId,
  owners,
}: AccountSelectDrawerProps) => {
  const [checkedAccount, setCheckedAccount] =
    useState<KeyringAccountWithAlias | null>(null);
  const { accounts: _accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const accounts = useMemo(() => {
    return sortBy(
      _accounts.filter(item => item.type !== KEYRING_TYPE.GnosisKeyring),
      account => {
        return owners?.find(address => isSameAddress(address, account.address))
          ? -1
          : 1;
      },
      account => {
        if (account.type === KEYRING_TYPE.HdKeyring) {
          return 1;
        }
        if (account.type === KEYRING_TYPE.SimpleKeyring) {
          return 2;
        }
        return account.type === KEYRING_TYPE.WatchAddressKeyring ? 10 : 3;
      },
    );
  }, [_accounts, owners]);

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
      snapPoints={[640]}>
      <BottomSheetView>
        <View
          style={[
            styles.popupContainer,
            {
              paddingBottom: bottom || 20,
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
            ListEmptyComponent={
              <View style={styles.empty}>
                <RcIconEmptyCC color={themeColors['neutral-foot']} />
                <Text style={styles.emptyText}>No available address</Text>
              </View>
            }
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
    textAlign: 'center',
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
  empty: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 140,
  },
  emptyText: {
    color: colors['neutral-foot'],
    fontSize: 14,
    lineHeight: 24,
    marginTop: 16,
  },
}));
