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
import { Pressable, Text, View } from 'react-native';
import {
  AccountSelectModalProvider,
  SelectAccountSheetModalScreen,
  SelectAccountSheetModalValues,
} from './hooks';
import { RcIconHistory, RcIconNavLeft } from './icons';
import { useCreationWithShallowCompare } from '@/hooks/common/useMemozied';
import ScreenPanelEnterAddress from './modalScreens/EnterAddress';
import { SelectAccountSheetModalSizes } from './layout';

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
  onSelectAccount?: React.ComponentProps<
    typeof AccountsPanelInSheetModal
  >['onSelectAccount'];
}) {
  const { styles } = useTheme2024({ getStyle });

  const { sheetModalRef, toggleShowSheetModal } = useSheetModal(null);
  useEffect(() => {
    if (visible) {
      toggleShowSheetModal(!!visible ? 1 : false);
      // toggleShowSheetModal(true);
    } else {
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

  const [currentScreen, setCurrentScreen] =
    useState<SelectAccountSheetModalScreen>('default');

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

  const fnNavTo = useCallback((screen: SelectAccountSheetModalScreen) => {
    setCurrentScreen(screen);
  }, []);

  const cbOnScanStageChanged = useCallback(
    (stage: 'start' | 'end') => {
      switch (stage) {
        case 'start':
          onVisibleChange?.(false);
          break;
        case 'end':
          setTimeout(() => onVisibleChange?.(true), 300);
          break;
        default:
          break;
      }
    },
    [onVisibleChange],
  );

  const onPressNavBack = useCallback(() => {
    switch (currentScreen) {
      case 'default':
        break;
      case 'enter-addr':
        fnNavTo('default');
        break;
      case 'add-new-whitelist-addr':
      case 'select-from-history':
      case 'view-sent-tx':
        fnNavTo('default');
        break;
      default:
        break;
    }
  }, [currentScreen, fnNavTo]);

  const providerValues = useMemo<SelectAccountSheetModalValues>(() => {
    return {
      modalScreen: currentScreen,
      fnNavTo,
      cbOnScanStageChanged,
      computed: {
        canNavBack: currentScreen !== 'default',
        needShowHistory: currentScreen === 'enter-addr',
      },
    };
  }, [currentScreen, fnNavTo, cbOnScanStageChanged]);

  return (
    <AppBottomSheetModal
      ref={sheetModalRef}
      index={0}
      snapPoints={[1, '80%']}
      enablePanDownToClose={false}
      enableDismissOnClose={false}
      onChange={index => {
        const isVisible = index >= 0;
        if (!isVisible) {
          onVisibleChange?.(false);
        }
      }}>
      <AutoLockView
        as="View"
        style={[
          styles.container,
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
                scene="SendTo"
                onSelectAccount={onSelectAccount}
              />
            )}
            {currentScreen === 'enter-addr' && <ScreenPanelEnterAddress />}
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
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      paddingHorizontal: SelectAccountSheetModalSizes.sectionPx,
    },
    headerIconPlaceholder: { width: 24, height: 24 },
    navBack: {},
    rightIcon: {},
    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      fontWeight: FontWeightEnum.heavy,
      lineHeight: 24,
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
