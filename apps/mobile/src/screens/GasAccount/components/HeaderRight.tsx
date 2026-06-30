import { RcIconGasAccountHeaderRight } from '@/assets/icons/gas-account';
import { useGetBinaryMode, useTheme2024, useThemeColors } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GestureResponderEvent,
  InteractionManager,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { TrackedModal } from '@/components/Modal/TrackedModal';
import {
  useAccountsWithGasAccountBalance,
  useGasAccountLoginVisible,
  useGasAccountSign,
} from '../hooks/atom';
import { createGetStyles2024 } from '@/utils/styles';
import {
  RcIconSwitchCC,
  RcIconWithdrawCC,
} from '@/assets2024/icons/gas-account';
import { Text } from '@/components/Typography';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

const MENU_MIN_WIDTH = 220;
const MENU_EDGE_PADDING = 16;
const MENU_RIGHT_FALLBACK = 24;
const MENU_TRIGGER_GAP = 4;
const MENU_TOP_ADJUST = 8;
const MENU_TOUCH_ANCHOR_SIZE = 32;

type AnchorLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function isFiniteLayout(layout?: AnchorLayout | null) {
  return (
    !!layout &&
    Number.isFinite(layout.x) &&
    Number.isFinite(layout.y) &&
    Number.isFinite(layout.width) &&
    Number.isFinite(layout.height) &&
    layout.width > 0 &&
    layout.height > 0
  );
}

export const GasAccountHeader: React.FC<{ showWithdraw: () => void }> = ({
  showWithdraw: openWithdrawPopup,
}) => {
  const color = useThemeColors();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef<View>(null);
  const pressAnchorRef = useRef<AnchorLayout | null>(null);
  const [triggerLayout, setTriggerLayout] = useState<AnchorLayout | null>(null);
  const [menuSize, setMenuSize] = useState({
    width: MENU_MIN_WIDTH,
    height: 0,
  });
  const { safeTop, safeOffHeader, safeOffBottom } = useSafeSizes();
  const windowDimensions = useWindowDimensions();
  const isDark = useGetBinaryMode() === 'dark';
  const { account } = useGasAccountSign();

  const accountsWithGasAccountBalance = useAccountsWithGasAccountBalance();
  const showSwitchWallet = useMemo(() => {
    if (!account?.address) {
      return accountsWithGasAccountBalance.length > 0;
    }
    return accountsWithGasAccountBalance.some(
      item =>
        !isSameAddress(item.address, account.address) ||
        item.type !== account.type,
    );
  }, [accountsWithGasAccountBalance, account?.address, account?.type]);

  const showWithdraw = !!account;
  const optionCount = Number(showWithdraw) + Number(showSwitchWallet);

  const [, setLoginVisible] = useGasAccountLoginVisible();

  const closeMenu = useCallback(() => {
    pressAnchorRef.current = null;
    setVisible(false);
  }, []);

  const handleWithdraw = useCallback(() => {
    closeMenu();
    openWithdrawPopup();
  }, [closeMenu, openWithdrawPopup]);

  const handleSwitch = useCallback(() => {
    closeMenu();
    setLoginVisible(true);
  }, [closeMenu, setLoginVisible]);

  const measureTrigger = useCallback(() => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const nextLayout = { x, y, width, height };
      if (isFiniteLayout(nextLayout)) {
        const pressAnchor = pressAnchorRef.current;
        setTriggerLayout(
          isFiniteLayout(pressAnchor)
            ? {
                ...nextLayout,
                y: pressAnchor.y,
                height: pressAnchor.height,
              }
            : nextLayout,
        );
      }
    });
  }, []);

  const handleOpen = useCallback(
    (event?: GestureResponderEvent) => {
      const { pageX, pageY } = event?.nativeEvent || {};
      if (Number.isFinite(pageX) && Number.isFinite(pageY)) {
        const pressAnchor = {
          x: pageX - MENU_TOUCH_ANCHOR_SIZE / 2,
          y: pageY - MENU_TOUCH_ANCHOR_SIZE / 2,
          width: MENU_TOUCH_ANCHOR_SIZE,
          height: MENU_TOUCH_ANCHOR_SIZE,
        };
        pressAnchorRef.current = pressAnchor;
        setTriggerLayout(pressAnchor);
      }
      setVisible(true);
      requestAnimationFrame(measureTrigger);
      InteractionManager.runAfterInteractions(measureTrigger);
    },
    [measureTrigger],
  );

  const estimatedMenuHeight = useMemo(() => {
    if (!optionCount) {
      return 0;
    }
    return 32 + optionCount * 20 + Math.max(0, optionCount - 1) * 15;
  }, [optionCount]);

  const menuPosition = useMemo(() => {
    const width = Math.max(menuSize.width || MENU_MIN_WIDTH, MENU_MIN_WIDTH);
    const height = menuSize.height || estimatedMenuHeight;
    const fallbackLeft = windowDimensions.width - MENU_RIGHT_FALLBACK - width;

    const measuredOnRight =
      isFiniteLayout(triggerLayout) &&
      triggerLayout.x + triggerLayout.width > windowDimensions.width / 2;

    const rawLeft = measuredOnRight
      ? triggerLayout!.x + triggerLayout!.width - width
      : fallbackLeft;

    const fallbackTop = safeOffHeader - MENU_TOP_ADJUST;
    const rawTop =
      isFiniteLayout(triggerLayout) && measuredOnRight
        ? triggerLayout!.y +
          triggerLayout!.height +
          MENU_TRIGGER_GAP -
          MENU_TOP_ADJUST
        : fallbackTop;

    return {
      left: clamp(
        rawLeft,
        MENU_EDGE_PADDING,
        windowDimensions.width - MENU_EDGE_PADDING - width,
      ),
      top: clamp(
        rawTop,
        safeTop + MENU_EDGE_PADDING,
        windowDimensions.height - safeOffBottom - MENU_EDGE_PADDING - height,
      ),
    };
  }, [
    estimatedMenuHeight,
    menuSize.height,
    menuSize.width,
    safeOffBottom,
    safeOffHeader,
    safeTop,
    triggerLayout,
    windowDimensions.height,
    windowDimensions.width,
  ]);

  if (showSwitchWallet || account) {
    return (
      <>
        <View ref={triggerRef} collapsable={false}>
          <CustomTouchableOpacity
            as="RNGHTouchableOpacity"
            style={styles.container}
            onPress={handleOpen}
            hitSlop={10}>
            <RcIconGasAccountHeaderRight />
          </CustomTouchableOpacity>
        </View>
        <TrackedModal
          modalId="gas-account-header-menu"
          blocking={false}
          transparent
          visible={visible}
          animationType="none"
          onShow={measureTrigger}
          onRequestClose={closeMenu}>
          <View pointerEvents="box-none" style={styles.modalRoot}>
            <Pressable
              style={[StyleSheet.absoluteFill, styles.modalBackdrop]}
              onPress={closeMenu}
            />
            <View
              onLayout={event => {
                const { width, height } = event.nativeEvent.layout;
                if (width > 0 && height > 0) {
                  setMenuSize({ width, height });
                }
              }}
              style={[
                styles.menuSurface,
                styles.tooltipStyle,
                {
                  left: menuPosition.left,
                  top: menuPosition.top,
                },
                isDark && { backgroundColor: color['neutral-bg-1'] },
              ]}>
              <View style={styles.optionList}>
                {showWithdraw ? (
                  <CustomTouchableOpacity
                    style={styles.option}
                    onPress={handleWithdraw}
                    hitSlop={10}>
                    <RcIconWithdrawCC
                      color={colors2024['neutral-body']}
                      style={styles.optionIcon}
                    />
                    <Text style={styles.text}>
                      {t('page.gasAccount.withdraw')}
                    </Text>
                  </CustomTouchableOpacity>
                ) : null}
                {showSwitchWallet ? (
                  <CustomTouchableOpacity
                    style={styles.option}
                    onPress={handleSwitch}
                    hitSlop={10}>
                    <RcIconSwitchCC
                      color={colors2024['neutral-body']}
                      style={styles.optionIcon}
                    />
                    <Text style={styles.text}>
                      {t('page.gasAccount.switchAccount')}
                    </Text>
                  </CustomTouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        </TrackedModal>
      </>
    );
  }
  return null;
};

const getStyles = createGetStyles2024(({ colors, colors2024 }) => ({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
  },
  modalBackdrop: {
    zIndex: 0,
  },
  menuSurface: {
    position: 'absolute',
    minWidth: MENU_MIN_WIDTH,
    backgroundColor: colors['neutral-card1'],
    borderRadius: 12,
    zIndex: 1,
  },
  optionList: {
    minWidth: 220,
    display: 'flex',
    flexDirection: 'column',
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 15,
  },
  option: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    gap: 8,
    alignItems: 'center',
  },
  tooltipStyle: {
    shadowColor: 'rgba(0,0,0,0.06)',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 1,
    shadowRadius: 20.7,
    elevation: 20,
    ...(Platform.OS === 'android'
      ? {
          boxShadow: '0px 10px 28px 0px rgba(25, 35, 60, 0.18)',
        }
      : {}),
  },
  optionIcon: {
    width: 16,
    height: 16,
  },
  text: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontStyle: 'normal',
    fontWeight: '700',
  },
}));
