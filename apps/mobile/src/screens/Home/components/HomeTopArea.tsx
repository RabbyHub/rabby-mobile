import { RcIconRightCC } from '@/assets/icons/common';
import {
  RcIconSend,
  RcIconReceive,
  RcIconSwap,
  RcIconMore,
  RcIconApproval,
  RcIconGasTopUp,
  RcIconQueue,
  RcIconBridge,
} from '@/assets/icons/home';
import { BSheetModal } from '@/components';
import TouchableView from '@/components/Touchable/TouchableView';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useCallback, useMemo } from 'react';
import { Platform, StyleProp, Text, TextStyle, View } from 'react-native';
import { toast } from '@/components/Toast';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { CHAINS_ENUM } from '@/constant/chains';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApprovalAlert } from '../hooks/approvals';
import { useCurrentAccount } from '@/hooks/account';
import { useGnosisPendingTxs } from '@/hooks/gnosis/useGnosisPendingTxs';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useMemoizedFn } from 'ahooks';

type HomeProps = NativeStackScreenProps<RootStackParamsList>;

const MORE_SHEET_MODAL_SNAPPOINTS = [290];

const isAndroid = Platform.OS === 'android';
function BadgeText({
  count,
  style,
}: {
  count?: number;
  style?: StyleProp<TextStyle>;
}) {
  const { styles } = useThemeStyles(getStyles);

  if (!count) return null;

  if (isAndroid) {
    return (
      <Text
        style={[
          styles.badgeBg,
          count > 9 && styles.badgeBgNeedPaddingHorizontal,
          styles.badgeText,
          style,
        ]}>
        {count}
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
      ]}>
      <Text style={[styles.badgeText, style]}>{count}</Text>
    </View>
  );
}

export const HomeTopArea = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const navigation = useNavigation<HomeProps['navigation']>();
  const moresheetModalRef = React.useRef<BottomSheetModal>(null);
  const { approvalRiskAlert, loadApprovalStatus } = useApprovalAlert();
  // const approvalRiskAlert = 200;
  const totalAlertCount = useMemo(() => approvalRiskAlert, [approvalRiskAlert]);

  const { currentAccount } = useCurrentAccount();
  const isGnosisKeyring = currentAccount?.type === KEYRING_TYPE.GnosisKeyring;
  const { data: gnosisPendingTxs, refreshAsync } = useGnosisPendingTxs({
    address: isGnosisKeyring ? currentAccount?.address : undefined,
  });

  useFocusEffect(
    useMemoizedFn(() => {
      refreshAsync();
    }),
  );

  const actions: {
    title: string;
    Icon: any;
    onPress: () => void;
    disabled?: boolean;
    badge?: number;
    badgeStyle?: StyleProp<TextStyle>;
  }[] = [
    {
      title: 'Send',
      Icon: RcIconSend,
      onPress: () => {
        navigation.push(RootNames.StackTransaction, {
          screen: RootNames.Send,
          params: {
            // chain: v,
          },
        });
      },
    },
    {
      title: 'Receive',
      Icon: RcIconReceive,
      onPress: () => {
        const id = createGlobalBottomSheetModal({
          name: MODAL_NAMES.SELECT_SORTED_CHAIN,
          value: CHAINS_ENUM.ETH,
          onChange: (v: CHAINS_ENUM) => {
            navigation.push(RootNames.StackTransaction, {
              screen: RootNames.Receive,
              params: {
                chainEnum: v,
              },
            });
            removeGlobalBottomSheetModal(id);
          },
          onCancel: () => {
            removeGlobalBottomSheetModal(id);
          },
        });
      },
    },
    {
      title: 'Swap',
      Icon: RcIconSwap,
      onPress: () => {
        navigation.push(RootNames.StackTransaction, {
          screen: RootNames.Swap,
        });
      },
    },
    ...(isGnosisKeyring
      ? [
          {
            title: 'Queue',
            badge: gnosisPendingTxs?.total,
            Icon: RcIconQueue,
            onPress: () => {
              navigation.push(RootNames.StackTransaction, {
                screen: RootNames.GnosisTransactionQueue,
              });
            },
            badgeStyle: {
              backgroundColor: colors['blue-default'],
            },
          },
        ]
      : []),

    {
      title: 'More',
      Icon: RcIconMore,
      onPress: () => {
        loadApprovalStatus();
        moresheetModalRef.current?.present();
      },
      badge: totalAlertCount,
    },
  ];

  const toastDisabledAction = useCallback(() => {
    toast.show('Coming Soon :)');
  }, []);

  const moreItems: {
    title: string;
    Icon: any;
    onPress: () => void;
    disabled?: boolean;
    badge?: number;
    badgeAlert?: boolean;
  }[] = [
    {
      title: 'Bridge',
      Icon: RcIconBridge,
      onPress: () => {
        navigation.push(RootNames.StackTransaction, {
          screen: RootNames.Bridge,
        });
      },
    },
    {
      title: 'Approvals',
      Icon: RcIconApproval,
      onPress: () => {
        navigation.push(RootNames.StackTransaction, {
          screen: RootNames.Approvals,
        });
        moresheetModalRef.current?.dismiss();
      },
      badge: approvalRiskAlert,
      badgeAlert: approvalRiskAlert > 0,
    },
    {
      title: 'Gas Top Up',
      Icon: RcIconGasTopUp,
      onPress: () => {
        navigation.push(RootNames.StackTransaction, {
          screen: RootNames.GasTopUp,
        });
      },
    },
  ];

  return (
    <>
      {/* <ImageBackground
        source={require('@/assets/icons/home/bg.png')}
        resizeMode="contain"
        style={styles.image}> */}
      <View style={styles.container}>
        <View style={styles.group}>
          {actions.map(item => (
            <TouchableView
              style={[styles.action, !!item?.disabled && styles.disabledAction]}
              onPress={item.disabled ? toastDisabledAction : item.onPress}
              key={item.title}>
              <View style={styles.actionIconWrapper}>
                <item.Icon style={styles.actionIcon} />
              </View>

              <View style={styles.actionBadgeWrapper}>
                {!!item.badge && item.badge > 0 && (
                  <BadgeText count={item.badge} style={item.badgeStyle} />
                )}
              </View>
              <Text
                style={[
                  styles.actionText,
                  {
                    fontSize: actions.length > 4 ? 13 : 14,
                  },
                ]}>
                {item.title}
              </Text>
            </TouchableView>
          ))}
        </View>
      </View>
      {/* </ImageBackground> */}

      <BSheetModal
        ref={moresheetModalRef}
        snapPoints={MORE_SHEET_MODAL_SNAPPOINTS}>
        <BottomSheetView style={styles.list}>
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
              key={item.title}>
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
        </BottomSheetView>
      </BSheetModal>
    </>
  );
};

const BADGE_SIZE = 18;
const getStyles = createGetStyles(colors => ({
  container: {
    padding: 20,
  },
  image: {
    flex: 1,
    justifyContent: 'center',
  },
  group: {
    marginTop: 98,
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
  action: {
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  disabledAction: {
    opacity: 0.6,
  },
  actionIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 44,
    backgroundColor: colors['neutral-card-2'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBadgeWrapper: {
    position: 'absolute',
    top: -4,
    right: -(BADGE_SIZE / 2),
    // ...makeDebugBorder(),
  },
  actionIcon: {
    width: 24,
    height: 24,
  },
  actionText: {
    color: colors['neutral-title-1'],
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },

  list: {
    gap: 12,
    paddingTop: 16,
    paddingHorizontal: 20,
  },

  item: {
    height: 60,
    paddingHorizontal: 16,
    backgroundColor: colors['neutral-card-2'],
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
    color: colors['neutral-title-1'],
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
    backgroundColor: colors['red-default'],
    borderRadius: BADGE_SIZE,
    paddingVertical: 1,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    textAlign: 'center',
    marginRight: 4,
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
  badgeText: {
    color: colors['neutral-title2'],
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  chevron: {
    marginLeft: 'auto',
    width: 16,
    height: 16,
    color: colors['neutral-foot'],
  },
}));
