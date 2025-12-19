import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
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
import { useDevServerModalVisible } from '../Modals/DevModalDevServer';
import { toast } from '@/components2024/Toast';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

const devUIPlaygroundModalVisibleAtom = atom(false);
export function useDevUIPlaygroundModalVisible() {
  const [devUIPlaygroundModalVisible, setDevUIPlaygroundModalVisible] = useAtom(
    devUIPlaygroundModalVisibleAtom,
  );

  return {
    devUIPlaygroundModalVisible,
    setDevUIPlaygroundModalVisible,
  };
}

export default function DevUIPlaygroundModal({
  onCancel,
}: RNViewProps & {
  onCancel?(): void;
}) {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { toggleShowSheetModal } = useSheetModals({
    devUIPlayground: modalRef,
  });

  const {
    devUIPlaygroundModalVisible: visible,
    setDevUIPlaygroundModalVisible,
  } = useDevUIPlaygroundModalVisible();

  useEffect(() => {
    toggleShowSheetModal('devUIPlayground', visible || 'destroy');
  }, [visible, toggleShowSheetModal]);

  const { styles, colors } = useThemeStyles(getStyles);

  const handleCancel = useCallback(() => {
    setDevUIPlaygroundModalVisible(false);
    onCancel?.();
  }, [setDevUIPlaygroundModalVisible, onCancel]);

  const navigation = useRabbyAppNavigation();

  const { accounts } = useAccounts();

  const { haventSetDevServer, setDevServerSettingsModalVisible } =
    useDevServerModalVisible();

  const Items = (() => {
    const list: DevTestItem[] = [
      {
        label: 'New Get Started 2024',
        icon: <RcCode style={styles.labelIcon} />,
        disabled: !!accounts.length,
        onDisabledPress: () => {
          if (accounts.length) {
            Alert.alert(
              'Warning',
              accounts.length > 1
                ? `You have ${accounts.length} accounts, please remove them first`
                : 'You have an account, please remove it first',
            );
            return { keepModalVisible: true };
          }
        },
        onPress: () => {
          navigation.dispatch(
            StackActions.push(RootNames.StackGetStarted, {
              screen: RootNames.GetStartedScreen2024,
            }),
          );
          // navigation.dispatch(
          //   StackActions.push(RootNames.StackTestkits, {
          //     screen: RootNames.NewUserGetStarted2024,
          //   }),
          // );
        },
      },
      {
        label: 'Animated View & Text',
        icon: <RcCode style={styles.labelIcon} />,
        onPress: () => {
          navigation.dispatch(
            StackActions.push(RootNames.StackTestkits, {
              screen: RootNames.DevUIAnimatedTextAndView,
            }),
          );
        },
      },
      {
        label: 'Text & Colors',
        icon: <RcCode style={styles.labelIcon} />,
        onPress: () => {
          navigation.dispatch(
            StackActions.push(RootNames.StackTestkits, {
              screen: RootNames.DevUIFontShowCase,
            }),
          );
        },
      },
      {
        label: 'Account, Brand & Address',
        icon: <RcCode style={styles.labelIcon} />,
        onPress: () => {
          navigation.dispatch(
            StackActions.push(RootNames.StackTestkits, {
              screen: RootNames.DevUIAccountShowCase,
            }),
          );
        },
      },
      {
        label: 'Form',
        icon: <RcCode style={styles.labelIcon} />,
        onPress: () => {
          navigation.dispatch(
            StackActions.push(RootNames.StackTestkits, {
              screen: RootNames.DevUIFormShowCase,
            }),
          );
        },
      },
      {
        label: 'Screen Container',
        icon: <RcCode style={styles.labelIcon} />,
        onPress: () => {
          navigation.dispatch(
            StackActions.push(RootNames.StackTestkits, {
              screen: RootNames.DevUIScreenContainerShowCase,
            }),
          );
        },
      },
      {
        label: 'Dapps',
        icon: <RcCode style={styles.labelIcon} />,
        onPress: () => {
          navigation.dispatch(
            StackActions.push(RootNames.StackTestkits, {
              screen: RootNames.DevUIDapps,
            }),
          );
        },
      },
      {
        label: 'Built-in WebView Pages',
        icon: <RcCode style={styles.labelIcon} />,
        onPress: () => {
          if (__DEV__ && haventSetDevServer) {
            toast.show('Please set up the dev server first.');
            setDevServerSettingsModalVisible(true);
            return;
          }
          navigation.dispatch(
            StackActions.push(RootNames.StackTestkits, {
              screen: RootNames.DevUIBuiltInPages,
            }),
          );
        },
      },
      {
        label: 'Permissions',
        icon: <RcCode style={styles.labelIcon} />,
        onPress: () => {
          navigation.dispatch(
            StackActions.push(RootNames.StackTestkits, {
              screen: RootNames.DevUIPermissions,
            }),
          );
        },
      },
    ];

    return list.filter(item => item.visible !== false);
  })();

  const { safeSizes } = useSafeAndroidBottomSizes({
    // sheetHeight: getFullHeight(Items.length),
    sheetHeight: getFullHeight(5),
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
        <Text style={styles.title}>Component Playground</Text>
        <BottomSheetScrollView contentContainerStyle={styles.mainContainer}>
          {Items.map((item, idx) => {
            const itemKey = `testitem-${item.label}`;

            return (
              <GeneralTestItem
                {...item}
                key={itemKey}
                itemIndex={idx}
                afterPress={async result => {
                  if (!result?.keepModalVisible)
                    setDevUIPlaygroundModalVisible(false);
                }}>
                <View style={styles.leftCol}>
                  <View style={styles.iconWrapper}>{item.icon}</View>
                  <Text style={styles.settingItemLabel}>{item.label}</Text>
                </View>
                <RcArrowRightCC color={colors['neutral-foot']} />
              </GeneralTestItem>
            );
          })}
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
