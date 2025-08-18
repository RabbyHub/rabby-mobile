import { RcIconRightCC } from '@/assets/icons/common';
import {
  RcIconApproval,
  RcIconBridge,
  RcIconMore,
  RcIconQueue,
  RcIconReceive,
  RcIconSend,
  RcIconSwap,
} from '@/assets2024/singleHome';
import { BSheetModal } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { toast } from '@/components/Toast';
import TouchableView from '@/components/Touchable/TouchableView';
import {
  ALERT_HEIGHT,
  HEADER_TOP_AREA_HEIGHT,
  RootNames,
} from '@/constant/layout';
import { KeyringAccountWithAlias } from '@/hooks/account';
import useCachedValue from '@/hooks/common/useCachedValue';
import { useTheme2024 } from '@/hooks/theme';
import { formChartData } from '@/hooks/useCurve';
import { RootStackParamsList } from '@/navigation-type';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import {
  StackActions,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemoizedFn } from 'ahooks';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ImageBackground,
  Platform,
  StyleProp,
  Text,
  TextStyle,
  View,
} from 'react-native';
import { useApprovalAlert } from '../hooks/approvals';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import { useGnosisQueueTotalPending } from '@/hooks/gnosis/useGnosisQueueTotalPending';
import { HomeTopChart } from './HomeTopChart';
import { GlobalWarning } from '@/components2024/GlobalWarning/Warining';

type HomeProps = NativeStackScreenProps<RootStackParamsList>;

const MORE_SHEET_MODAL_SNAPPOINTS = (actionsNum: number) => [
  80 + 70 * actionsNum,
];

const isAndroid = Platform.OS === 'android';

export function BadgeText({
  count,
  style,
  isSuccess,
}: {
  count?: number;
  isSuccess?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const { styles } = useTheme2024({ getStyle: getStyles });

  if (!count) {
    return null;
  }

  if (isAndroid) {
    return (
      <Text
        style={[
          styles.badgeBg,
          count > 9 && styles.badgeBgNeedPaddingHorizontal,
          styles.badgeText,
          style,
          isSuccess && styles.successBgColor,
        ]}>
        {count > 99 ? '99+' : count}
      </Text>
    );
  }

  // TODO: on iOS, if count >= 1000, maybe some text would be cut due to screen edge.
  return (
    <View
      style={[
        styles.badgeBg,
        count > 9 && styles.badgeBgNeedPaddingHorizontal,
        style,
        isSuccess && styles.successBgColor,
      ]}>
      <Text style={[styles.badgeText, style]}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

export const HomeTopArea = ({
  currentAccount,
  onUpdateIsDecrease,
  curveData,
  isLoadingCurve,
  isDisConnnect,
  onRefresh,
}: {
  currentAccount?: KeyringAccountWithAlias | null;
  onUpdateIsDecrease?: (status: boolean) => void;
  curveData?: ReturnType<typeof formChartData>;
  isLoadingCurve: boolean;
  isDisConnnect: boolean;
  onRefresh: () => void;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const navigation = useNavigation<HomeProps['navigation']>();
  const moresheetModalRef = React.useRef<BottomSheetModal>(null);
  const { approvalRiskAlert, loadApprovalStatus } = useApprovalAlert({
    account: currentAccount,
  });
  const totalAlertCount = useMemo(() => approvalRiskAlert, [approvalRiskAlert]);

  const isGnosisKeyring = currentAccount?.type === KEYRING_TYPE.GnosisKeyring;
  const { total: gnosisTotal, refreshAsync } = useGnosisQueueTotalPending({
    address: isGnosisKeyring ? currentAccount?.address : undefined,
  });

  useFocusEffect(
    useMemoizedFn(() => {
      refreshAsync();
    }),
  );

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const { navigateToSendPolyScreen } = useSendRoutes();

  const bridgeItemAction = {
    key: 'Bridge',
    title: t('page.home.services.bridge'),
    Icon: RcIconBridge,
    onPress: async () => {
      if (!currentAccount) {
        return;
      }
      await switchSceneCurrentAccount('MakeTransactionAbout', currentAccount);
      navigation.push(RootNames.StackTransaction, {
        screen: RootNames.Bridge,
      });
    },
  };

  const actions: {
    title: string;
    key: string;
    Icon: any;
    onPress: () => void;
    disabled?: boolean;
    badge?: number;
    badgeStyle?: StyleProp<TextStyle>;
  }[] = [
    {
      key: 'Swap',
      title: t('page.home.services.swap'),
      Icon: RcIconSwap,
      onPress: async () => {
        if (!currentAccount) {
          return;
        }
        await switchSceneCurrentAccount('MakeTransactionAbout', currentAccount);
        navigation.push(RootNames.StackTransaction, {
          screen: RootNames.Swap,
        });
      },
    },
    {
      key: 'Send',
      title: t('page.home.services.send'),
      Icon: RcIconSend,
      onPress: async () => {
        if (!currentAccount) {
          return;
        }
        await switchSceneCurrentAccount('MakeTransactionAbout', currentAccount);
        navigateToSendPolyScreen(true);
      },
    },
    {
      key: 'Receive',
      title: t('page.home.services.receive'),
      Icon: RcIconReceive,
      onPress: async () => {
        if (!currentAccount) {
          return;
        }
        navigation.dispatch(
          StackActions.push(RootNames.StackTransaction, {
            screen: RootNames.Receive,
            params: {
              account: currentAccount,
            },
          }),
        );
      },
    },
    ...(isGnosisKeyring
      ? [
          {
            key: 'Queue',
            title: t('page.home.services.queue'),
            badge: gnosisTotal,
            Icon: RcIconQueue,
            onPress: () => {
              navigation.push(RootNames.StackTransaction, {
                screen: RootNames.GnosisTransactionQueue,
                params: {
                  account: currentAccount,
                },
              });
            },
            badgeStyle: {
              backgroundColor: colors2024['red-default'],
            },
          },
          {
            key: 'More',
            title: t('page.home.services.more'),
            Icon: RcIconMore,
            onPress: () => {
              loadApprovalStatus();
              moresheetModalRef.current?.present();
            },
            badge: totalAlertCount,
          },
        ]
      : [
          bridgeItemAction,
          {
            key: 'Approvals',
            title: t('page.home.services.approvals'),
            Icon: RcIconApproval,
            onPress: async () => {
              if (!currentAccount) {
                return;
              }
              navigation.push(RootNames.StackTransaction, {
                screen: RootNames.Approvals,
                params: {
                  account: currentAccount,
                },
              });
              moresheetModalRef.current?.dismiss();
            },
            badge:
              currentAccount?.type === KEYRING_TYPE.WatchAddressKeyring
                ? 0
                : approvalRiskAlert,
          },
        ]),
  ];

  const toastDisabledAction = useCallback(() => {
    toast.show(t('page.dashboard.assets.comingSoon'));
  }, [t]);

  const moreItems: {
    title: string;
    key: string;
    Icon: React.ComponentType<import('react-native-svg').SvgProps>;
    onPress: () => void;
    disabled?: boolean;
    badge?: number;
    badgeAlert?: boolean;
  }[] = [
    {
      title: 'Approvals',
      key: t('page.home.services.approvals'),
      Icon: RcIconApproval,
      onPress: () => {
        if (!currentAccount) {
          return;
        }
        navigation.push(RootNames.StackTransaction, {
          screen: RootNames.Approvals,
          params: {
            account: currentAccount,
          },
        });
        moresheetModalRef.current?.dismiss();
      },
      badge: approvalRiskAlert,
      badgeAlert: approvalRiskAlert > 0,
    },
    ...(isGnosisKeyring ? [bridgeItemAction] : []),
  ];

  const isDecrease = useCachedValue(curveData, 'isLoss');

  const topBg = React.useMemo(() => {
    if (isDecrease) {
      if (isLight) {
        return require('@/assets2024/singleHome/home-loss-bg-2.png');
      } else {
        return require('@/assets2024/singleHome/home-loss-dark-bg-2.png');
      }
    } else {
      if (isLight) {
        return require('@/assets2024/singleHome/home-profit-bg-2.png');
      } else {
        return require('@/assets2024/singleHome/home-profit-dark-bg-2.png');
      }
    }
  }, [isDecrease, isLight]);

  const pathColor = useMemo(
    () =>
      !curveData?.isLoss
        ? colors2024['green-default']
        : colors2024['red-default'],
    [colors2024, curveData?.isLoss],
  );

  useEffect(() => {
    if (isDecrease !== undefined) {
      onUpdateIsDecrease?.(isDecrease);
    }
  }, [isDecrease, onUpdateIsDecrease]);

  return (
    <>
      <View
        style={[
          styles.container,
          {
            height: HEADER_TOP_AREA_HEIGHT + (isDisConnnect ? ALERT_HEIGHT : 0),
          },
        ]}>
        <ImageBackground
          source={topBg}
          resizeMode="cover"
          // eslint-disable-next-line react-native/no-inline-styles
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 150,
          }}
        />

        <GlobalWarning
          hasError={isDisConnnect}
          description={t('component.globalWarning.networkError.globalDesc')}
          style={styles.globalWarning}
          onRefresh={onRefresh}
        />

        <HomeTopChart
          loading={isLoadingCurve}
          data={
            curveData || {
              list: [],
              netWorth: '',
              change: '',
              changePercent: '',
              isLoss: false,
              isEmptyAssets: false,
            }
          }
          pathColor={pathColor}
          isNoAssets={false}
          isOffline={false}
        />
        <View style={styles.group}>
          {actions.map(item => (
            <TouchableView
              style={[styles.action, !!item?.disabled && styles.disabledAction]}
              onPress={
                item.disabled
                  ? toastDisabledAction
                  : () => {
                      item.onPress();
                    }
              }
              key={item.key}>
              <View style={styles.actionIconWrapper}>
                <item.Icon style={styles.actionIcon} />
              </View>

              <View
                style={[
                  styles.actionBadgeWrapper,
                  item.key === 'Approvals' && styles.rightZero,
                ]}>
                {!!item.badge && item.badge > 0 && (
                  <BadgeText count={item.badge} style={item.badgeStyle} />
                )}
              </View>
              <View
                style={{
                  width: '100%',
                }}>
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: 72,
                    justifyContent: 'center',
                    alignItems: 'center',
                    transform: [
                      {
                        translateX:
                          -(72 - Number(styles.actionIconWrapper.width || 0)) /
                          2,
                      },
                    ],
                  }}>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[styles.actionText]}>
                    {item.title}
                  </Text>
                </View>
              </View>
            </TouchableView>
          ))}
        </View>
      </View>
      {/* </ImageBackground> */}

      <BSheetModal
        ref={moresheetModalRef}
        snapPoints={MORE_SHEET_MODAL_SNAPPOINTS(moreItems.length)}>
        <AutoLockView as="BottomSheetView" style={styles.list}>
          {moreItems.map(item => (
            <TouchableView
              style={[
                styles.item,
                styles.moreItem,
                !!item?.disabled && styles.disabledAction,
              ]}
              onPress={
                item.disabled
                  ? toastDisabledAction
                  : () => {
                      moresheetModalRef.current?.dismiss();
                      item.onPress();
                    }
              }
              key={item.key}>
              <View style={[styles.sheetModalItemLeft]}>
                <item.Icon style={styles.actionIcon} />
                <Text style={styles.itemText}>{item.title}</Text>
              </View>
              <View style={[styles.sheetModalItemRight]}>
                {item.badgeAlert && item.badge && item.badge > 0 && (
                  <BadgeText count={item.badge} />
                )}
                <RcIconRightCC style={styles.chevron} />
              </View>
            </TouchableView>
          ))}
        </AutoLockView>
      </BSheetModal>
    </>
  );
};

const BADGE_SIZE = 18;
const getStyles = createGetStyles2024(ctx => ({
  container: {
    position: 'relative',
    height: HEADER_TOP_AREA_HEIGHT,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  image: {
    flex: 1,
    justifyContent: 'center',
  },
  group: {
    marginTop: 11,
    justifyContent: 'space-between',
    flexDirection: 'row',
    paddingHorizontal: 24,
  },
  action: {
    gap: 4,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  disabledAction: {
    opacity: 0.6,
  },
  actionIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBadgeWrapper: {
    position: 'absolute',
    top: -4,
    right: -(BADGE_SIZE / 2),
    // ...makeDebugBorder(),
  },
  rightZero: {
    right: 0,
  },
  actionIcon: {
    width: 24,
    height: 24,
    shadowColor: 'rgba(112, 132, 255, 1)',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.12,
    shadowRadius: 11.6,
  },
  actionText: {
    color: ctx.colors2024['neutral-foot'],
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
  },

  list: {
    gap: 12,
    paddingTop: 16,
    paddingHorizontal: 20,
  },

  item: {
    height: 60,
    paddingHorizontal: 16,
    backgroundColor: ctx.colors2024['neutral-card-1'],
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  moreItem: {
    justifyContent: 'space-between',
  },
  sheetModalItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexShrink: 1,
    width: '100%',
  },
  itemText: {
    marginLeft: 12,
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '500',
  },
  sheetModalItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
    maxWidth: '50%',
    // ...makeDebugBorder(),
  },
  badgeBg: {
    backgroundColor: ctx.colors2024['red-default'],
    borderRadius: BADGE_SIZE,
    paddingVertical: 1,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    textAlign: 'center',
    marginRight: 4,
    lineHeight: BADGE_SIZE + 2,
    ...Platform.select({
      ios: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      },
    }),
  },
  badgeBgNeedPaddingHorizontal: {
    paddingHorizontal: 6,
  },
  successBgColor: {
    backgroundColor: ctx.colors2024['green-default'],
  },
  badgeText: {
    color: '#fff', // always white
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  chevron: {
    marginLeft: 'auto',
    width: 16,
    height: 16,
    color: ctx.colors2024['neutral-foot'],
  },
  opacityWrapper: {
    paddingHorizontal: 24,
    // backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  textBox: {
    marginTop: 0,
    // paddingTop: Platform.OS === 'android' ? 0 : 8,
  },
  usdText: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '900',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'left',
  },
  percent: {
    color: ctx.colors2024['green-default'],
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    fontStyle: 'normal',
    fontFamily: 'SF Pro Rounded',
  },
  decrease: {
    color: ctx.colors2024['red-default'],
  },
  zeroPercent: {
    color: ctx.colors2024['neutral-secondary'],
  },
  linear: {
    height: '100%',
  },
  skeleton: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
  },
  globalWarning: {
    marginHorizontal: 16,
    marginBottom: 13,
  },
}));
