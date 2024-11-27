import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, Alert } from 'react-native';
import { RcArrowRightCC } from '@/assets/icons/common';

import { AppBottomSheetModal } from '@/components';
import { useSheetModals } from '@/hooks/useSheetModal';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import TouchableView from '@/components/Touchable/TouchableView';
import { atom, useAtom } from 'jotai';
import AutoLockView from '@/components/AutoLockView';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';

import { RcCode } from '@/assets/icons/settings';
import { DevTestItem, makeNoop, GeneralTestItem } from './testDevUtils';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { StackActions } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { useAccounts } from '@/hooks/account';
import { apisWalletConnect } from '@/core/apis';
import { useDappsViewConfig } from '@/screens/Dapps/hooks/useDappView';
import { formatTimeReadable } from '@/utils/time';

const devUIPreviewScreenModalVisibleAtom = atom(false);
export function useUIDevWipModalVisiable() {
  const [devUIWipModalVisibleAtom, setDevUIWipModalVisible] = useAtom(
    devUIPreviewScreenModalVisibleAtom,
  );

  return {
    devUIWipModalVisibleAtom,
    setDevUIWipModalVisible,
  };
}

export default function DevUIWipModal({
  onCancel,
}: RNViewProps & {
  onCancel?(): void;
}) {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { toggleShowSheetModal } = useSheetModals({
    devUIPreviewScreen: modalRef,
  });

  const { devUIWipModalVisibleAtom: visible, setDevUIWipModalVisible } =
    useUIDevWipModalVisiable();

  useEffect(() => {
    toggleShowSheetModal('devUIPreviewScreen', visible || 'destroy');
  }, [visible, toggleShowSheetModal]);

  const { styles, colors } = useThemeStyles(getStyles);

  const handleCancel = useCallback(() => {
    setDevUIWipModalVisible(false);
    onCancel?.();
  }, [setDevUIWipModalVisible, onCancel]);

  const navigation = useRabbyAppNavigation();

  const handleAddWalletConnectAddresses = React.useCallback(() => {
    apisWalletConnect.importAddress({
      address: '0x5853eD4f26A3fceA565b3FBC698bb19cdF6DEB85',
      brandName: 'MetaMask',
    });
    apisWalletConnect.importAddress({
      address: '0x12F5DF67c01050482E182ed51F962b873F1AcDF4',
      brandName: 'Bitget',
    });
    apisWalletConnect.importAddress({
      address: '0x5eF0CfAe4e0a2f7BcC50e4A4e0a2f7BcC50e4A4e',
      brandName: 'TP',
    });
    apisWalletConnect.importAddress({
      address: '0xdc7b8245Cc165d7994646e063077F5F1a5D9d461',
      brandName: 'Rainbow',
    });
  }, []);

  const { dappsViewConfig, toggleUseShortConfig } = useDappsViewConfig();

  const Items = (() => {
    const list: DevTestItem[] = [
      {
        label: '[Screen] go to multi address home',
        icon: <RcCode style={styles.labelIcon} />,
        onPress: () => {
          navigation.dispatch(
            StackActions.replace(RootNames.StackRoot, {
              screen: RootNames.Home,
              params: {},
            }),
          );
        },
      },
      {
        label: '[Data] Add WalletConnect addresses',
        icon: <RcCode style={styles.labelIcon} />,
        onPress: () => {
          handleAddWalletConnectAddresses();
        },
      },
      {
        label: [
          `[Switch] Dapp WebView Expire`,
          formatTimeReadable(dappsViewConfig.expireDuration / 1000),
        ]
          .filter(Boolean)
          .join(' '),
        icon: <RcCode style={styles.labelIcon} />,
        onPress: () => {
          toggleUseShortConfig();
        },
      },
    ];

    return list.filter(item => item.visible !== false);
  })();

  const { safeSizes } = useSafeAndroidBottomSizes({
    sheetHeight: getFullHeight(Items.length) + 80 /* subTitle offset */,
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
        <Text style={styles.title}>Wip Helpers</Text>
        <Text style={styles.subTitle}>1. redirecting to the wip screens</Text>
        <Text style={styles.subTitle}>2. or generating some data.</Text>
        <View style={styles.mainContainer}>
          {Items.map((item, idx) => {
            const itemKey = `testitem-${item.label}`;

            return (
              <GeneralTestItem
                {...item}
                key={itemKey}
                itemIndex={idx}
                afterPress={async result => {
                  if (!result?.keepModalVisible) setDevUIWipModalVisible(false);
                }}>
                <View style={styles.leftCol}>
                  <View style={styles.iconWrapper}>{item.icon}</View>
                  <Text style={styles.settingItemLabel}>{item.label}</Text>
                </View>
                <RcArrowRightCC color={colors['neutral-foot']} />
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
    subTitle: {
      fontSize: 14,
      lineHeight: 14,
      fontWeight: '400',
      color: colors['neutral-foot'],
      textAlign: 'center',
      marginBottom: 16,
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
