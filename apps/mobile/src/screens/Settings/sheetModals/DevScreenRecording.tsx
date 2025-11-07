import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, Alert } from 'react-native';

import { AppBottomSheetModal } from '@/components';
import { useSheetModals } from '@/hooks/useSheetModal';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import AutoLockView from '@/components/AutoLockView';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';

import {
  RcScreenshot,
  RcScreenRecord,
  RcCode,
  RcCountdown,
} from '@/assets/icons/settings';
import { DevTestItem, GeneralTestItem } from './testDevUtils';
import { AppSwitch, SwitchToggleType } from '@/components/customized/Switch';
import { isNonPublicProductionEnv } from '@/constant';
import { IS_IOS } from '@/core/native/utils';
import { SwitchAllowScreenshot } from '../components/SwitchAllowScreenshot';
import { useExpScreenCapture } from '@/hooks/appSettings';
import { LabelScreenshotToReport } from '../components/SwitchScreenshotToReport';
import {
  useGetShowFeedbackOnScreenshotCapture,
  useScreenshotToReportEnabled,
} from '@/components/Screenshot/hooks';

const devScreenRecordingModalVisibleAtom = atom(false);
export function useDevScreenRecordingModalVisiable() {
  const [devScreenRecordingModalVisible, setDevScreenRecordingModalVisible] =
    useAtom(devScreenRecordingModalVisibleAtom);

  return {
    devScreenRecordingModalVisible,
    setDevScreenRecordingModalVisible,
  };
}

export default function DevScreenRecordingModal({
  onCancel,
}: RNViewProps & {
  onCancel?(): void;
}) {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { toggleShowSheetModal } = useSheetModals({
    devScreenRecordingModal: modalRef,
  });

  const { devScreenRecordingModalVisible, setDevScreenRecordingModalVisible } =
    useDevScreenRecordingModalVisiable();

  useEffect(() => {
    toggleShowSheetModal(
      'devScreenRecordingModal',
      devScreenRecordingModalVisible || 'destroy',
    );
  }, [devScreenRecordingModalVisible, toggleShowSheetModal]);

  const { styles, colors } = useThemeStyles(getStyles);

  const handleCancel = useCallback(() => {
    setDevScreenRecordingModalVisible(false);
    onCancel?.();
  }, [setDevScreenRecordingModalVisible, onCancel]);

  const { forceAllowScreenshot } = useExpScreenCapture();
  const switchAllowScreenshotRef = useRef<SwitchToggleType>(null);

  const { getShowFeedbackOnScreenshotCapture } =
    useGetShowFeedbackOnScreenshotCapture();
  const isScreenshotReportEnabled = getShowFeedbackOnScreenshotCapture();
  const { toggleSkipReportIn24Hours } = useScreenshotToReportEnabled();

  const Items = (() => {
    const list: DevTestItem[] = [
      {
        label: forceAllowScreenshot
          ? `Force Allow Capture`
          : `Disallow Capture Sensitive Scene`,
        icon: IS_IOS ? (
          <RcScreenRecord style={styles.labelIcon} />
        ) : (
          <RcScreenshot style={styles.labelIcon} />
        ),
        rightNode: <SwitchAllowScreenshot ref={switchAllowScreenshotRef} />,
        onPress: () => {
          switchAllowScreenshotRef.current?.toggle();
        },
        visible: isNonPublicProductionEnv,
      },
      {
        label: isScreenshotReportEnabled
          ? 'Report on screenshot now'
          : 'Disable Screenshot Until',
        icon: <RcCountdown style={styles.labelIcon} />,
        onPress: () => {
          toggleSkipReportIn24Hours(false);
        },
        rightNode: (
          <Text>
            {isScreenshotReportEnabled ? null : <LabelScreenshotToReport />}
          </Text>
        ),
        visible: !isScreenshotReportEnabled,
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
        <Text style={styles.title}>Screen Recording</Text>
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
                    setDevScreenRecordingModalVisible(false);
                }}
              />
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
    // (SIZES.titleMt + SIZES.titleHeight + SIZES.titleMb)
    +(SIZES.ITEM_HEIGHT + SIZES.ITEM_GAP) * (itemsLen - 1) +
    SIZES.ITEM_HEIGHT
    // + SIZES.containerPb
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
