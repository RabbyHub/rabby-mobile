/* eslint-disable react-native/no-inline-styles */
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PerpsAccountCard } from './components/PerpsAccountCard';
import { PerpsHeaderRight } from './components/PerpsHeaderRight';
import { PerpsHeaderTitle } from './components/PerpsHeaderTitle';
// import { PerpsMain } from './components/PerpsMain';
import { AccountSelectorPopup } from '@/components2024/AccountSelector/AccountSelectorPopup';
import { PerpsAgentsLimitModal } from './components/PerpsAgentsLimitModal';
import { PerpsGuidePopup } from './components/PerpsGuidePopup';
import { PerpsDepositPopup } from './components/PerpsDepositPopup';
import { PerpsWithdrawPopup } from './components/PerpsWithdrawPopup';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { usePerpsState } from '@/hooks/perps/usePerpsState';
import { usePerspPopupState } from './hooks/usePerpsPopupState';
import { useMemoizedFn, useRequest } from 'ahooks';
import { Account } from '@/core/services/preference';
import { PerpsAccountLogoutPopup } from './components/PerpsAccountLogoutPopup';
import { usePerpsDeposit } from './hooks/usePerpsDeposit';
import { PerpsHistorySection } from './components/PerpsHistorySection';
import { PerpsMarketSection } from './components/PerpsMarketSection';
import { PerpsPositionSection } from './components/PerpsPositionSection';
import { apisPerps } from '@/core/apis';
import { PerpsAccountSelectorPopup } from './components/PerpsAccountSelectorPopup';

export const PerpsScreen = () => {
  const { t } = useTranslation();

  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const navigation = useRabbyAppNavigation();

  const {
    positionAndOpenOrders,
    accountSummary,
    currentPerpsAccount,
    isLogin,
    marketData,
    userFills,
    marketDataMap,
    logout,
    login,
    handleWithdraw,
    homeHistoryList,
    handleDeleteAgent,
  } = usePerpsState();

  const [popupState, setPopupState] = usePerspPopupState();

  // console.log({ marketData });

  const handleLogin = useMemoizedFn(async (v: Account) => {
    console.log('-----------logoin');
    await login(v);
    console.log('----------after login');
    setPopupState(prev => ({
      ...prev,
      isShowLoginPopup: false,
    }));
  });

  const handleLogout = useMemoizedFn(() => {
    try {
      logout(currentPerpsAccount?.address || '');
      setPopupState(prev => ({
        ...prev,
        isShowLogoutPopup: false,
      }));
    } catch (e) {
      console.error(e);
    }
  });

  const { handleDeposit, updateMiniSignTx } = usePerpsDeposit({
    currentPerpsAccount,
  });

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => <PerpsHeaderTitle account={currentPerpsAccount} />,
      headerRight: () => (
        <PerpsHeaderRight
          isLogin={isLogin}
          onPress={() => {
            setPopupState(prev => ({
              ...prev,
              isShowLogoutPopup: true,
            }));
          }}
        />
      ),
    });
  }, [currentPerpsAccount, isLogin, navigation, setPopupState]);

  useEffect(() => {
    apisPerps.getHasDoneNewUserProcess().then(hasDoneNewUserProcess => {
      if (!hasDoneNewUserProcess) {
        setPopupState(prev => ({
          ...prev,
          isShowGuidePopup: true,
        }));
      }
    });
  }, [setPopupState]);

  return (
    <>
      <NormalScreenContainer2024 type="bg2">
        <View style={styles.container}>
          <PerpsHistorySection
            ListHeaderComponent={
              <>
                <PerpsAccountCard
                  isLogin={isLogin}
                  accountSummary={accountSummary}
                  positionAndOpenOrders={positionAndOpenOrders}
                />
                <PerpsPositionSection
                  positionAndOpenOrders={positionAndOpenOrders}
                  marketDataMap={marketDataMap}
                />
                <PerpsMarketSection marketData={marketData} />
              </>
            }
            marketDataMap={marketDataMap}
            homeHistoryList={homeHistoryList}
          />
        </View>
      </NormalScreenContainer2024>
      <PerpsAccountSelectorPopup
        visible={popupState.isShowLoginPopup}
        onClose={() => {
          setPopupState(prev => ({
            ...prev,
            isShowLoginPopup: false,
          }));
        }}
        value={currentPerpsAccount}
        onChange={handleLogin}
        title={t('page.perps.selectAccountTitle')}
      />
      <PerpsAccountLogoutPopup
        visible={popupState.isShowLogoutPopup}
        onClose={() => {
          setPopupState(prev => ({
            ...prev,
            isShowLogoutPopup: false,
          }));
        }}
        onLogout={handleLogout}
        account={currentPerpsAccount}
      />
      <PerpsAgentsLimitModal
        visible={popupState.isShowDeleteAgentPopup}
        onCancel={() => {
          setPopupState(prev => ({
            ...prev,
            isShowDeleteAgentPopup: false,
          }));
        }}
        onConfirm={() => {
          handleDeleteAgent();
          setPopupState(prev => ({
            ...prev,
            isShowDeleteAgentPopup: false,
          }));
        }}
      />
      <PerpsGuidePopup
        visible={popupState.isShowGuidePopup}
        onClose={async () => {
          const hasDoneNewUserProcess =
            await apisPerps.getHasDoneNewUserProcess();
          if (!hasDoneNewUserProcess) {
            navigation.goBack();
          }
          setPopupState(prev => ({
            ...prev,
            isShowGuidePopup: false,
          }));
        }}
        onComplete={() => {
          apisPerps.setHasDoneNewUserProcess(true);
          setPopupState(prev => ({
            ...prev,
            isShowGuidePopup: false,
          }));
        }}
      />
      <PerpsDepositPopup
        account={currentPerpsAccount}
        visible={popupState.isShowDepositPopup}
        onClose={() => {
          setPopupState(prev => ({
            ...prev,
            isShowDepositPopup: false,
          }));
        }}
        onDeposit={async v => {
          await handleDeposit(v);
          setPopupState(prev => ({
            ...prev,
            isShowDepositPopup: false,
          }));
        }}
      />
      <PerpsWithdrawPopup
        visible={popupState.isShowWithdrawPopup}
        accountSummary={accountSummary}
        onWithdraw={async v => {
          await handleWithdraw(v);
          setPopupState(prev => ({
            ...prev,
            isShowWithdrawPopup: false,
          }));
        }}
        onClose={() => {
          setPopupState(prev => ({
            ...prev,
            isShowWithdrawPopup: false,
          }));
        }}
      />
    </>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
  },
}));
