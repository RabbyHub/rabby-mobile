import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  TouchableWithoutFeedback,
  ImageBackground,
} from 'react-native';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import LinearGradient from 'react-native-linear-gradient';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import RcPending from '@/assets2024/icons/home/pending.svg';
import RcIconOrangeArrow from '@/assets2024/icons/home/IconOrangeArrow.svg';
import { useTheme2024, useThemeStyles } from '@/hooks/theme';
import RcIconSmallArrow from '@/assets2024/icons/home/IconSmallArrow.svg';
import RcIconSmallWallet from '@/assets2024/icons/home/IconSmallWallet.svg';
import { RootNames, ScreenLayouts } from '@/constant/layout';
import TouchableView from '@/components/Touchable/TouchableView';
import { useAccounts, useCurrentAccount } from '@/hooks/account';
import {
  createGetStyles,
  createGetStyles2024,
  makeDebugBorder,
} from '@/utils/styles';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import RcIconSend from '@/assets2024/icons/home/IconSend.svg';
import RcIconReceive from '@/assets2024/icons/home/IconReceive.svg';
import RcIconSwap from '@/assets2024/icons/home/IconSwap.svg';
import RcIconBridge from '@/assets2024/icons/home/IconBridge.svg';
import RcIconHistory from '@/assets2024/icons/home/IconHistory.svg';
import RcIconApprovals from '@/assets2024/icons/home/IconApprovals.svg';
import RcIconGasAccount from '@/assets2024/icons/home/IconGasAccount.svg';
import RcIconDapps from '@/assets2024/icons/home/IconDapps.svg';
import RcIconEcosystem from '@/assets2024/icons/home/IconEcosystem.svg';
import RcIconPoints from '@/assets2024/icons/home/IconPoints.svg';
import { MultiHomeFeatTitle } from '@/constant/newStyle';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { CHAINS_ENUM } from '@debank/common';
import { useTranslation } from 'react-i18next';
import RcIconSetting from '@/assets2024/icons/common/IconSetting.svg';
import { splitNumberByStep } from '@/utils/number';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES as MODAL_NAMES2024 } from '@/components2024/GlobalBottomSheetModal/types';

const MENU_ARR = [
  {
    title: MultiHomeFeatTitle.Send,
    icon: RcIconSend,
  },
  {
    title: MultiHomeFeatTitle.Receive,
    icon: RcIconReceive,
  },
  {
    title: MultiHomeFeatTitle.Swap,
    icon: RcIconSwap,
  },
  {
    title: MultiHomeFeatTitle.Bridge,
    icon: RcIconBridge,
  },
  {
    title: MultiHomeFeatTitle.History,
    icon: RcIconHistory,
  },
  // {
  //   title: MultiHomeFeatTitle.Approvals,
  //   icon: RcIconApprovals,
  // },
  {
    title: MultiHomeFeatTitle.GasAccount,
    icon: RcIconGasAccount,
  },
  {
    title: MultiHomeFeatTitle.Dapps,
    icon: RcIconDapps,
  },
  {
    title: MultiHomeFeatTitle.Ecosystem,
    icon: RcIconEcosystem,
  },
  // {
  //   title: MultiHomeFeatTitle.Points,
  //   icon: RcIconPoints,
  // },
];

export function MultiAddressHomeHeader(): JSX.Element {
  const { navigation } = useSafeSetNavigationOptions();
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.headerBox}>
      <Text style={styles.balanceTextBox}>
        {t('page.nextComponent.multiAddressHome.totalBalance')}
      </Text>
      <TouchableWithoutFeedback
        onPress={() => {
          navigation.dispatch(
            StackActions.push(RootNames.StackRoot, {
              screen: RootNames.Settings,
              params: {},
            }),
          );
        }}>
        <RcIconSetting />
      </TouchableWithoutFeedback>
    </View>
  );
}

function MultiAddressHome(): JSX.Element {
  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();
  const { t } = useTranslation();
  const { styles, colors, colors2024 } = useTheme2024({ getStyle });
  const { accounts, fetchAccounts } = useAccounts({
    disableAutoFetch: false,
  });
  // todo  fetch pending tx list
  const pendingTxCount = 0;
  const spinValue = useRef(new Animated.Value(0)).current;
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useFocusEffect(
    useCallback(() => {
      fetchAccounts();
    }, [fetchAccounts]),
  );

  useEffect(() => {
    let animation;

    if (pendingTxCount) {
      animation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      animation.start();
    } else {
      spinValue.setValue(0);
      animation?.stop();
    }

    return () => {
      animation?.stop();
    };
  }, [pendingTxCount, spinValue]);

  const filterAccounts = React.useMemo(
    () =>
      [...accounts].filter(
        a => a.type !== KEYRING_CLASS.WATCH && a.type !== KEYRING_CLASS.GNOSIS,
      ),
    [accounts],
  );

  const totalBalanceUsd = useMemo(() => {
    const num = filterAccounts.reduce(
      (sum, item) => sum + (item.balance || 0),
      0,
    );
    return '$' + splitNumberByStep((num || 0).toFixed(2));
  }, [filterAccounts]);

  const handleClickMenu = useCallback(
    title => {
      switch (title) {
        case MultiHomeFeatTitle.Send:
          navigation.dispatch(
            StackActions.push(RootNames.StackTransaction, {
              screen: RootNames.Send,
              params: {},
            }),
          );
          break;
        case MultiHomeFeatTitle.Receive:
          const selectAddressModalId = createGlobalBottomSheetModal2024({
            name: MODAL_NAMES2024.SELECT_RECEIVE_ADDRESS,
            onDone: () => {
              removeGlobalBottomSheetModal2024(selectAddressModalId);
              const id = createGlobalBottomSheetModal({
                name: MODAL_NAMES.SELECT_SORTED_CHAIN,
                value: CHAINS_ENUM.ETH,
                onChange: (v: CHAINS_ENUM) => {
                  navigation.dispatch(
                    StackActions.push(RootNames.StackTransaction, {
                      screen: RootNames.Receive,
                      params: {
                        chainEnum: v,
                      },
                    }),
                  );
                  removeGlobalBottomSheetModal(id);
                },
                onCancel: () => {
                  removeGlobalBottomSheetModal(id);
                },
              });
            },
          });

          break;
        case MultiHomeFeatTitle.Swap:
          navigation.dispatch(
            StackActions.push(RootNames.StackTransaction, {
              screen: RootNames.Swap,
              params: {},
            }),
          );
          break;
        case MultiHomeFeatTitle.Bridge:
          navigation.dispatch(
            StackActions.push(RootNames.StackTransaction, {
              screen: RootNames.Bridge,
              params: {},
            }),
          );
          break;
        case MultiHomeFeatTitle.History:
          navigation.dispatch(
            StackActions.push(RootNames.StackTransaction, {
              screen: RootNames.History,
              params: {},
            }),
          );
          break;
        // case MultiHomeFeatTitle.Approvals:
        //   navigation.push(RootNames.StackTransaction, {
        //     screen: RootNames.Approvals,
        //   });
        //   break;
        case MultiHomeFeatTitle.GasAccount:
          navigation.dispatch(
            StackActions.push(RootNames.StackTransaction, {
              screen: RootNames.GasAccount,
              params: {},
            }),
          );
          break;
        case MultiHomeFeatTitle.Dapps:
          navigation.dispatch(
            StackActions.push(RootNames.StackRoot, {
              screen: RootNames.Dapps,
              params: {},
            }),
          );
          break;
        case MultiHomeFeatTitle.Ecosystem:
          // navigation.dispatch(
          //   StackActions.push(RootNames.StackRoot, {
          //     screen: RootNames.Dapps,
          //     params: {},
          //   }),
          // );
          break;

        default:
          break;
      }
    },
    [navigation],
  );

  return (
    <NormalScreenContainer
      noHeader
      overwriteStyle={{
        backgroundColor: colors2024['neutral-bg-1'],
      }}>
      <LinearGradient
        colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-2']]}
        locations={[0.2195, 0.3181]}
        start={{ x: 0.5, y: -0.2 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.rootScreenContainer}>
        <ImageBackground
          source={require('@/assets2024/icons/home/ImgBgHome.png')}
          resizeMode="cover"
          style={styles.bgImage}
        />
        <View style={styles.paddingContainer}>
          <MultiAddressHomeHeader />
          <View style={styles.balanceBox}>
            <Text style={styles.usdText}>
              {/* {(balanceLoading && !balanceFromCache) ||
          balance === null ||
          (balanceFromCache && balance === 0) ||
          balanceUpdating ? (
            <Skeleton width={140} height={38} />
          ) : ( */}
              {totalBalanceUsd}
              {/* )} */}
            </Text>
            <TouchableView
              style={styles.accountBg}
              onPress={() => {
                navigation.dispatch(
                  StackActions.push(RootNames.StackAddress, {
                    screen: RootNames.AddressList,
                    params: {},
                  }),
                );
              }}>
              <RcIconSmallWallet />
              <Text style={styles.accountText}>{filterAccounts.length}</Text>
              <RcIconSmallArrow />
            </TouchableView>
          </View>
          <View style={styles.menuHeader}>
            <Text style={styles.headerText}>
              {t('page.nextComponent.multiAddressHome.services')}
            </Text>
            {Boolean(pendingTxCount) && (
              <View style={styles.pendingContainer}>
                <Animated.View
                  style={{
                    transform: [{ rotate: spin }],
                  }}>
                  <RcPending width={14} height={14} />
                </Animated.View>
                <Text style={styles.pendingText}>{`${pendingTxCount} ${t(
                  'page.bridge.Pending',
                )}`}</Text>
                <RcIconOrangeArrow />
              </View>
            )}
          </View>
          <View style={[styles.grid]}>
            {MENU_ARR.map((el, index) => {
              return (
                <TouchableView
                  style={styles.gridItem}
                  key={index}
                  onPress={e => handleClickMenu(el.title)}>
                  <el.icon />
                  <Text style={styles.gridText}>{el.title}</Text>
                </TouchableView>
              );
            })}
          </View>
        </View>
      </LinearGradient>
    </NormalScreenContainer>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  paddingContainer: {
    paddingHorizontal: 20,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  rootScreenContainer: {
    // ...makeDebugBorder(),
    // paddingHorizontal: 20,
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  headerBox: {
    height: ScreenLayouts.headerAreaHeight,
    // paddingLeft: 8,
    // paddingRight: 38,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // flex: 1,
    // backgroundColor: colors2024['neutral-title-1'],
  },
  balanceTextBox: {
    color: colors2024['neutral-title-1'],
    fontWeight: '800',
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'left',
    fontFamily: 'SF Pro Rounded',
  },
  balanceBox: {
    marginTop: 10,
    marginBottom: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usdText: {
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'left',
    color: colors2024['neutral-title-1'],
    lineHeight: 42,
    fontFamily: 'SF Pro Rounded',
  },
  accountBg: {
    padding: 8,
    paddingLeft: 14,
    borderRadius: 94,
    backgroundColor: colors2024['brand-default'],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
  menuHeader: {
    height: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 4,
    marginVertical: 12,
  },
  gridText: {
    color: colors2024['neutral-body'],
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'left',
    fontFamily: 'SF Pro Rounded',
  },
  headerText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'left',
    fontFamily: 'SF Pro Rounded',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 8,
    gap: 8,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  gridItem: {
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors2024['neutral-bg-1'],
    width: '48%',
    minWidth: 0,
    borderRadius: 12,
    flexShrink: 0,
    padding: 20,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    height: 100,
    gap: 12,
  },
  pendingContainer: {
    flexDirection: 'row',
    borderRadius: 100,
    alignItems: 'center',
    backgroundColor: colors2024['orange-light-4'],
    borderColor: colors2024['orange-disable'],
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    gap: 0,
  },
  pendingText: {
    marginLeft: 2,
    color: colors2024['orange-default'],
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
}));

export default MultiAddressHome;
