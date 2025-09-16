import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
} from 'react-native';
import { PerpsAccountCard } from './components/PerpsAccountCard';
import { PerpsHeaderRight } from './components/PerpsHeaderRight';
import { PerpsHeaderTitle } from './components/PerpsHeaderTitle';
// import { PerpsMain } from './components/PerpsMain';
import { AccountSelectorPopup } from '@/components2024/AccountSelector/AccountSelectorPopup';
import { PerpsAgentsLimitModal } from './components/PerpsAgentsLimitModal';
import * as Sentry from '@sentry/react-native';
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
import { PerpsRegionAlert } from './components/PerpsRegionAlert';
import { PerpsIntro } from '../PerpsMarketDetail/components/PerpsIntro';
import { PerpsClosePositionPopup } from '../PerpsMarketDetail/components/PerpsClosePositionPopup ';
import { AssetPosition } from '@rabby-wallet/hyperliquid-sdk';
import { toast } from '@/components2024/Toast';

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
    hasPermission,
    refreshData,
    fetchMarketData,
    perpFee,

    judgeIsUserAgentIsExpired,
    fetchClearinghouseState,
  } = usePerpsState();

  const [closePositionVisible, setClosePositionVisible] = React.useState(false);
  const [closePosition, setClosePosition] = useState<
    AssetPosition['position'] | null
  >(null);
  const [popupState, setPopupState] = usePerspPopupState();

  const handleLogin = useMemoizedFn(async (v: Account) => {
    logout(currentPerpsAccount?.address || '');
    await login(v);
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

  const { handleDeposit } = usePerpsDeposit({
    currentPerpsAccount,
  });

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => <PerpsHeaderTitle account={currentPerpsAccount} />,
    });
  }, [currentPerpsAccount, navigation]);

  const handleClosePosition = useMemoizedFn(
    async (params: {
      coin: string;
      size: string;
      direction: 'Long' | 'Short';
      price: string;
    }) => {
      try {
        const sdk = apisPerps.getPerpsSDK();
        const { coin, direction, price, size } = params;
        const res = await sdk.exchange?.marketOrderClose({
          coin,
          isBuy: direction === 'Short',
          size,
          midPx: price,
        });

        const filled = res?.response?.data?.statuses[0]?.filled;
        if (filled) {
          fetchClearinghouseState();
          const { totalSz, avgPx } = filled;
          const msg = `Closed ${direction} ${coin}-USD: Size ${totalSz} at Price $${avgPx}`;
          toast.success(
            Platform.OS === 'android'
              ? ({ textStyle }) => (
                  <Text
                    style={[
                      textStyle,
                      {
                        maxWidth: Dimensions.get('window').width - 100,
                      },
                    ]}>
                    {msg}
                  </Text>
                )
              : msg,
          );
        } else {
          const msg = res?.response?.data?.statuses[0]?.error;
          toast.error(msg || 'close position error');
          Sentry.captureException(
            new Error(
              'PERPS close position noFills' +
                'params: ' +
                JSON.stringify(params) +
                'res: ' +
                JSON.stringify(res),
            ),
          );
          return null;
        }
      } catch (e: any) {
        const isExpired = await judgeIsUserAgentIsExpired(e?.message || '');
        if (isExpired) {
          return null;
        }
        console.error('close position error', e);
        toast.error(e?.message || 'close position error');
        Sentry.captureException(
          new Error(
            'PERPS close position error' +
              'params: ' +
              JSON.stringify(params) +
              'error: ' +
              JSON.stringify(e),
          ),
        );
        return null;
      }
    },
  );

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

  const onRefresh = useMemoizedFn(() => {
    if (isLogin) {
      refreshData();
    }
    fetchMarketData(false);
  });

  return (
    <>
      <NormalScreenContainer2024 type={isLight ? 'bg0' : 'bg1'}>
        {!hasPermission ? <PerpsRegionAlert /> : null}
        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={onRefresh} />
          }>
          <PerpsAccountCard
            isLogin={isLogin}
            accountSummary={accountSummary}
            positionAndOpenOrders={positionAndOpenOrders}
          />
          <PerpsPositionSection
            positionAndOpenOrders={positionAndOpenOrders}
            marketDataMap={marketDataMap}
            onClosePosition={position => {
              setClosePosition(position);
              setClosePositionVisible(true);
            }}
          />
          <PerpsMarketSection marketData={marketData} />
          {isLogin ? (
            <PerpsHistorySection
              marketDataMap={marketDataMap}
              historyList={homeHistoryList}
            />
          ) : null}
          <PerpsIntro />
        </ScrollView>
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
        onDeposit={async (txs, amount, cacheBridgeHistory) => {
          try {
            await handleDeposit(txs, amount, cacheBridgeHistory);
          } catch (e) {
            console.error(e);
          }
          // await sleep(5000);
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
      {closePosition && (
        <PerpsClosePositionPopup
          visible={closePositionVisible}
          coin={closePosition?.coin}
          providerFee={perpFee}
          direction={Number(closePosition.szi || 0) > 0 ? 'Long' : 'Short'}
          positionSize={Math.abs(Number(closePosition.szi || 0)).toString()}
          pnl={Number(closePosition.unrealizedPnl || 0)}
          onCancel={() => setClosePositionVisible(false)}
          onConfirm={() => {
            setClosePositionVisible(false);
          }}
          handleClosePosition={async () => {
            await handleClosePosition({
              coin: closePosition.coin,
              size: Math.abs(Number(closePosition.szi || 0)).toString() || '0',
              direction: Number(closePosition.szi || 0) > 0 ? 'Long' : 'Short',
              price: closePosition.entryPx || '0',
            });
          }}
        />
      )}
    </>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 56,
  },
}));
