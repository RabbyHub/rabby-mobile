import { useIsFocused } from '@react-navigation/native';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { useHideTipsPopup, useIsTipsPopupVisible } from '@/hooks/useTipsPopup';
import { usePerpsProSheetNavigationRegistration } from '@/screens/PerpsPro/components/common/perpsProSheetNavigationRegistry';
import {
  PERPS_PRO_FONT_FAMILY,
  getPerpsProFontStyle,
} from '@/screens/PerpsPro/components/common/perpsProVisual';
import { createGetStyles2024 } from '@/utils/styles';

import { PerpsProHistoryContentView } from './components/PerpsProHistoryContent';
import { PERPS_PRO_HISTORY_FEE_TIPS_OWNER } from './constants';
import { usePerpsProHistoryController } from './scene/usePerpsProHistoryController';
import type { PerpsProHistoryTab } from './types';

const HISTORY_SHEET_MAX_HEIGHT = 748;
const HISTORY_SHEET_TOP_GAP = 16;
const HISTORY_TITLE_FONT_STYLE = getPerpsProFontStyle(Platform.OS, '900');

export const getPerpsProHistorySheetHeight = ({
  topInset,
  windowHeight,
}: {
  topInset: number;
  windowHeight: number;
}) =>
  Math.min(
    HISTORY_SHEET_MAX_HEIGHT,
    Math.max(1, windowHeight - topInset - HISTORY_SHEET_TOP_GAP),
  );

export type PerpsProHistorySheetHostRef = {
  dismiss: () => void;
  present: (initialTab?: PerpsProHistoryTab) => void;
};

type HistorySheetSession = Readonly<{
  id: number;
}>;

export const PerpsProHistorySheetHost = forwardRef<
  PerpsProHistorySheetHostRef,
  Record<never, never>
>((_props, ref) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const nextSessionIdRef = useRef(0);
  const openingRef = useRef(false);
  const sessionRef = useRef<HistorySheetSession | null>(null);
  const focusedRef = useRef(false);
  const isFocused = useIsFocused();
  const { height: windowHeight } = useWindowDimensions();
  const { top: topInset } = useSafeAreaInsets();
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const hideFeeTipsPopup = useHideTipsPopup(PERPS_PRO_HISTORY_FEE_TIPS_OWNER);
  const isFeeTipsPopupVisible = useIsTipsPopupVisible(
    PERPS_PRO_HISTORY_FEE_TIPS_OWNER,
  );
  const [session, setSession] = useState<HistorySheetSession | null>(null);
  const [dataActive, setDataActive] = useState(false);
  const presentationActive = dataActive && isFocused;
  const history = usePerpsProHistoryController(
    'orders',
    presentationActive,
    isFocused,
    true,
  );
  const setHistoryActiveTab = history.setActiveTab;
  focusedRef.current = isFocused;

  const deactivateSession = useCallback(() => {
    setDataActive(false);
    hideFeeTipsPopup();
  }, [hideFeeTipsPopup]);

  const dismiss = useCallback(() => {
    if (!sessionRef.current) {
      return;
    }
    deactivateSession();
    if (openingRef.current) {
      openingRef.current = false;
      sessionRef.current = null;
      setSession(null);
      return;
    }
    modalRef.current?.dismiss();
  }, [deactivateSession]);

  const present = useCallback(
    (initialTab: PerpsProHistoryTab = 'orders') => {
      if (!focusedRef.current || openingRef.current || sessionRef.current) {
        return;
      }
      hideFeeTipsPopup();
      nextSessionIdRef.current += 1;
      const nextSession = {
        id: nextSessionIdRef.current,
      };
      setHistoryActiveTab(initialTab);
      openingRef.current = true;
      sessionRef.current = nextSession;
      setDataActive(true);
      setSession(nextSession);
    },
    [hideFeeTipsPopup, setHistoryActiveTab],
  );

  useImperativeHandle(ref, () => ({ dismiss, present }), [dismiss, present]);

  useEffect(() => {
    if (session) {
      openingRef.current = false;
      modalRef.current?.present();
    }
  }, [session]);

  useEffect(() => {
    if (!isFocused && session) {
      dismiss();
    }
  }, [dismiss, isFocused, session]);

  const handleAnimate = useCallback<
    NonNullable<React.ComponentProps<typeof AppBottomSheetModal>['onAnimate']>
  >(
    (_fromIndex, toIndex) => {
      if (toIndex === -1) {
        deactivateSession();
      } else if (sessionRef.current && focusedRef.current) {
        setDataActive(true);
      }
    },
    [deactivateSession],
  );

  const handleDismiss = useCallback(() => {
    deactivateSession();
    openingRef.current = false;
    sessionRef.current = null;
    setSession(null);
  }, [deactivateSession]);

  const registrationActive = isFocused && session !== null;
  usePerpsProSheetNavigationRegistration({
    active: registrationActive,
    dismiss,
  });
  usePerpsProSheetNavigationRegistration({
    active: registrationActive && isFeeTipsPopupVisible,
    dismiss: hideFeeTipsPopup,
    edgeDismissible: false,
  });

  const sheetHeight = useMemo(
    () =>
      getPerpsProHistorySheetHeight({
        topInset,
        windowHeight,
      }),
    [topInset, windowHeight],
  );
  const snapPoints = useMemo(() => [sheetHeight], [sheetHeight]);

  return (
    <AppBottomSheetModal
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg0',
      })}
      backdropProps={{ pressBehavior: 'close' }}
      backgroundStyle={styles.background}
      enableContentPanningGesture={false}
      enableDynamicSizing={false}
      enablePanDownToClose
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handle}
      onAnimate={handleAnimate}
      onDismiss={handleDismiss}
      ref={modalRef}
      snapPoints={snapPoints}
      style={styles.modal}>
      {session ? (
        <View
          key={session.id}
          style={styles.content}
          testID="perps-pro-history-sheet">
          <Text style={[styles.title, HISTORY_TITLE_FONT_STYLE]}>
            {t('page.perps.pro.history.title')}
          </Text>
          <View style={styles.pager}>
            <PerpsProHistoryContentView
              active={presentationActive}
              history={history}
              scrollHost="bottomSheet"
            />
          </View>
        </View>
      ) : null}
    </AppBottomSheetModal>
  );
});

PerpsProHistorySheetHost.displayName = 'PerpsProHistorySheetHost';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  background: {
    backgroundColor: colors2024['neutral-bg-0'],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handle: {
    backgroundColor: colors2024['neutral-bg-0'],
    height: 36,
    paddingBottom: 20,
    paddingTop: 10,
  },
  handleIndicator: {
    backgroundColor: colors2024['neutral-sheet-handle'],
    borderRadius: 3,
    height: 6,
    width: 50,
  },
  content: {
    backgroundColor: colors2024['neutral-bg-0'],
    flex: 1,
    paddingTop: 12,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: PERPS_PRO_FONT_FAMILY,
    fontSize: 20,
    lineHeight: 24,
    marginBottom: 20,
    marginHorizontal: 16,
    textAlign: 'center',
  },
  pager: {
    flex: 1,
  },
}));
