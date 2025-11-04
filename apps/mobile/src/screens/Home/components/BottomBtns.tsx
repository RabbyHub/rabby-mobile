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
import { HEADER_TOP_AREA_HEIGHT, RootNames } from '@/constant/layout';
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
import { StyleProp, Text, TextStyle, View } from 'react-native';
import { useApprovalAlert } from '../hooks/approvals';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import { useGnosisQueueTotalPending } from '@/hooks/gnosis/useGnosisQueueTotalPending';
import { BadgeText } from './BadgeText';

type HomeProps = NativeStackScreenProps<RootStackParamsList>;

const MORE_SHEET_MODAL_SNAPPOINTS = (actionsNum: number) => [
  80 + 70 * actionsNum,
];

export const HomeTopArea = ({
  currentAccount,
  onUpdateIsDecrease,
  curveData,
}: {
  currentAccount?: KeyringAccountWithAlias | null;
  onUpdateIsDecrease?: (status: boolean) => void;
  curveData?: ReturnType<typeof formChartData>;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const navigation = useNavigation<HomeProps['navigation']>();
  const moresheetModalRef = React.useRef<BottomSheetModal>(null);
  const { approvalRiskAlert, loadApprovalStatus } = useApprovalAlert({
    account: currentAccount,
  });
  const totalAlertCount = useMemo(() => approvalRiskAlert, [approvalRiskAlert]);

  const isGnosisKeyring = currentAccount?.type === KEYRING_TYPE.GnosisKeyring;
  const { total: gnosisTotal, refreshAsync } = useGnosisQueueTotalPending({
    // address: isGnosisKeyring ? currentAccount?.address : undefined,
    address: undefined,
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

  useEffect(() => {
    if (isDecrease !== undefined) {
      onUpdateIsDecrease?.(isDecrease);
    }
  }, [isDecrease, onUpdateIsDecrease]);

  return (
    <>
      <View style={[styles.container]}>
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
  actionIcon: {
    width: 24,
    height: 24,
    shadowColor: 'rgba(112, 132, 255, 1)',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.12,
    shadowRadius: 11.6,
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
  chevron: {
    marginLeft: 'auto',
    width: 16,
    height: 16,
    color: ctx.colors2024['neutral-foot'],
  },
  list: {
    gap: 12,
    paddingTop: 16,
    paddingHorizontal: 20,
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
  actionText: {
    color: ctx.colors2024['neutral-foot'],
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
  },
  actionIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
