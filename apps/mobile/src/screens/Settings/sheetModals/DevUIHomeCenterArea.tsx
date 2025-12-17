import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, Alert } from 'react-native';

import { AppBottomSheetModal } from '@/components';
import { useSheetModals } from '@/hooks/useSheetModal';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import AutoLockView from '@/components/AutoLockView';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';

import { RcCode } from '@/assets/icons/settings';
import { DevTestItem, makeNoop, GeneralTestItem } from './testDevUtils';
import { useMakeMockDataForRateGuideExposure } from '@/components/RateModal/hooks';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import { isNonPublicProductionEnv } from '@/constant';
import { useMockClearOfflineChainTips } from '@/screens/Home/components/OfflineChainNotify';
import {
  FORCE_DISABLE_FEEDBACK_BY_SCREENSHOT,
  useViewedHomeTip,
} from '@/components/Screenshot/hooks';
import { useGuidanceShown } from '@/components2024/Animations/hooks';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';

const MAKE_DEFAULT_MOCK_DATA = () => ({
  forceShowFundWallet: false,
  forceShowOffchainNotify: false,
});

// const homeCenterAreaMockData = atom({ ...MAKE_DEFAULT_MOCK_DATA() });

type HomeCenterAreaMockData = {
  devUIHomeCenterAreaModalVisible: boolean;
  mockData: ReturnType<typeof MAKE_DEFAULT_MOCK_DATA>;
};
const homeCenterAreaMockDataStore = zCreate(() => ({
  devUIHomeCenterAreaModalVisible: false,
  mockData: MAKE_DEFAULT_MOCK_DATA(),
}));

function setMockData(
  valOrFunc: UpdaterOrPartials<HomeCenterAreaMockData['mockData']>,
) {
  homeCenterAreaMockDataStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.mockData, valOrFunc);

    return { ...prev, mockData: newVal };
  });
}

export function useMockDataForHomeCenterArea() {
  const mockData = homeCenterAreaMockDataStore(s => s.mockData);

  const prodData = useMemo(() => MAKE_DEFAULT_MOCK_DATA(), []);

  return {
    mockData: isNonPublicProductionEnv ? mockData : prodData,
  };
}

export function useMakeMockDataForHomeCenterArea() {
  const { mockData } = useMockDataForHomeCenterArea();

  return {
    mockData,
    setMockData,
  };
}

function setDevUIHomeCenterAreaModalVisible(
  valOrFunc: UpdaterOrPartials<
    HomeCenterAreaMockData['devUIHomeCenterAreaModalVisible']
  >,
) {
  homeCenterAreaMockDataStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(
      prev.devUIHomeCenterAreaModalVisible,
      valOrFunc,
    );

    return { ...prev, devUIHomeCenterAreaModalVisible: newVal };
  });
}
export function useUIDevHomeCenterAreaModalVisiable() {
  const devUIHomeCenterAreaModalVisible = homeCenterAreaMockDataStore(
    s => s.devUIHomeCenterAreaModalVisible,
  );

  return {
    devUIHomeCenterAreaModalVisible,
    setDevUIHomeCenterAreaModalVisible,
  };
}

/** @deprecated */
export default function DevUIHomeCenterAreaModal({
  onCancel,
}: RNViewProps & {
  onCancel?(): void;
}) {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { toggleShowSheetModal } = useSheetModals({
    devUIHomeCenterAreaModal: modalRef,
  });

  const {
    devUIHomeCenterAreaModalVisible,
    setDevUIHomeCenterAreaModalVisible,
  } = useUIDevHomeCenterAreaModalVisiable();

  useEffect(() => {
    toggleShowSheetModal(
      'devUIHomeCenterAreaModal',
      devUIHomeCenterAreaModalVisible || 'destroy',
    );
  }, [devUIHomeCenterAreaModalVisible, toggleShowSheetModal]);

  const { styles, colors } = useThemeStyles(getStyles);

  const handleCancel = useCallback(() => {
    setDevUIHomeCenterAreaModalVisible(false);
    onCancel?.();
  }, [setDevUIHomeCenterAreaModalVisible, onCancel]);

  const { mockExposureRateGuide } = useMakeMockDataForRateGuideExposure();
  const { mockData, setMockData } = useMakeMockDataForHomeCenterArea();
  const { clearOfflineChainTips } = useMockClearOfflineChainTips();
  const { mockResetViewedHomeTip } = useViewedHomeTip();
  const { toggleViewedGuidance } = useGuidanceShown();

  const Items = (() => {
    const list: DevTestItem[] = [
      {
        label: '[Data] Clear Offchain',
        icon: <RcCode style={styles.labelIcon} />,
        // onPress: () => {
        // },
        rightNode(ctx) {
          return (
            <AppSwitch2024
              value={mockData.forceShowOffchainNotify}
              onValueChange={value => {
                setMockData(prev => ({
                  ...prev,
                  forceShowOffchainNotify: value,
                }));

                if (value) {
                  clearOfflineChainTips();
                }
              }}
            />
          );
        },
      },
      {
        label: '[Memory] Force FundWallet',
        icon: <RcCode style={styles.labelIcon} />,
        // onPress: () => {
        // },
        rightNode(ctx) {
          return (
            <AppSwitch2024
              value={mockData.forceShowFundWallet}
              onValueChange={value => {
                setMockData(prev => ({ ...prev, forceShowFundWallet: value }));
              }}
            />
          );
        },
      },
      {
        label: [`[Data] Exposure Rate Guide`].filter(Boolean).join(' '),
        icon: <RcCode style={styles.labelIcon} />,
        onPress: () => {
          mockExposureRateGuide();
        },
      },
      {
        label: [`[Data] Reset Home Multiple Tabs Guide`]
          .filter(Boolean)
          .join(' '),
        icon: <RcCode style={styles.labelIcon} />,
        onPress: () => {
          toggleViewedGuidance('multiTabs20251205Viewed', false);
        },
      },
      ...(!FORCE_DISABLE_FEEDBACK_BY_SCREENSHOT
        ? [
            {
              label: [`[Data] Reset Viewed Home Tip`].filter(Boolean).join(' '),
              icon: <RcCode style={styles.labelIcon} />,
              onPress: () => {
                mockResetViewedHomeTip();
              },
            },
          ]
        : []),
    ].filter(Boolean);

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
        <Text style={styles.title}>Mock Home Center Areas</Text>
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
                    setDevUIHomeCenterAreaModalVisible(false);
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
