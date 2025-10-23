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
import { Keyboard, Pressable, Text, View } from 'react-native';
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

function getDefaultScreenStates(): {
  isScanning: boolean;
  currentScreen: SelectAccountSheetModalScreen;
  viewingHistoryTxData: HistoryLocalDetailParams | null;
  nextInitValues: {
    'add-new-whitelist-addr': string;
    'enter-addr': {
      autoScan: boolean;
    };
  };
} {
  return {
    isScanning: false,
    currentScreen: 'default',
    viewingHistoryTxData: null,
    nextInitValues: {
      'add-new-whitelist-addr': '',
      'enter-addr': {
        autoScan: false,
      },
    },
  };
}
const SNAPSHOTS = [1, '80%'];
// const SNAPSHOTS = ['80%'];
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
  const { styles } = useTheme2024({ getStyle });

  const { sheetModalRef, toggleShowSheetModal } = useSheetModal(null);
  const mountRef = useRef(false);
  useEffect(() => {
    if (visible) {
      if (!mountRef.current) {
        toggleShowSheetModal(true);
        mountRef.current = true;
        setTimeout(() => {
          toggleShowSheetModal(SHOW_IDX);
        }, 300);
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
    containerBottomSpace: SIZES.containerPb,
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
          default:
          case 'SendFrom': {
            ret.modalTitle = t('page.selectAccountSheetModal.title.sendFrom');
            break;
          }
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
              autoScan: extra?.autoScan || false,
            };
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

  const cbOnScanStageChanged = useCallback(
    (stage: 'start' | 'end') => {
      switch (stage) {
        case 'start':
          setScreenStates(prev => ({ ...prev, isScanning: true }));
          onVisibleChange?.(false);
          break;
        case 'end':
          setTimeout(() => {
            setScreenStates(prev => ({ ...prev, isScanning: false }));
            onVisibleChange?.(true);
          }, 300);
          break;
        default:
          break;
      }
    },
    [onVisibleChange],
  );

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

  const [_simpleScreenStack, setSimpleScreenStack] = useState<
    SelectAccountSheetModalScreen[]
  >([screenStates.currentScreen]);

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
      default:
        break;
    }
  }, [currentScreen, fnNavTo]);

  const { onHardwareBackHandler } = useHandleBackPressClosable(
    useCallback(() => {
      const onHome = screenStates.currentScreen === 'default';
      if (visible && !onHome) {
        onPressNavBack();
      } else if (visible && onHome) {
        onVisibleChange?.(false);
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

  const useGrayBg = ['select-from-history', 'view-sent-tx'].includes(
    screenStates.currentScreen,
  );

  return (
    <AppBottomSheetModal
      ref={sheetModalRef}
      index={SNAPSHOTS.length - 1}
      snapPoints={SNAPSHOTS}
      enableContentPanningGesture={currentScreen === 'default'}
      enableDismissOnClose={false}
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustPan"
      handleStyle={[useGrayBg && styles.handleGrayStyle]}
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
          useGrayBg && styles.containerGrayStyle,
          {
            paddingBottom: safeSizes.containerBottomSpace,
          },
        ]}>
        <AccountSelectModalProvider value={providerValues}>
          <View style={styles.modalHeader}>
            <View style={[styles.headerIconPlaceholder, styles.navBack]}>
              {!!providerValues.computed.canNavBack && (
                <Pressable
                  disabled={!providerValues.computed.canNavBack}
                  onPress={onPressNavBack}>
                  <RcIconNavLeft width={24} height={24} />
                </Pressable>
              )}
            </View>
            <Text style={styles.title}>{modalTitle}</Text>
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
                  // back to default screen
                  fnNavTo('default');
                }}
                autoScan={screenStates.nextInitValues['enter-addr'].autoScan}
              />
            )}
            {currentScreen === 'add-new-whitelist-addr' && (
              <ScreenAddNewWhitelistAddress
                nextInitAddressValue={
                  screenStates.nextInitValues['add-new-whitelist-addr']
                }
              />
            )}
            {currentScreen === 'select-from-history' && <ScreenSentHistory />}
            {currentScreen === 'view-sent-tx' && <ScreenHistoryLocalDetail />}
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
  containerPb: 42,
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
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
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
    },
  };
});
