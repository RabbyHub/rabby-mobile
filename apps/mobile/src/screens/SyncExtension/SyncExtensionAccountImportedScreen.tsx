import { useEffect, useMemo } from 'react';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { ScrollView, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { SyncExtensionHeader } from './components/Header';
import { AddressItemInner2024 } from '../Address/components/AddressItemInner2024';
import { useNavigationState } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { AddressNavigatorParamList } from '@/navigation-type';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useSortAddressList } from '../Address/useSortAddressList';
import { useAccounts } from '@/hooks/account';
import { useSpecifyAccountsBalance } from './hooks/balance';

export const SyncExtensionAccountImportedScreen = () => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });

  const navigation = useRabbyAppNavigation();

  const navState = useNavigationState(
    s => s.routes.find(e => e.name === RootNames.SyncExtensionImported)?.params,
  ) as AddressNavigatorParamList['SyncExtensionImported'];

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

  const { balanceAccounts, balanceLoading, fetchTotalBalance } =
    useSpecifyAccountsBalance(accounts);

  useEffect(() => {
    if (accounts.length) {
      fetchTotalBalance();
    }
  }, [accounts, fetchTotalBalance]);

  const sortedList = useSortAddressList(
    balanceAccounts?.length ? balanceAccounts : accounts,
  );

  const handleConfirm = () => {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: RootNames.StackAddress,
          params: {
            screen: RootNames.SyncExtensionAccountSuccess,
            params: {
              newAccounts:
                balanceAccounts.length && !balanceLoading
                  ? balanceAccounts
                  : accounts,
            },
          },
        },
      ],
    });
  };

  return (
    <FooterButtonScreenContainer
      as="View"
      buttonProps={{
        title: t('global.Confirm'),
        onPress: handleConfirm,
      }}
      style={styles.screen}
      footerBottomOffset={56}
      footerContainerStyle={styles.ph}>
      <View style={styles.ph}>
        <SyncExtensionHeader type="imported" />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {(sortedList.length ? sortedList : accounts)?.map(e => (
          <AddressItemInner2024
            style={styles.account}
            account={e as any}
            key={e.address + e.type}
            hiddenArrow
          />
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>
    </FooterButtonScreenContainer>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  screen: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },

  ph: {
    paddingHorizontal: 20,
  },

  scrollContent: {
    // flex: 1,
    paddingTop: 36,
    paddingHorizontal: 20,
    gap: 12,
  },

  account: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: ctx.colors2024['neutral-line'],
  },
}));
