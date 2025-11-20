import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, Alert } from 'react-native';
import { RcArrowRightCC, RcIconCheckmarkCC } from '@/assets/icons/common';

import { AppBottomSheetModal } from '@/components';
import { useSheetModals } from '@/hooks/useSheetModal';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { atom, useAtom } from 'jotai';
import AutoLockView from '@/components/AutoLockView';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import {
  RcCountdown,
  RcLockWallet,
  RcManagePassword,
} from '@/assets/icons/settings';
import { DevTestItem, makeNoop, GeneralTestItem } from './testDevUtils';
import { useManagePasswordOnSettings } from '@/screens/ManagePassword/hooks';
import { requestLockWalletAndBackToUnlockScreen } from '@/hooks/navigation';
import { LastUnlockTimeLabel } from '../components/LockAbout';
import { APP_FEATURE_SWITCH } from '@/constant';
import { keyringService } from '@/core/services/shared';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';

const walletLockTestItemModalVisibleAtom = atom(false);
export function useWalletLockTestItemModalVisible() {
  const [walletLockTestItemModalVisible, setWalletTestItemModalVisible] =
    useAtom(walletLockTestItemModalVisibleAtom);

  return {
    walletLockTestItemModalVisible,
    setWalletTestItemModalVisible,
  };
}

const RcIconCheckmark = makeThemeIconFromCC(RcIconCheckmarkCC, 'neutral-body');

export default function WalletLockTestItemModal({
  onCancel,
}: RNViewProps & {
  onCancel?(): void;
}) {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { toggleShowSheetModal } = useSheetModals({
    cloudDriveTest: modalRef,
  });

  const {
    walletLockTestItemModalVisible: visible,
    setWalletTestItemModalVisible,
  } = useWalletLockTestItemModalVisible();

  useEffect(() => {
    toggleShowSheetModal('cloudDriveTest', visible || 'destroy');
  }, [visible, toggleShowSheetModal]);

  const { styles, colors } = useThemeStyles(getStyles);

  const handleCancel = useCallback(() => {
    setWalletTestItemModalVisible(false);
    onCancel?.();
  }, [setWalletTestItemModalVisible, onCancel]);

  const {
    hasSetupCustomPassword,
    openManagePasswordSheetModal,
    openResetPasswordAndKeyringSheetModal,
  } = useManagePasswordOnSettings();

  const Items = (() => {
    const list: DevTestItem[] = [
      {
        label: 'Lock Wallet',
        icon: <RcLockWallet style={styles.labelIcon} />,
        disabled: !hasSetupCustomPassword,
        onPress: () => {
          requestLockWalletAndBackToUnlockScreen();
        },
      },
      {
        label: hasSetupCustomPassword ? 'Clear Password' : 'Set Up Password',
        icon: <RcManagePassword style={styles.labelIcon} />,
        onPress: () => {
          openManagePasswordSheetModal();
        },
        visible: APP_FEATURE_SWITCH.customizePassword || hasSetupCustomPassword,
      },
      {
        label: 'Clear Password and Keyrings',
        icon: <RcManagePassword style={styles.labelIcon} />,
        disabled: !hasSetupCustomPassword,
        onPress: () => {
          openResetPasswordAndKeyringSheetModal();
        },
      },
      {
        label: 'Time Since Last Unlock',
        icon: <RcCountdown style={styles.labelIcon} />,
        // onPress: () => {},
        rightNode: (
          <Text>
            <LastUnlockTimeLabel />
          </Text>
        ),
      },
      {
        label: 'Check unencryptedKeyringData',
        icon: <RcIconCheckmark style={styles.labelIcon} />,
        onPress: async () => {
          const keyringData =
            await keyringService.DEV_GET_UNENCRYPTED_KEYRING_DATA();
          Alert.alert('Unencrypted Keyring Data', JSON.stringify(keyringData));
        },
      },
    ];

    return list.filter(item => item.visible !== false);
  })();

  const { safeSizes } = useSafeAndroidBottomSizes({
    sheetHeight: getFullHeight(Items.length),
    containerPaddingBottom: SIZES.containerPb,
  });

  return (
    <AppBottomSheetModal
      backgroundStyle={styles.sheet}
      ref={modalRef}
      index={0}
      snapPoints={[safeSizes.sheetHeight]}
      handleStyle={styles.handleStyle}
      onDismiss={handleCancel}
      enableContentPanningGesture={false}>
      <AutoLockView
        as="BottomSheetView"
        style={[
          styles.container,
          {
            paddingBottom: safeSizes.containerPaddingBottom,
          },
        ]}>
        <Text style={styles.title}>Test Wallet Lock</Text>
        <View style={styles.mainContainer}>
          {Items.map((item, idx) => {
            const itemKey = `testitem-${item.label}`;
            const rightNode =
              typeof item.rightNode === 'function'
                ? item.rightNode()
                : item.rightNode;

            return (
              <GeneralTestItem
                {...item}
                key={itemKey}
                itemIndex={idx}
                afterPress={async result => {
                  if (!result?.keepModalVisible)
                    setWalletTestItemModalVisible(false);
                }}>
                <View style={styles.leftCol}>
                  <View style={styles.iconWrapper}>{item.icon}</View>
                  <Text style={styles.settingItemLabel}>{item.label}</Text>
                </View>
                {rightNode || <RcArrowRightCC color={colors['neutral-foot']} />}
              </GeneralTestItem>
            );
          })}
        </View>
      </AutoLockView>
    </AppBottomSheetModal>
  );
}

const SIZES = {
  ITEM_HEIGHT: 60,
  ITEM_GAP: 12,
  titleMt: 6,
  titleHeight: 24,
  titleMb: 16,
  HANDLE_HEIGHT: 8,
  containerPb: 42,
};

function getFullHeight(itemsLen: number) {
  return (
    SIZES.HANDLE_HEIGHT +
    (SIZES.titleMt + SIZES.titleHeight + SIZES.titleMb) +
    (SIZES.ITEM_HEIGHT + SIZES.ITEM_GAP) * (itemsLen - 1) +
    SIZES.ITEM_HEIGHT +
    SIZES.containerPb
  );
}
const getStyles = createGetStyles((colors, ctx) => {
  return {
    sheet: {
      backgroundColor: colors['neutral-bg-2'],
    },
    handleStyle: {
      height: 8,
      backgroundColor: colors['neutral-bg-2'],
    },
    container: {
      flex: 1,
      paddingVertical: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      height: '100%',
      paddingBottom: SIZES.containerPb,
      // ...makeDebugBorder('blue')
    },
    title: {
      fontSize: 20,
      fontWeight: '500',
      color: colors['neutral-title-1'],
      textAlign: 'center',

      marginTop: SIZES.titleMt,
      minHeight: SIZES.titleHeight,
      marginBottom: SIZES.titleMb,
      // ...makeDebugBorder('red'),
    },
    mainContainer: {
      width: '100%',
      paddingHorizontal: 20,
    },

    settingItem: {
      width: '100%',
      height: SIZES.ITEM_HEIGHT,
      paddingTop: 18,
      paddingBottom: 18,
      paddingHorizontal: 12,
      backgroundColor: !ctx?.isLight
        ? colors['neutral-card1']
        : colors['neutral-bg1'],
      borderRadius: 8,

      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    notFirstOne: {
      marginTop: SIZES.ITEM_GAP,
    },
    leftCol: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    labelIcon: { width: 18, height: 18 },
    iconWrapper: {
      width: 18,
      height: 18,
      marginRight: 8,
    },
    settingItemLabel: {
      color: colors['neutral-title-1'],
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '500',
    },
  };
});
