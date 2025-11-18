import { StackActions } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import usePrevious from 'react-use/lib/usePrevious';

import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDevOnlyStyle } from '@/utils/styles';

import useAccountsBalance, {
  balanceAccountType,
} from '@/hooks/useAccountsBalance';
import { matomoRequestEvent } from '@/utils/analytics';

import RcIconSmallArrowCC from '@/assets2024/icons/home/IconSmallArrowCC.svg';
import RcIconSmallWalletCC from '@/assets2024/icons/home/IconSmallWalletCC.svg';

import { BlurShadowView } from '@/components2024/BluerShadow';
import { Card } from '@/components2024/Card';
import { GlobalWarning } from '@/components2024/GlobalWarning/Warining';
import { HOME_REFRESH_INTERVAL } from '@/constant/home';
import { usePinnedAccountList } from '@/hooks/account';
import { useCurrency } from '@/hooks/useCurrency';
import { formatSmallCurrencyValue } from '@/hooks/useCurve';
import { useGlobalStatus } from '@/hooks/useGlobalStatus';
import { useMulti24hBalance } from '@/hooks/use24hBalance';
import { Skeleton } from '@rneui/base';
import { sortBy } from 'lodash';
import RNLinearGradient from 'react-native-linear-gradient';
import { LoadingLinear } from '../../TokenDetail/components/TokenPriceChart/LoadingLinear';
import { useHideBalance } from '../hooks/useHideBalance';
import { HomeAddressItem } from './HomeAddressItem';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { LocalWebView } from '@/components/WebView/LocalWebView/LocalWebView';
import { IS_IOS } from '@/core/native/utils';
import { useMeasureLayoutForHomeGuidanceMultipleTabs } from '@/components2024/Animations/HomeGuidanceMultipleTabs';

export function MultiAddressHomeHeader(
  props: {
    data: ReturnType<typeof useMulti24hBalance>['combineData'];
    loading: boolean;
    loadingNewCurve: boolean;
    onRefresh?: () => void;
    balanceAccounts?: balanceAccountType[];
  } & RNViewProps,
): JSX.Element {
  const { loading, data, loadingNewCurve, style, onRefresh, balanceAccounts } =
    props;
  const { navigation } = useSafeSetNavigationOptions();
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { isDisConnect } = useGlobalStatus();
  const { currency, formatCurrentCurrency } = useCurrency();

  const pinnedAccountList = usePinnedAccountList();
  const [hideType] = useHideBalance();

  const { multi24hBalance } = useMulti24hBalance(
    pinnedAccountList.map(item => item.address),
    true,
  );

  const addressListData = useMemo(() => {
    return sortBy(
      pinnedAccountList.map(item => {
        const address24hBalanceData =
          multi24hBalance[item.address.toLowerCase()]?.data;
        const hasChangeData = address24hBalanceData;
        const balanceAccount = balanceAccounts?.find(acc =>
          isSameAddress(acc.address, item.address),
        );
        const assetsChange =
          (balanceAccount?.evmBalance || 0) -
          address24hBalanceData?.total_usd_value;
        let changePercent =
          address24hBalanceData?.total_usd_value !== 0
            ? `${Math.abs(
                (assetsChange * 100) / address24hBalanceData?.total_usd_value,
              ).toFixed(2)}%`
            : `${balanceAccount?.evmBalance === 0 ? '0' : '100.00'}%`;

        return {
          ...item,
          balance: balanceAccount?.balance || item.balance || 0,
          evmBalance: balanceAccount?.evmBalance || item.evmBalance || 0,
          changePercent: hasChangeData ? changePercent : undefined,
          isLoss: hasChangeData ? assetsChange < 0 : undefined,
        };
      }),
      item => -(item.balance || 0),
    ).slice(0, 3);
  }, [pinnedAccountList, multi24hBalance, balanceAccounts]);

  const { accountsLength } = useAccountsBalance({
    cacheTime: HOME_REFRESH_INTERVAL, // 5 minutes
    accountsNoUnique: true, // balanceAccounts has filter same address accounts
  });
  const [couldRenderLocalWebView, setCouldRenderLocalWebView] = useState(false);

  const percentChange = useMemo(() => {
    return `${data.isLoss ? '-' : '+'}${data.changePercent}(${
      data.isLoss ? '-' : '+'
    }${formatCurrentCurrency(Math.abs(data.rawChange))})`;
  }, [data.changePercent, data.isLoss, data.rawChange, formatCurrentCurrency]);

  const gasketWebViewRef = useRef<LocalWebView>(null);

  const previousLoading = usePrevious(loading);
  useEffect(() => {
    if (data.isLoss) return;
    if (!loading && previousLoading) {
      gasketWebViewRef.current?.sendMessage?.({
        type: 'GASKETVIEW:TOGGLE_LOADING',
        info: {
          loading: previousLoading,
        },
      });
    }
  }, [data.isLoss, loading, previousLoading]);

  const { doMeasure } = useMeasureLayoutForHomeGuidanceMultipleTabs();

  return (
    <View style={style}>
      <GlobalWarning
        hasError={isDisConnect}
        description={t('component.globalWarning.networkError.globalDesc')}
        style={styles.globalWarning}
        onRefresh={() => {
          onRefresh?.();
        }}
      />
      <BlurShadowView
        isLight={isLight}
        viewTypeOnNoShadow={'view'}
        viewProps={{
          style: [styles.curveBoxWrapper, { minHeight: 100 }],
          onLayout: () => {
            doMeasure();
          },
        }}>
        <View
          pointerEvents="none"
          style={[
            styles.localWebViewWrapper,
            couldRenderLocalWebView ? styles.localWebViewWrapperShow : {},
          ]}>
          {/* TODO: REVERT THIS */}
          {/* <LocalWebView
            ref={gasketWebViewRef}
            style={{
              minWidth: Dimensions.get('window').width - 15 * 2,
              minHeight: 100,
              marginHorizontal: 'auto',
              backgroundColor: 'transparent',
            }}
            entryPath={'/pages/gasket-blurview.html'}
            webviewSize={{
              width: Dimensions.get('window').width - 15 * 2,
            }}
          /> */}
        </View>
        <RNLinearGradient
          colors={
            isLight
              ? ['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0.6)']
              : ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']
          }
          style={[
            styles.curveBox,
            loading && styles.curveBoxLoading,
            {
              position: 'relative',
            },
            !isLight && { borderWidth: 0 },
            {},
          ]}
          onLayout={() => {
            if (IS_IOS) {
              setTimeout(() => setCouldRenderLocalWebView(true), 250);
            } else {
              setCouldRenderLocalWebView(true);
            }
          }}>
          <Card
            style={[styles.curveCard, styles.shadowView]}
            onPress={() => {
              navigation.dispatch(
                StackActions.push(RootNames.StackAddress, {
                  screen: RootNames.AddressAssetsOverview,
                  params: {},
                }),
              );
              matomoRequestEvent({
                category: 'Click_Header',
                action: 'Click_Address',
              });
            }}>
            <RNLinearGradient
              colors={
                isLight
                  ? ['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0.6)']
                  : ['rgba(0, 0, 0, 0.40)', 'rgba(0, 0, 0, 0.10)']
              }
              start={isLight ? { x: 0.25, y: 0.5 } : { x: 0.02, y: 1.04 }}
              end={isLight ? { x: 0.75, y: 0.5 } : { x: 1, y: 0.1 }}
              style={[
                StyleSheet.absoluteFill,
                !isLight && {
                  borderWidth: 2,
                  borderRadius: styles.curveBox['borderRadius'] || 20,
                  borderColor: 'rgba(37, 38, 40, 1)',
                },
              ]}
            />
            <View style={styles.curveCardInner}>
              <View style={styles.curveContainer}>
                <View style={styles.curveInnerLine}>
                  {loadingNewCurve ? (
                    <Skeleton
                      width={181}
                      height={44}
                      style={styles.skeleton}
                      LinearGradientComponent={LoadingLinear}
                    />
                  ) : hideType === 'HIDE' ? (
                    <Text style={styles.netWorth}>******</Text>
                  ) : (
                    <Text
                      style={[
                        styles.netWorth,
                        hideType === 'HALF_HIDE' ? styles.balanceOpacity : null,
                      ]}>
                      {formatSmallCurrencyValue(data.rawNetWorth, {
                        currency,
                      })}
                    </Text>
                  )}
                  <View style={[styles.accountBg]}>
                    <RcIconSmallWalletCC
                      color={colors2024['neutral-title-1']}
                    />
                    <Text style={styles.accountText}>
                      {accountsLength >= 10 ? '10' : accountsLength}
                    </Text>
                    <RcIconSmallArrowCC color={colors2024['neutral-title-1']} />
                  </View>
                </View>
                {loadingNewCurve ? (
                  <Skeleton
                    width={100}
                    height={22}
                    style={styles.skeleton}
                    LinearGradientComponent={LoadingLinear}
                  />
                ) : (
                  <View style={styles.changeSection}>
                    {hideType === 'HIDE' ? (
                      <Text style={styles.changePercent}>***</Text>
                    ) : (
                      <Text
                        style={[
                          styles.changePercent,
                          hideType === 'HALF_HIDE'
                            ? styles.balanceOpacity
                            : null,
                          {
                            color: data.isLoss
                              ? colors2024['red-default']
                              : colors2024['green-default'],
                          },
                        ]}>
                        {percentChange}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>
            {addressListData?.length ? (
              <View
                style={[
                  styles.accountList,
                  hideType === 'HALF_HIDE' ? styles.addressOpacity : null,
                ]}>
                {addressListData?.map(item => {
                  return (
                    <HomeAddressItem
                      hideType={hideType}
                      account={item}
                      key={`${item.type}-${item.address}`}
                      isLoss={item.isLoss}
                      changePercent={item.changePercent}
                    />
                  );
                })}
              </View>
            ) : null}
            {hideType === 'HALF_HIDE' ? (
              <View style={styles.accountCardMask}>
                {/* {Platform.OS === 'ios' ? (
                    <BlurView
                      style={styles.accountCardMaskBlur}
                      blurAmount={1.5}
                      blurType={isLight ? 'light' : 'dark'}
                      reducedTransparencyFallbackColor="white"
                    />
                  ) : null} */}
              </View>
            ) : null}
          </Card>
        </RNLinearGradient>
      </BlurShadowView>
      {/* gradient-border  */}
      {/* <ConicViewSample /> */}
    </View>
  );
}

const SIZES = {
  cardLayoutPaddingHorizontal: 15 /* ITEM_LAYOUT_PADDING_HORIZONTAL */,
  cardContentRadius: 20,
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  screenContainer: {
    paddingTop: 64,
  },
  paddingContainer: {
    paddingHorizontal: 0,
    flex: 1,
    flexGrow: 1,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },

  usdText: {
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'left',
    color: colors2024['neutral-title-1'],
    lineHeight: 42,
    fontFamily: 'SF Pro Rounded',
  },

  accountBg: {
    minWidth: 74,
    padding: 8,
    paddingLeft: 11,
    borderRadius: 10,
    backgroundColor: colors2024['neutral-line'],
    shadowColor: colors2024['brand-light-1'],
    shadowOffset: { width: 0, height: 9.411 },
    shadowOpacity: 0.1,
    shadowRadius: 22.587,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
    // position: 'absolute',
    // top: 28,
    // right: 20,
    // elevation: 500,
  },
  accountCardMask: {
    position: 'absolute',
    left: 1,
    right: 1,
    bottom: 1,
    top: 1,
    zIndex: 10,
    pointerEvents: 'none',
    backgroundColor: isLight
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(0, 0, 0, 0.02)',
  },
  accountCardMaskBlur: {
    height: '100%',
    borderRadius: 20,
  },
  button: {
    height: 38,
  },
  accountText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'left',
    color: colors2024['neutral-title-1'],
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    paddingLeft: 6,
  },
  pinBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  curveBoxWrapper: {
    position: 'relative',
    marginTop: 12,
    paddingTop: 0,
    backgroundColor: 'transparent',
    // ...makeDebugBorder('red'),
    paddingHorizontal: SIZES.cardLayoutPaddingHorizontal,
    borderRadius: SIZES.cardContentRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  localWebViewWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: IS_IOS ? 1 : -1,
    marginHorizontal: isLight && IS_IOS ? 0 : SIZES.cardLayoutPaddingHorizontal,
    borderRadius: SIZES.cardContentRadius,
    display: 'none',
    // ...makeDebugBorder('yellow'),
  },
  localWebViewWrapperShow: {
    display: 'flex',
  },
  curveBoxWrapperLoading: {},
  curveBox: {
    ...makeDevOnlyStyle({
      // opacity: 0,
    }),
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingVertical: 0,
    padding: 0,
    borderWidth: IS_IOS ? 1 : 1,
    borderColor: 'transparent',
    borderRadius: 20,
    // ...makeDebugBorder(),
    width: '100%',
    alignItems: 'center',
  },
  curveBoxLoading: {},
  curveCard: {
    maxWidth: '100%',
    // flexDirection: 'row',
    // alignItems: 'center',
    // justifyContent: 'space-between',

    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 0,
    borderWidth: 0,
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-line'],
    backgroundColor: 'transparent',

    position: 'relative',
  },
  curveCardInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    // ...makeDebugBorder(),
  },
  shadowView: {
    ...Platform.select({
      ios: {
        shadowColor: colors2024['neutral-black'],
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 8,
      },
    }),
  },
  skeleton: {
    borderRadius: 8,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  curveContainer: {
    gap: 6,
    width: '100%',
    // ...makeDebugBorder('green')
  },
  curveInnerLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    // ...makeDebugBorder('yellow')
  },
  arrow: {
    width: 26,
    height: 26,
    borderRadius: 30,
  },
  changePercent: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
  },
  netWorth: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  changeSection: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
    alignItems: 'center',
  },
  changeTime: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    marginLeft: 4,
  },
  globalWarning: {
    marginHorizontal: 16,
    marginTop: 16,
    // marginBottom: -16,
  },

  accountList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    width: '100%',
    marginTop: 28,
    paddingHorizontal: 14,
  },

  balanceOpacity: {
    opacity: 0.2,
  },
  addressOpacity: {
    opacity: 0.3,
  },
  hidden: {
    display: 'none',
  },
}));
