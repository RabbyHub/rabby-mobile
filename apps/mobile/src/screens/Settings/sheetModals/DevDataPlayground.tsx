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
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import {
  dropAppDataSourceAndQuitApp,
  prepareAppDataSource,
} from '@/databases/imports';
import { resetUpdateHistoryTime } from '@/hooks/historyTokenDict';
import { BuyItemEntity } from '@/databases/entities/buyItem';
import { downloadDbFile } from '@/databases/dbfs';
import { IS_IOS } from '@/core/native/utils';
import { perpsService } from '@/core/services';
import { toast } from '@/components2024/Toast';
import { naviPush } from '@/utils/navigation';

const devDataPlaygroundModalVisibleAtom = atom(false);
export function useDevDataPlaygroundModalVisible() {
  const [devDataPlaygroundModalVisible, setDataPlaygroundModalVisible] =
    useAtom(devDataPlaygroundModalVisibleAtom);

  return {
    devDataPlaygroundModalVisible,
    setDataPlaygroundModalVisible,
  };
}

export default function DevDataPlaygroundModal({
  onCancel,
}: RNViewProps & {
  onCancel?(): void;
}) {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { toggleShowSheetModal } = useSheetModals({
    devUIPlayground: modalRef,
  });

  const {
    devDataPlaygroundModalVisible: visible,
    setDataPlaygroundModalVisible,
  } = useDevDataPlaygroundModalVisible();

  useEffect(() => {
    toggleShowSheetModal('devUIPlayground', visible || 'destroy');
  }, [visible, toggleShowSheetModal]);

  const { styles, colors } = useThemeStyles(getStyles);

  const handleCancel = useCallback(() => {
    setDataPlaygroundModalVisible(false);
    onCancel?.();
  }, [setDataPlaygroundModalVisible, onCancel]);

  const navigation = useRabbyAppNavigation();

  const Items = (() => {
    const list: DevTestItem[] = [
      {
        label: 'SQLite',
        icon: <RcCode style={styles.labelIcon} />,
        onPress: () => {
          navigation.dispatch(
            StackActions.push(RootNames.StackTestkits, {
              screen: RootNames.DevDataSQLite,
            }),
          );
        },
      },
      // {
      //   label: 'Clear All SQLite (No restart)',
      //   icon: <RcCode style={styles.labelIcon} />,
      //   onPress: async () => {
      //     exp_reConnectAppDataSource()
      //       .then(() => {
      //         Alert.alert('Clear All DB data (No restart)', 'Success');
      //       })
      //       .catch(error => {
      //         console.error(error);
      //         Alert.alert('Clear All DB data (No restart)', 'Failed');
      //       })
      //       .finally(() => {
      //         fetchSqliteStatics();
      //       });
      //   },
      // },
      {
        label: 'Reset Perps Store',
        icon: <RcCode style={styles.labelIcon} />,
        onPress: () => {
          perpsService.resetStore();
          toast.success('PERPS STORE RESET SUCCESS');
        },
      },
      {
        label: 'Download DB file',
        icon: <RcCode style={styles.labelIcon} />,
        visible: IS_IOS,
        onPress: async () => {
          downloadDbFile();
        },
      },
      {
        label: 'High performance',
        icon: <RcCode style={styles.labelIcon} />,
        onPress: async () => {
          naviPush(RootNames.StackTestkits, {
            screen: RootNames.DevPerf,
          });
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
      enableContentPanningGesture>
      <AutoLockView
        as="View"
        style={[
          styles.container,
          {
            paddingBottom: safeSizes.containerPaddingBottom,
          },
        ]}>
        <Text style={styles.title}>Data Playground</Text>
        <View style={styles.mainContainer}>
          {Items.map((item, idx) => {
            const itemKey = `testitem-${item.label}`;

            return (
              <GeneralTestItem
                {...item}
                key={itemKey}
                itemIndex={idx}
                afterPress={async result => {
                  if (!result?.keepModalVisible) {
                    setDataPlaygroundModalVisible(false);
                  }
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
