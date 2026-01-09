import { useCallback, useEffect, useMemo } from 'react';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { ScrollView, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { apisHomeTabIndex, useRabbyAppNavigation } from '@/hooks/navigation';
import { AddressItemInner2024 } from '../Address/components/AddressItemInner2024';
import AnimationImportSuccess from '@/assets2024/animations/animation-import-success.json';
import Lottie from 'lottie-react-native';
import { toast } from '@/components2024/Toast';
import { RootNames } from '@/constant/layout';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { useRoute } from '@react-navigation/native';
import { useAccounts } from '@/hooks/account';
import { useSortAddressList } from '../Address/useSortAddressList';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useSpecifyAccountsBalance } from './hooks/balance';
import { preferenceService } from '@/core/services';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
import { syncMultiAddressesHistory } from '@/databases/hooks/history';
import { accountEvents } from '@/core/apis/account';

export const SyncExtensionAccountSuccessfulScreen = () => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });

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

  const { balanceAccounts, balanceLoading, fetchTotalBalance } =
    useSpecifyAccountsBalance(accounts);

  useEffect(() => {
    if (accounts.length) {
      fetchTotalBalance();
      syncMultiAddressesHistory(accounts.slice(0, 5).map(e => e.address));

      accountEvents.emit('ACCOUNT_ADDED', {
        accounts: accounts,
        scene: 'syncExtension',
      });
    }
  }, [accounts, fetchTotalBalance]);

  const sortedList = useSortAddressList(
    balanceAccounts?.length ? balanceAccounts : accounts,
  );

  const handleConfirm = async () => {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: RootNames.StackRoot,
          params: {
            screen: RootNames.Home,
          },
        },
      ],
    });
    apisHomeTabIndex.setTabIndex(0);

    preferenceService.setReportActionTs(
      REPORT_TIMEOUT_ACTION_KEY.SCAN_SYNC_EXTENSION_DONE,
    );
  };

  useEffect(() => {
    toast.success(t('page.syncExtension.importedSuccessfully'));
  }, [t]);

  return (
    <FooterButtonScreenContainer
      as="View"
      buttonProps={{
        title: t('global.Done'),
        onPress: handleConfirm,
      }}
      style={styles.screen}
      footerBottomOffset={56}
      footerContainerStyle={styles.ph}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {sortedList?.map(e => (
          <AddressItemInner2024
            style={styles.account}
            account={e}
            key={e.address + e.type}
            hiddenArrow
          />
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>
      <View pointerEvents="none" style={[styles.animationLayer]}>
        <Lottie
          style={styles.animationLottie}
          source={AnimationImportSuccess}
          loop={false}
          autoPlay
          direction={1}
        />
      </View>
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
    paddingTop: 36,
    paddingHorizontal: 20,
    gap: 12,
  },

  animationLayer: {
    height: '100%',
    position: 'absolute',
    zIndex: 999,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  animationLottie: {
    width: '100%',
    height: '100%',
  },
  account: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: ctx.colors2024['neutral-line'],
  },
}));
