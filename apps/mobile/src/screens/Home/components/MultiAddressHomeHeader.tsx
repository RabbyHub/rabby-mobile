import RcIconloading from '@/assets2024/icons/home/Iconloading.svg';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { StackActions } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';

import RcIconSetting from '@/assets2024/icons/common/IconSetting.svg';
import { ThemeColors2024 } from '@/constant/theme';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { useUpgradeInfo } from '@/hooks/version';
import { matomoRequestEvent } from '@/utils/analytics';
import { useTranslation } from 'react-i18next';

import RcIconSmallArrow from '@/assets2024/icons/home/IconSmallArrow.svg';
import RcIconSmallWallet from '@/assets2024/icons/home/IconSmallWallet.svg';
import RcIconEyeCC from '@/assets2024/icons/home/eye-cc.svg';
import RcIconEyeCloseCC from '@/assets2024/icons/home/eye-close-cc.svg';
import RcIconEyeHalfCloseCC from '@/assets2024/icons/home/eye-half-close-cc.svg';
import { FeedbackEntryOnHeader } from '@/components/Screenshot/FeedbackEntryOnHeader';
import { BlurShadowView } from '@/components2024/BluerShadow';
import { Card } from '@/components2024/Card';
import { GlobalWarning } from '@/components2024/GlobalWarning/Warining';
import {
  HOME_REFRESH_INTERVAL,
  ITEM_LAYOUT_PADDING_HORIZONTAL,
} from '@/constant/home';
import { usePinnedAccountList } from '@/hooks/account';
import { useCurrency } from '@/hooks/useCurrency';
import { formatSmallCurrencyValue, getChangeData } from '@/hooks/useCurve';
import { useGlobalStatus } from '@/hooks/useGlobalStatus';
import { useMultiCurve } from '@/hooks/useMultiCurve';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils/src/types';
import { BlurView } from '@react-native-community/blur';
import { Skeleton } from '@rneui/base';
import { useMemoizedFn } from 'ahooks';
import { sortBy } from 'lodash';
import LinearGradient from 'react-native-linear-gradient';
import { LoadingLinear } from '../../TokenDetail/components/TokenPriceChart/LoadingLinear';
import { useHideBalance } from '../hooks/useHideBalance';
import { HomeAddressItem } from './HomeAddressItem';

const HeaderHeight = 24;

export function MultiAddressHomeHeader(
  prop: {
    data: ReturnType<typeof useMultiCurve>['combineData'];
    loading: boolean;
    loadingNewCurve: boolean;
    onRefresh?: () => void;
  } & RNViewProps,
): JSX.Element {
  const { loading, data, loadingNewCurve, style, onRefresh } = prop;
  const { navigation } = useSafeSetNavigationOptions();
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const spinValue = useRef(new Animated.Value(0)).current;
  const { remoteVersion } = useUpgradeInfo();
  const { isDisConnect } = useGlobalStatus();
  const { currency, formatCurrentCurrency } = useCurrency();

  const pinnedAccountList = usePinnedAccountList();
  const [hideType, setHideType] = useHideBalance();
  const handleHideTypeChange = useMemoizedFn(() => {
    if (hideType === 'HALF_HIDE') {
      setHideType('HIDE');
    } else if (hideType === 'HIDE') {
      setHideType('SHOW');
    } else {
      setHideType('HALF_HIDE');
    }
  });

  const { multiTimeStamp } = useMultiCurve(
    pinnedAccountList.map(item => item.address),
    true,
  );

  const addressListData = useMemo(() => {
    return sortBy(
      pinnedAccountList
        .filter(
          item =>
            ![
              KEYRING_TYPE.GnosisKeyring,
              KEYRING_TYPE.WatchAddressKeyring,
              KEYRING_TYPE.WalletConnectKeyring,
            ].includes(item.type),
        )
        .map(item => {
          const hasChangeData = multiTimeStamp[
            item.address.toLowerCase()
          ]?.data?.some(i => i.usd_value !== 0);
          const chartData = getChangeData(
            multiTimeStamp[item.address.toLowerCase()]?.data || [],
            item.evmBalance,
            new Date().getTime(),
          );
          return {
            ...item,
            changePercent: hasChangeData ? chartData?.changePercent : undefined,
            isLoss: hasChangeData ? chartData?.isLoss : undefined,
          };
        }),
      item => -(item.balance || 0),
    ).slice(0, 3);
  }, [pinnedAccountList, multiTimeStamp]);

  const { accountsLength } = useAccountsBalance({
    cacheTime: HOME_REFRESH_INTERVAL, // 5 minutes
    accountsNoUnique: true, // balanceAccounts has filter same address accounts
  });

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const percentChange = useMemo(() => {
    return `${data.isLoss ? '-' : '+'}${data.changePercent}(${
      data.isLoss ? '-' : '+'
    }${formatCurrentCurrency(Math.abs(data.rawChange))})`;
  }, [data.changePercent, data.isLoss, data.rawChange, formatCurrentCurrency]);

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spinValue.resetAnimation();
    }
  }, [loading, spinValue]);

  return (
    <View style={style}>
      <View style={styles.headerBox}>
        <View style={styles.leftBox}>
          <Text style={styles.balanceTextBox}>
            {t('page.nextComponent.multiAddressHome.totalBalance')}
          </Text>
          <TouchableOpacity onPress={handleHideTypeChange}>
            {hideType === 'HALF_HIDE' ? (
              <RcIconEyeHalfCloseCC
                color={colors2024['neutral-title-1']}
                width={20}
                height={20}
              />
            ) : hideType === 'HIDE' ? (
              <RcIconEyeCloseCC
                color={colors2024['neutral-title-1']}
                width={20}
                height={20}
              />
            ) : (
              <RcIconEyeCC
                color={colors2024['neutral-title-1']}
                width={20}
                height={20}
              />
            )}
          </TouchableOpacity>
          <Animated.View
            style={{
              transform: [{ rotate: spin }],
            }}>
            {loading && <RcIconloading />}
          </Animated.View>
        </View>

        <View style={styles.rightArea}>
          <FeedbackEntryOnHeader style={styles.feedbackEntry} />
          <TouchableWithoutFeedback
            style={styles.settingEntry}
            onPress={() => {
              navigation.navigate(RootNames.StackSettings, {
                screen: RootNames.Settings,
                params: {},
              });

              matomoRequestEvent({
                category: 'Click_Header',
                action: 'Click_Setting',
              });
            }}>
            <RcIconSetting color={colors2024['neutral-foot']} />
            {remoteVersion.couldUpgrade && <View style={styles.redDot} />}
          </TouchableWithoutFeedback>
        </View>
      </View>

      <GlobalWarning
        hasError={isDisConnect}
        description={t('component.globalWarning.networkError.globalDesc')}
        style={styles.globalWarning}
        onRefresh={() => {
          onRefresh?.();
        }}
      />

      <View style={styles.curveBox}>
        <BlurShadowView isLight={isLight}>
          <LinearGradient
            colors={
              isLight
                ? ['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 1)']
                : ['rgba(37,38,40,1)', 'rgba(28,27,27,1)']
            }
            style={{
              padding: 1,
              borderRadius: 21,
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
              <LinearGradient
                colors={
                  isLight
                    ? ['rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0.4)']
                    : ['rgba(0, 0, 0, 0.6)', 'rgba(25, 26, 27, 0.3)']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.curveCardInner}>
                <View style={styles.curveContainer}>
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
                        hideType === 'HALF_HIDE' ? styles.opacity20 : null,
                      ]}>
                      {/* {data.netWorth} */}
                      {formatSmallCurrencyValue(data.rawNetWorth, {
                        currency,
                      })}
                    </Text>
                  )}
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
                            hideType === 'HALF_HIDE' ? styles.opacity20 : null,
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
              <View style={[styles.accountBg]}>
                <RcIconSmallWallet />
                <Text style={styles.accountText}>
                  {accountsLength >= 10 ? '10' : accountsLength}
                </Text>
                <RcIconSmallArrow />
              </View>
              {addressListData?.length ? (
                <View
                  style={[
                    styles.accountList,
                    hideType === 'HALF_HIDE' ? styles.opacity30 : null,
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
                  {Platform.OS === 'ios' ? (
                    <BlurView
                      style={styles.accountCardMaskBlur}
                      blurAmount={0.5}
                      blurType={isLight ? 'light' : 'dark'}
                      reducedTransparencyFallbackColor="white"
                    />
                  ) : null}
                </View>
              ) : null}
            </Card>
          </LinearGradient>
        </BlurShadowView>
      </View>
    </View>
  );
}

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
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors2024['red-default'],
    position: 'absolute',
    top: 0,
    right: 13,
  },

  headerBox: {
    height: HeaderHeight,
    // paddingLeft: 8,
    // paddingRight: 38,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL + 4,
    position: 'relative',
    // flex: 1,
    // backgroundColor: colors2024['neutral-title-1'],
  },
  leftBox: {
    height: HeaderHeight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  balanceTextBox: {
    // marginRight: 12,
    color: colors2024['neutral-title-1'],
    fontWeight: '900',
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'left',
    fontFamily: 'SF Pro Rounded',
  },
  balanceBox: {
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL + 4,
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rightArea: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // position: 'relative',
    // ...makeDebugBorder(),
  },
  feedbackEntry: {
    height: '100%',
    paddingRight: 6,
    // ...makeDebugBorder(),
  },
  settingEntry: {
    marginRight: -ITEM_LAYOUT_PADDING_HORIZONTAL,
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 6,
    paddingRight: ITEM_LAYOUT_PADDING_HORIZONTAL,
    position: 'relative',
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
    backgroundColor: isLight
      ? ThemeColors2024.dark['neutral-bg-1']
      : colors2024['brand-default'],
    shadowColor: colors2024['brand-light-1'],
    shadowOffset: { width: 0, height: 9.411 },
    shadowOpacity: 0.1,
    shadowRadius: 22.587,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
    position: 'absolute',
    top: 28,
    right: 20,
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
    color: colors2024['neutral-InvertHighlight'],
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
  pinBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  curveBox: {
    paddingHorizontal: 15,
    paddingTop: 12,
  },
  curveCard: {
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
    paddingRight: 80,
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
    marginBottom: -16,
  },

  accountList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    width: '100%',
    marginTop: 28,
    paddingHorizontal: 14,
  },

  opacity20: {
    opacity: 0.2,
  },
  opacity30: {
    opacity: 0.3,
  },
  hidden: {
    display: 'none',
  },
}));
