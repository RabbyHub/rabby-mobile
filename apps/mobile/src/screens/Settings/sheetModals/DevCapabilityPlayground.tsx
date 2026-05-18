import React, { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { RcArrowRightCC } from '@/assets/icons/common';
import { RcCode } from '@/assets/icons/settings';
import { StackActions } from '@react-navigation/native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { atom, useAtom } from 'jotai';

import { AppBottomSheetModal } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { Text } from '@/components/Typography';
import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { useThemeStyles } from '@/hooks/theme';
import { useSheetModals } from '@/hooks/useSheetModal';
import { createGetStyles } from '@/utils/styles';
import { GeneralTestItem, type DevTestItem } from './testDevUtils';

const devCapabilityPlaygroundModalVisibleAtom = atom(false);

export function useDevCapabilityPlaygroundModalVisible() {
  const [
    devCapabilityPlaygroundModalVisible,
    setDevCapabilityPlaygroundModalVisible,
  ] = useAtom(devCapabilityPlaygroundModalVisibleAtom);

  return {
    devCapabilityPlaygroundModalVisible,
    setDevCapabilityPlaygroundModalVisible,
  };
}

export default function DevCapabilityPlaygroundModal({
  onCancel,
}: RNViewProps & {
  onCancel?(): void;
}) {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { toggleShowSheetModal } = useSheetModals({
    devCapabilityPlayground: modalRef,
  });
  const navigation = useRabbyAppNavigation();
  const {
    devCapabilityPlaygroundModalVisible: visible,
    setDevCapabilityPlaygroundModalVisible,
  } = useDevCapabilityPlaygroundModalVisible();
  const { styles, colors } = useThemeStyles(getStyles);

  useEffect(() => {
    toggleShowSheetModal('devCapabilityPlayground', visible || 'destroy');
  }, [toggleShowSheetModal, visible]);

  const handleCancel = useCallback(() => {
    setDevCapabilityPlaygroundModalVisible(false);
    onCancel?.();
  }, [onCancel, setDevCapabilityPlaygroundModalVisible]);

  const items: DevTestItem[] = [
    {
      label: 'File',
      icon: <RcCode style={styles.labelIcon} />,
      onPress: () => {
        navigation.dispatch(
          StackActions.push(RootNames.StackTestkits, {
            screen: RootNames.DevCapabilityFile,
          }),
        );
      },
    },
  ];

  const { safeSizes } = useSafeAndroidBottomSizes({
    sheetHeight: getFullHeight(items.length),
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
      enableContentPanningGesture>
      <AutoLockView
        as="View"
        style={[
          styles.container,
          {
            paddingBottom: safeSizes.containerPaddingBottom,
          },
        ]}>
        <Text style={styles.title}>Capability Playground</Text>
        <BottomSheetScrollView contentContainerStyle={styles.mainContainer}>
          {items.map((item, idx) => (
            <GeneralTestItem
              {...item}
              key={`capability-${item.label}`}
              itemIndex={idx}
              afterPress={async result => {
                if (!result?.keepModalVisible) {
                  setDevCapabilityPlaygroundModalVisible(false);
                }
              }}>
              <View style={styles.leftCol}>
                <View style={styles.iconWrapper}>{item.icon}</View>
                <Text style={styles.settingItemLabel}>{item.label}</Text>
              </View>
              <RcArrowRightCC color={colors['neutral-foot']} />
            </GeneralTestItem>
          ))}
        </BottomSheetScrollView>
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

const getStyles = createGetStyles(colors => ({
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
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: colors['neutral-title-1'],
    textAlign: 'center',
    marginTop: SIZES.titleMt,
    minHeight: SIZES.titleHeight,
    marginBottom: SIZES.titleMb,
  },
  mainContainer: {
    width: '100%',
    paddingHorizontal: 20,
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
}));
