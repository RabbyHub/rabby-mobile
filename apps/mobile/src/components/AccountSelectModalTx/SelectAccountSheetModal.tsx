import { AppBottomSheetModal } from '@/components';
import {
  AccountsPanelInSheetModal,
  SelectAccountSheetModalType,
} from '@/components/AccountSelectModalTx/AccountsPanel';
import AutoLockView from '@/components/AutoLockView';
import { IS_IOS } from '@/core/native/utils';
import { FontWeightEnum } from '@/core/utils/fonts';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { useSheetModal } from '@/hooks/useSheetModal';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, Keyboard, Pressable, Text, View } from 'react-native';
import {
  AccountSelectModalProvider,
  SelectAccountSheetModalScreen,
  SelectAccountSheetModalValues,
} from './hooks';
import { RcIconHistory, RcIconNavLeft } from './icons';
import ScreenPanelEnterAddress from './modalScreens/EnterAddress';
import { SelectAccountSheetModalSizes } from './layout';
import { ScreenAddNewWhitelistAddress } from './modalScreens/AddNewWhitelistAddress';
import { ScreenSentHistory } from './modalScreens/SentHistory';
import { ScreenHistoryLocalDetail } from './modalScreens/TxHistoryDetail';
import { HistoryLocalDetailParams } from '@/screens/TransactionRecord/components/TransactionItem2025';
import { Account } from '@/core/services/preference';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import { useFocusEffect } from '@react-navigation/native';
import { touchedFeedback } from '@/utils/touch';
import { ScreenPanelScanner } from './modalScreens/ScanQrcode';
import { Button } from '@/components2024/Button';

function getDefaultScreenStates(): {
  isScanning: boolean;
  currentScreen: SelectAccountSheetModalScreen;
  nextScanFor: null | 'enter-addr' | 'add-new-whitelist-addr';
  viewingHistoryTxData: HistoryLocalDetailParams | null;
  nextInitValues: {
    'add-new-whitelist-addr': string;
    'enter-addr': {
      inputValue?: string;
    };
  };
} {
  return {
    isScanning: false,
    currentScreen: 'default',
    nextScanFor: null as null,
    viewingHistoryTxData: null,
    nextInitValues: {
      'add-new-whitelist-addr': '',
      'enter-addr': {
        inputValue: '',
      },
    },
  };
}
const maxHeight = Dimensions.get('window').height - 120;
// const SNAPSHOTS = [1, maxHeight];
const SNAPSHOTS = [__DEV__ ? maxHeight : maxHeight];
const SHOW_IDX = SNAPSHOTS.length === 1 ? true : SNAPSHOTS.length - 1;
export function SheetModalSelectAccountSend({
  type,
  // visible = __DEV__ ? type === 'SendTo' : false,
  visible,
  onVisibleChange,
  onSelectAccount,
}: {
  type: SelectAccountSheetModalType;
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  onSelectAccount?: SelectAccountSheetModalValues['cbOnSelectedAccount'];
}) {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

  const { sheetModalRef, toggleShowSheetModal } = useSheetModal(null);
  const mountRef = useRef(false);
  useEffect(() => {
    if (visible) {
      if (!mountRef.current) {
        toggleShowSheetModal(true);
        mountRef.current = true;
        if (SNAPSHOTS.length > 1) {
          setTimeout(() => {
            toggleShowSheetModal(SHOW_IDX);
          }, 300);
        }
      } else {
        toggleShowSheetModal(SHOW_IDX);
      }
    } else {
      Keyboard.dismiss();
      toggleShowSheetModal(false);
    }
  }, [visible, toggleShowSheetModal]);

  const { t } = useTranslation();

  const { FULL_HEIGHT } = useMemo(() => {
    return {
      FULL_HEIGHT:
        SIZES.HANDLE_HEIGHT +
        (SIZES.titleMt + SIZES.titleHeight + SIZES.titleMb) +
        (SIZES.ITEM_HEIGHT + SIZES.ITEM_GAP) * (8 - 1) +
        SIZES.ITEM_HEIGHT +
        SIZES.containerPt +
        SIZES.containerPb +
        SIZES.listBottomSpace,
    };
  }, []);

  const { safeSizes } = useSafeAndroidBottomSizes({
    sheetHeight: FULL_HEIGHT,
    containerPb: SIZES.containerPb,
  });

  const [screenStates, setScreenStates] = useState(getDefaultScreenStates());

  const resetScreenStates = useCallback(() => {
    setScreenStates(getDefaultScreenStates());
  }, []);

  const resetInitValues = useCallback(() => {
    setScreenStates(prev => ({
      ...prev,
      nextInitValues: getDefaultScreenStates().nextInitValues,
    }));
  }, []);

  const { currentScreen } = screenStates;

  const { modalTitle } = useMemo(() => {
    const ret = {
      modalTitle: '',
    };
    switch (currentScreen) {
      case 'default':
      case 'enter-addr': {
        switch (type) {
          case 'SendFrom': {
            ret.modalTitle = t('page.selectAccountSheetModal.title.sendFrom');
            break;
          }
          default:
          case 'SendTo': {
            ret.modalTitle = t('page.selectAccountSheetModal.title.sendTo');
            break;
          }
        }
        break;
      }
      case 'add-new-whitelist-addr': {
        ret.modalTitle = t(
          'page.selectAccountSheetModal.title.addNewWhitelistAddr',
        );
        break;
      }
      case 'select-from-history': {
        ret.modalTitle = t(
          'page.selectAccountSheetModal.title.selectFromHistory',
        );
        break;
      }
      case 'view-sent-tx': {
        ret.modalTitle = t('page.selectAccountSheetModal.title.viewSentTx');
        break;
      }
      case 'scan-qr-code': {
        ret.modalTitle = t('page.selectAccountSheetModal.title.sendTo');
        break;
      }
    }

    return ret;
  }, [currentScreen, type, t]);

  const fnNavTo = useCallback<SelectAccountSheetModalValues['fnNavTo']>(
    (screen, extra) => {
      setScreenStates(prev => {
        const nextState = { ...prev, currentScreen: screen };

        switch (screen) {
          case 'view-sent-tx':
            // pass data to history detail screen
            if (!extra?.viewingHistoryTxData) {
              throw new Error(
                '[AccountSelectModalTx] fnNavTo to view-sent-tx must provide viewingHistoryTxData',
              );
            }
            nextState.viewingHistoryTxData = extra.viewingHistoryTxData;
            break;
          case 'add-new-whitelist-addr':
            nextState.nextInitValues['add-new-whitelist-addr'] =
              extra?.inputValue || '';
            break;
          case 'enter-addr': {
            nextState.nextInitValues['enter-addr'] = {
              inputValue: extra?.inputValue || '',
            };
            break;
          }
          case 'scan-qr-code': {
            if (!extra?.nextScanFor) {
              throw new Error(
                '[AccountSelectModalTx] fnNavTo to scan-qr-code must provide nextScanFor',
              );
            }
            nextState.nextScanFor = extra.nextScanFor;
            break;
          }
          default:
            nextState.viewingHistoryTxData = null;
            nextState.nextInitValues['add-new-whitelist-addr'] = '';
            break;
        }

        return nextState;
      });

      setTimeout(() => {
        resetInitValues();
      }, 1e3);
    },
    [resetInitValues],
  );

  const cbOnScanStageChanged = useCallback((stage: 'start' | 'end') => {
    switch (stage) {
      case 'start':
        setScreenStates(prev => ({ ...prev, isScanning: true }));
        // onVisibleChange?.(false);
        break;
      case 'end':
        setTimeout(() => {
          setScreenStates(prev => ({ ...prev, isScanning: false }));
          // onVisibleChange?.(true);
        }, 300);
        break;
      default:
        break;
    }
  }, []);

  const cbOnSelectedAccount = useCallback<
    SelectAccountSheetModalValues['cbOnSelectedAccount']
  >(
    (account: Account | null) => {
      onSelectAccount?.(account);
      onVisibleChange?.(false);
      resetScreenStates();
      Keyboard.dismiss();
    },
    [onSelectAccount, onVisibleChange, resetScreenStates],
  );

  const onPressNavBack = useCallback(() => {
    touchedFeedback();
    switch (currentScreen) {
      case 'default':
        break;
      case 'enter-addr':
      case 'add-new-whitelist-addr':
        fnNavTo('default');
        break;
      case 'select-from-history':
        fnNavTo('add-new-whitelist-addr');
        break;
      case 'view-sent-tx':
        fnNavTo('select-from-history');
        break;
      case 'scan-qr-code':
        fnNavTo(screenStates.nextScanFor || 'default');
        break;
      default:
        break;
    }
  }, [currentScreen, fnNavTo, screenStates.nextScanFor]);

  const { onHardwareBackHandler } = useHandleBackPressClosable(
    useCallback(() => {
      const onHome = screenStates.currentScreen === 'default';
      if (visible && !onHome) {
        onPressNavBack();
      } else if (visible && onHome) {
        setTimeout(() => {
          onVisibleChange?.(false);
        }, 200);
      }
      return !visible;
    }, [onPressNavBack, visible, onVisibleChange, screenStates.currentScreen]),
  );

  useFocusEffect(onHardwareBackHandler);

  const fnCloseModal = useCallback(() => {
    onVisibleChange?.(false);
  }, [onVisibleChange]);

  const providerValues = useMemo<SelectAccountSheetModalValues>(() => {
    return {
      __isUnderContext__: true,
      modalScreen: screenStates.currentScreen,
      viewingHistoryTxData: screenStates.viewingHistoryTxData,
      nextScanFor: screenStates.nextScanFor,
      fnCloseModal,
      fnNavTo,
      cbOnScanStageChanged,
      cbOnSelectedAccount,
      computed: {
        canNavBack: screenStates.currentScreen !== 'default',
        needShowHistory: false, // screenStates.currentScreen === 'enter-addr',
      },
    };
  }, [
    screenStates,
    fnCloseModal,
    fnNavTo,
    cbOnScanStageChanged,
    cbOnSelectedAccount,
  ]);

  const screenStyles = ['select-from-history', 'view-sent-tx'].includes(
    screenStates.currentScreen,
  )
    ? {
        container: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-2']
            : colors2024['neutral-bg-1'],
        },
        handle: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-2']
            : colors2024['neutral-bg-1'],
        },
        title: undefined,
      }
    : ['scan-qr-code'].includes(screenStates.currentScreen)
    ? {
        // container: { backgroundColor: colors2024['neutral-bg-0'], },
        // handle: { backgroundColor: colors2024['neutral-bg-0'], },
        // title: { color: colors2024['neutral-title-2'] },
        container: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-1']
            : colors2024['neutral-bg-0'],
        },
        handle: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-1']
            : colors2024['neutral-bg-0'],
        },
        title: { color: undefined },
      }
    : {
        container: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-1']
            : colors2024['neutral-bg-0'],
        },
        handle: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-1']
            : colors2024['neutral-bg-0'],
        },
      };

  return (
    <AppBottomSheetModal
      ref={sheetModalRef}
      // index={SNAPSHOTS.length - 2}
      snapPoints={SNAPSHOTS}
      enablePanDownToClose={
        IS_IOS ? true : ['default'].includes(screenStates.currentScreen)
      }
      backgroundStyle={{ backgroundColor: 'transparent' }}
      enableDismissOnClose={SNAPSHOTS.length === 1}
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustPan"
      handleStyle={[screenStyles.handle].filter(Boolean)}
      onChange={index => {
        const isHidden = index <= 0;
        if (isHidden && !screenStates.isScanning) {
          resetScreenStates();
          Keyboard.dismiss();
        }

        const isVisible = index >= SNAPSHOTS.length - 1;
        if (!isVisible) {
          onVisibleChange?.(false);
        }
      }}>
      <AutoLockView
        as="View"
        style={[
          styles.container,
          screenStyles.container,
          {
            paddingBottom: safeSizes.containerPb,
          },
        ]}>
        <AccountSelectModalProvider value={providerValues}>
          <View style={styles.modalHeader}>
            <View style={[styles.headerIconPlaceholder, styles.navBack]}>
              {!!providerValues.computed.canNavBack && (
                <Pressable
                  disabled={!providerValues.computed.canNavBack}
                  onPress={onPressNavBack}>
                  <RcIconNavLeft
                    color={screenStyles.title?.color}
                    width={24}
                    height={24}
                  />
                </Pressable>
              )}
            </View>
            <Text style={[styles.title, screenStyles.title]}>{modalTitle}</Text>
            <View style={[styles.headerIconPlaceholder, styles.rightIcon]}>
              {!!providerValues.computed.needShowHistory && (
                <Pressable
                  disabled={!providerValues.computed.needShowHistory}
                  onPress={() => {
                    touchedFeedback();
                    fnNavTo('select-from-history');
                  }}>
                  <RcIconHistory width={24} height={24} />
                </Pressable>
              )}
            </View>
          </View>
          <View style={styles.mainContainer}>
            {currentScreen === 'default' && (
              <AccountsPanelInSheetModal
                parentVisible={!!visible}
                scene="SendTo"
              />
            )}
            {currentScreen === 'enter-addr' && (
              <ScreenPanelEnterAddress
                onCleanupInput={() => {
                  fnNavTo('default');
                }}
                newValue={screenStates.nextInitValues['enter-addr'].inputValue}
              />
            )}
            {currentScreen === 'add-new-whitelist-addr' && (
              <ScreenAddNewWhitelistAddress
                newValue={screenStates.nextInitValues['add-new-whitelist-addr']}
              />
            )}
            {currentScreen === 'select-from-history' && <ScreenSentHistory />}
            {currentScreen === 'view-sent-tx' && <ScreenHistoryLocalDetail />}
            {currentScreen === 'scan-qr-code' && <ScreenPanelScanner />}
          </View>
        </AccountSelectModalProvider>
      </AutoLockView>
    </AppBottomSheetModal>
  );
}

const SIZES = {
  ITEM_HEIGHT: 72,
  ITEM_GAP: 12,
  titleMt: 6,
  titleHeight: 24,
  titleMb: 0,
  HANDLE_HEIGHT: 8,
  containerPt: 20,
  containerPb: 0,
  listBottomSpace: 48,
};
const getStyle = createGetStyles2024(ctx => {
  return {
    container: {
      flex: 1,
      paddingVertical: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      height: '100%',
      paddingTop: SIZES.containerPt,
      paddingBottom: SIZES.containerPb,
      // ...makeDebugBorder('blue')
    },
    containerGrayStyle: {
      backgroundColor: ctx.colors2024['neutral-bg-0'],
    },
    handleGrayStyle: {
      backgroundColor: ctx.colors2024['neutral-bg-0'],
    },
    containerBlackStyle: {
      backgroundColor: ctx.colors2024['neutral-black'],
    },
    handleBlackStyle: {
      backgroundColor: ctx.colors2024['neutral-black'],
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      flexShrink: 0,
      paddingHorizontal: SelectAccountSheetModalSizes.sectionPx,
    },
    headerIconPlaceholder: {
      width: 48,
      height: 24,
      // ...makeDebugBorder(),
    },
    navBack: {
      alignItems: 'flex-start',
    },
    rightIcon: {
      alignItems: 'flex-end',
    },
    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      fontWeight: FontWeightEnum.heavy,
      lineHeight: 20,
      color: ctx.colors2024['neutral-title-1'],
      textAlign: 'center',

      marginTop: SIZES.titleMt,
      minHeight: SIZES.titleHeight,
      marginBottom: SIZES.titleMb,
      // ...makeDebugBorder('red'),
    },
    mainContainer: {
      width: '100%',
      paddingHorizontal: 0,
      height: '100%',
      flexShrink: 1,
    },
  };
});
