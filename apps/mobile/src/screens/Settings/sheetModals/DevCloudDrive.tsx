import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text } from 'react-native';
import { RcArrowRightCC, RcIconCheckmarkCC } from '@/assets/icons/common';

import { AppBottomSheetModal } from '@/components';
import { useSheetModals } from '@/hooks/useSheetModal';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import TouchableView from '@/components/Touchable/TouchableView';
import { atom, useAtom } from 'jotai';
import AutoLockView from '@/components/AutoLockView';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { useGoogleSign } from '@/hooks/cloudStorage';
import { IS_ANDROID } from '@/core/native/utils';
import {
  deleteAllBackups,
  saveMnemonicToCloud,
} from '@/core/utils/cloudBackup';
import {
  RcClearPending,
  RcGoogleDrive,
  RcGoogleSignout,
} from '@/assets/icons/settings';
import { DevTestItem, makeNoop, GeneralTestItem } from './testDevUtils';

const cloudDriveTestItemModalVisibleAtom = atom(false);
export function useCloudDriveTestItemModalVisible() {
  const [cloudDriveTestItemModalVisible, setCloudDriveTestItemModalVisible] =
    useAtom(cloudDriveTestItemModalVisibleAtom);

  return {
    cloudDriveTestItemModalVisible,
    setCloudDriveTestItemModalVisible,
  };
}

export default function CloudDriveTestItemModal({
  onCancel,
}: RNViewProps & {
  onCancel?(): void;
}) {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { toggleShowSheetModal } = useSheetModals({
    cloudDriveTest: modalRef,
  });

  const {
    cloudDriveTestItemModalVisible: visible,
    setCloudDriveTestItemModalVisible,
  } = useCloudDriveTestItemModalVisible();

  useEffect(() => {
    toggleShowSheetModal('cloudDriveTest', visible || 'destroy');
  }, [visible, toggleShowSheetModal]);

  const { styles, colors } = useThemeStyles(getStyles);

  const { isLoginedGoogle, doGoogleSign, doGoogleSignOut } = useGoogleSign();

  const handleCancel = useCallback(() => {
    setCloudDriveTestItemModalVisible(false);
    onCancel?.();
  }, [setCloudDriveTestItemModalVisible, onCancel]);

  const Items = (() => {
    const list: DevTestItem[] = [
      {
        disabled: !IS_ANDROID,
        label: !isLoginedGoogle ? 'Sign google drive' : 'Signout google drive',
        icon: !isLoginedGoogle ? (
          <RcGoogleDrive style={styles.labelIcon} />
        ) : (
          <RcGoogleSignout style={styles.labelIcon} />
        ),
        onPress: !isLoginedGoogle
          ? () => {
              doGoogleSign()
                .then(async e => {
                  console.debug('loginIfNeeded done', e.needLogin);
                  await saveMnemonicToCloud({
                    mnemonic: 'testtest',
                    password: 'test',
                  });
                })
                .catch(e => {
                  console.error('loginIfNeeded error', e);
                });
            }
          : () => {
              doGoogleSignOut();
            },
      },
      {
        label: 'Clear Cloud Backup',
        icon: <RcClearPending style={styles.labelIcon} />,
        onPress: () => {
          deleteAllBackups();
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
        <Text style={styles.title}>Test Memonics Backup</Text>
        <View style={styles.mainContainer}>
          {Items.map((item, idx) => {
            const itemKey = `testitem-${item.label}`;

            return (
              <GeneralTestItem
                {...item}
                key={itemKey}
                itemIndex={idx}
                afterPress={async result => {
                  if (!result?.keepModalVisible)
                    setCloudDriveTestItemModalVisible(false);
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
