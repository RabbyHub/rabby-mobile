import { useEffect, useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import {
  apisHomeTabIndex,
  resetNavigationTo,
  useRabbyAppNavigation,
} from '@/hooks/navigation';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { useRoute } from '@react-navigation/native';
import { useAccounts } from '@/hooks/account';
import { useSortAddressList } from '../Address/useSortAddressList';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import balanceStore from '@/store/balance';
import { preferenceService } from '@/core/services';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
import { apisSingleHome } from '../Home/hooks/singleHome';
import { syncMultiAddressesHistory } from '@/databases/hooks/history';
import { accountEvents } from '@/core/apis/account';
import { Button } from '@/components2024/Button';
import {
  WalletSuccessCard,
  AddressItem,
} from '@/components2024/WalletSuccessCard';

export const SyncExtensionAccountSuccessfulScreen = () => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { top, bottom } = useSafeAreaInsets();

  const navigation = useRabbyAppNavigation();

  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'AddressNavigatorParamList',
        'SyncExtensionAccountSuccess'
      >
    >();
  const navState = route.params;

  const { accounts: acc } = useAccounts();

  const list = useSortAddressList(acc);

  const accounts = useMemo(
    () =>
      list.filter(account =>
        navState?.newAccounts.some(
          newAccount =>
            isSameAddress(account.address, newAccount.address) &&
            account.type === (newAccount.type || newAccount.brandName),
        ),
      ),
    [list, navState?.newAccounts],
  );

  const balanceMap = balanceStore(s => s.balanceMap);
  const batchGetTotalBalance = balanceStore(s => s.batchGetTotalBalance);

  const balanceAccounts = useMemo(() => {
    return accounts.map(account => {
      const balance = balanceMap[account.address.toLowerCase()];
      return {
        ...account,
        balance: balance?.totalBalance ?? account.balance ?? 0,
        evmBalance: balance?.evmBalance ?? account.evmBalance ?? 0,
      };
    });
  }, [accounts, balanceMap]);

  useEffect(() => {
    if (accounts.length) {
      batchGetTotalBalance(
        accounts.map(account => account.address),
        true,
      );
      syncMultiAddressesHistory(accounts.slice(0, 5).map(e => e.address));

      accountEvents.emit('ACCOUNT_ADDED', {
        accounts: accounts,
        scene: 'syncExtension',
      });
    }
  }, [accounts, batchGetTotalBalance]);

  const sortedList = useSortAddressList(
    balanceAccounts?.length ? balanceAccounts : accounts,
  );

  const addressItems: AddressItem[] = useMemo(
    () =>
      sortedList.map(account => ({
        address: account.address,
        brandName: account.type,
        showBalance: true,
      })),
    [sortedList],
  );

  const singleAccount = sortedList.length === 1 ? sortedList[0] : null;

  const handleConfirm = () => {
    if (singleAccount) {
      apisSingleHome.navigateToSingleHome(singleAccount, { replace: true });
    } else {
      resetNavigationTo(navigation, 'Home');
    }
    apisHomeTabIndex.setTabIndex(0);

    preferenceService.setReportActionTs(
      REPORT_TIMEOUT_ACTION_KEY.SCAN_SYNC_EXTENSION_DONE,
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardAvoidingView}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: top }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {addressItems.length > 0 && (
          <WalletSuccessCard
            title={
              singleAccount
                ? t('page.importSuccess.titleImported')
                : t('page.importSuccess.titleMultiple', {
                    count: sortedList.length,
                  })
            }
            addresses={addressItems}
          />
        )}

        <View style={[styles.footer, { paddingBottom: bottom + 20 }]}>
          <Button
            containerStyle={styles.btnContainer}
            type="primary"
            title={
              singleAccount
                ? t('page.importSuccess.viewAddress')
                : t('global.Done')
            }
            onPress={handleConfirm}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  footer: {
    marginTop: 'auto',
    width: '100%',
    alignItems: 'center',
    paddingTop: 16,
  },
  btnContainer: {
    width: '100%',
  },
}));
