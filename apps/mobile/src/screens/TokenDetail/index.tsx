/* eslint-disable react-native/no-inline-styles */
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { openapi } from '@/core/request';
import { useTheme2024 } from '@/hooks/theme';
import { AbstractProject } from '@/screens/Home/types';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { createGetStyles2024 } from '@/utils/styles';
import { abstractTokenToTokenItem } from '@/utils/token';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { useRequest } from 'ahooks';
import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageBackground, Platform, Pressable, Text, View } from 'react-native';
import { TokenDetailHeaderArea } from './components/HeaderArea';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useTriggerTagAssets } from '../Home/hooks/refresh';
import { useTriggerHomeBalanceUpdate } from '@/hooks/useCurrentBalance';
import { formatPrice } from '@/utils/number';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils/src/types';
import { GetRootScreenNavigationProps } from '@/navigation-type';
import { TokenDetailHistoryList } from './components/HistoryList';
import { isFromBackAtom } from '../Swap/hooks/atom';
import BalanceOverview from './components/BalanceOverview';
import { useSingleTokenBalance } from './hook';
import { RootNames } from '@/constant/layout';
import { navigateDeprecated } from '@/utils/navigation';
import { RightMore } from './components/RightMore';
import { useSetAtom } from 'jotai';
import { TokenDetailBottomBtns } from './components/BottomBtns';
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import {
  ScreenSceneAccountProvider,
  useSceneAccountInfo,
  useSwitchSceneCurrentAccount,
} from '@/hooks/accountsSwitcher';
import { AccountSwitcher } from './components/InScreenSwitch';
import RcIconRightArrowCC from '@/assets2024/icons/copyTrading/IconRrightArrowCC.svg';

const isAndroid = Platform.OS === 'android';

export type TokenFromAddressItem = {
  address: string;
  amountStr: string;
  amount: number;
  type: KEYRING_TYPE;
  aliasName: string;
};

export type RelatedDeFiType = AbstractProject & {
  amount: number;
  address: string;
};

const TokenDetailContent = () => {
  const route =
    useRoute<GetRootScreenNavigationProps<'TokenDetail'>['route']>();
  const { token, account, tokenSelectType } = route.params || {};

  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });
  const { t } = useTranslation();

  const setIsFromBack = useSetAtom(isFromBackAtom);
  const { safeOffHeader } = useSafeSizes();
  const { safeOffBottom } = useSafeSizes();

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'TokenDetail',
  });
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  useEffect(() => {
    if (account) {
      switchSceneCurrentAccount('TokenDetail', account);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [acceptSceneAccount, setAcceptSceneAccount] = React.useState(false);
  const prevSceneAddrRef = React.useRef<string | undefined>(undefined);
  useEffect(() => {
    const currAddr = currentAccount?.address;
    if (
      prevSceneAddrRef.current !== undefined &&
      prevSceneAddrRef.current !== currAddr
    ) {
      setAcceptSceneAccount(true);
    }
    prevSceneAddrRef.current = currAddr;
  }, [currentAccount?.address]);

  const effectiveAccount = acceptSceneAccount
    ? currentAccount
    : account || currentAccount;

  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const { data: baseTokenInfo, refreshAsync: refreshBaseTokenInfo } =
    useRequest(
      async () => {
        const res = await openapi.getToken(
          effectiveAccount?.address!,
          token.chain,
          token._tokenId,
        );
        return ensureAbstractPortfolioToken({
          ...abstractTokenToTokenItem(token),
          amount: res?.amount,
          price_24h_change: res?.price_24h_change,
          usd_value: res?.usd_value,
          price: res?.price,
        });
      },
      {
        refreshDeps: [token.chain, token._tokenId, effectiveAccount?.address],
      },
    );

  const { triggerUpdate } = useTriggerHomeBalanceUpdate();
  const { tokenRefresh, singleTokenRefresh } = useTriggerTagAssets();

  const refreshTag = useCallback(() => {
    singleTokenRefresh();
    tokenRefresh();
  }, [singleTokenRefresh, tokenRefresh]);

  const getHeaderTitle = useCallback(() => {
    return (
      <TokenDetailHeaderArea
        style={{ marginLeft: -3 }}
        tokenSize={49}
        chainSize={20}
        borderChain
        key={effectiveAccount?.address}
        token={token}
      />
    );
  }, [effectiveAccount?.address, token]);

  const handleOpenTokenMarketInfo = useCallback(() => {
    navigateDeprecated(RootNames.TokenMarketInfo, {
      ...route.params,
      token: baseTokenInfo || token,
      account: effectiveAccount,
    });
  }, [baseTokenInfo, effectiveAccount, route.params, token]);

  const getHeaderRight = useCallback(() => {
    return (
      <RightMore
        token={token}
        triggerUpdate={triggerUpdate}
        isMultiAddress={false}
        refreshTags={refreshTag}
        unHold={false}
      />
    );
  }, [token, triggerUpdate, refreshTag]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        // 页面失焦（返回/左滑/点击返回按钮）时统一副作用
        setIsFromBack(true);
      };
    }, [setIsFromBack]),
  );

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
      headerRight: getHeaderRight,
      headerTitleAlign: 'left',
    });
  }, [setNavigationOptions, getHeaderRight, getHeaderTitle]);

  const { amountSum, usdValue, percentChange, isLoss, is24hNoChange, price } =
    useSingleTokenBalance({
      token: baseTokenInfo || token,
    });

  const onRefresh = useCallback(async () => {
    refreshBaseTokenInfo();
  }, [refreshBaseTokenInfo]);

  if (!effectiveAccount?.address) {
    return null;
  }

  return (
    <NormalScreenContainer2024
      type="bg1"
      overwriteStyle={styles.rootScreenContainer}>
      <ImageBackground
        source={
          !isLoss
            ? require('@/assets2024/singleHome/up.png')
            : require('@/assets2024/singleHome/loss.png')
        }
        resizeMode="cover"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: safeOffHeader + 120,
        }}
      />

      <View style={styles.balanceOverviewContainer}>
        <AccountSwitcher forScene="TokenDetail" disableSwitch={false} />
        <View style={styles.balanceOverviewContent}>
          <BalanceOverview usdValue={usdValue} amount={amountSum} />
          {!baseTokenInfo ? null : (
            <Pressable
              style={[
                styles.floatingBarContent,
                isLoss ? styles.lossShadow : styles.upShadow,
                {
                  borderColor: is24hNoChange
                    ? colors2024['neutral-secondary']
                    : isLoss
                    ? colors2024['red-disable']
                    : colors2024['green-disable'],
                  backgroundColor: is24hNoChange
                    ? colors2024['neutral-bg-1']
                    : isLoss
                    ? colors2024['red-light-1']
                    : colors2024['green-light-4'],
                },
              ]}
              onPress={handleOpenTokenMarketInfo}>
              <Text style={styles.floatBalanceTitle}>
                {t('page.tokenDetail.guideToMarketData')}
              </Text>
              <View style={styles.floatBalanceContainer}>
                <Text
                  style={[
                    styles.floatPriceChange,
                    {
                      color: is24hNoChange
                        ? colors2024['neutral-body']
                        : isLoss
                        ? colors2024['red-default']
                        : colors2024['green-default'],
                    },
                  ]}>
                  ${formatPrice(price)}(
                  {is24hNoChange ? '0.0%' : isLoss ? '-' : '+'}
                  {percentChange})
                </Text>
                <RcIconRightArrowCC
                  width={16}
                  height={16}
                  color={
                    is24hNoChange
                      ? colors2024['neutral-body']
                      : isLoss
                      ? colors2024['red-default']
                      : colors2024['green-default']
                  }
                />
              </View>
            </Pressable>
          )}
        </View>
      </View>
      <TokenDetailHistoryList
        onRefresh={onRefresh}
        finalAccount={effectiveAccount}
        token={token}
      />
      <View style={{ height: isAndroid ? 220 + safeOffBottom : 56 }} />
      <View style={styles.bottomContainer}>
        <TokenDetailBottomBtns
          token={token}
          finalAccount={effectiveAccount}
          tokenSelectType={tokenSelectType}
        />
      </View>
      <AccountSwitcherModal token={token} forScene="TokenDetail" inScreen />
    </NormalScreenContainer2024>
  );
};

export const TokenDetailScreen = () => {
  const { sceneCurrentAccountDepKey } = useSceneAccountInfo({
    forScene: 'TokenDetail',
  });
  return (
    <ScreenSceneAccountProvider
      value={{
        forScene: 'TokenDetail',
        ofScreen: 'TokenDetail',
        sceneScreenRenderId: `${sceneCurrentAccountDepKey}-TokenDetail`,
      }}>
      <TokenDetailContent />
    </ScreenSceneAccountProvider>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    rootScreenContainer: {
      backgroundColor: isLight
        ? colors2024['neutral-bg-0']
        : colors2024['neutral-bg-1'],
      paddingBottom: 20,
    },
    balanceOverviewContainer: {
      paddingLeft: 23,
      paddingRight: 16,
      marginBottom: 24,
    },
    bottomContainer: {
      width: '100%',
      height: 116,
      backgroundColor: colors2024['neutral-bg-1'],
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    balanceOverviewContent: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    floatingBarContent: {
      flexDirection: 'column',
      gap: 4,
      borderWidth: 1,
      borderColor: colors2024['green-default'],
      backgroundColor: colors2024['green-light-4'],
      padding: 8,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderBottomRightRadius: 2,
    },
    upShadow: {
      ...Platform.select({
        ios: {
          shadowColor: 'rgb(88, 198, 105)',
          shadowOffset: {
            width: 0,
            height: 6,
          },
          shadowOpacity: 0.04,
          shadowRadius: 29,
        },
      }),
    },
    lossShadow: {
      ...Platform.select({
        ios: {
          shadowColor: 'rgb(255, 69, 58)',
          shadowOffset: {
            width: 0,
            height: 6,
          },
          shadowOpacity: 0.04,
          shadowRadius: 29,
        },
      }),
    },
    floatBalanceTitle: {
      color: colors2024['neutral-foot'],
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
      fontFamily: 'SF Pro Rounded',
    },
    floatBalanceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    floatPrice: {
      color: colors2024['neutral-title-1'],
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
    floatPriceChange: {
      color: colors2024['neutral-title-1'],
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '800',
      fontFamily: 'SF Pro Rounded',
    },
  };
});
