import React, { memo, useCallback, useContext, useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { RootScenePagerUI } from '@rabby-wallet/rn-collapsible-scene-view';

import { apiContact } from '@/core/apis';
import type { PerpsViewMode } from '@/core/services/perpsService';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { PerpsHeader } from '../PerpsShared/components/PerpsHeader';
import { PERPS_HEADER_HEIGHT } from '../PerpsShared/constants';
import { resolvePerpsHeaderAccountLabel } from '../PerpsShared/utils/resolvePerpsHeaderAccountLabel';
import { usePerpsPopupState } from './hooks/usePerpsPopupState';
import type { PerpsRootHeaderAnimatedStyle } from './PerpsRootHeaderPresentation';

type Props = {
  activeMode: PerpsViewMode;
  interactive: boolean;
  navigationEnabled?: boolean;
  pagerUI?: RootScenePagerUI;
  animatedStyle: PerpsRootHeaderAnimatedStyle;
  onSelectMode: (mode: PerpsViewMode) => void;
  onPressInPro?: () => void;
  onPressOutPro?: () => void;
  showProNewBadge?: boolean;
};

/** Only the common chrome lives here; account/popup consumers stay leaf-local. */
const HeaderContent = memo(function HeaderContent({
  activeMode,
  interactive,
  navigationEnabled = interactive,
  pagerUI,
  onSelectMode,
  onPressInPro,
  onPressOutPro,
  showProNewBadge,
}: Omit<Props, 'animatedStyle'>) {
  const account = perpsStore(state => state.currentPerpsAccount);
  const [popupState, setPopupState] = usePerpsPopupState();
  const contactAlias = useMemo(
    () => (account?.address ? apiContact.getAliasName(account.address) : null),
    [account?.address],
  );
  const accountLabel = useMemo(
    () => resolvePerpsHeaderAccountLabel(account, contactAlias),
    [account, contactAlias],
  );
  const selectMode = useCallback(
    (mode: PerpsViewMode) => {
      if (interactive && mode !== activeMode) {
        onSelectMode(mode);
      }
    },
    [activeMode, interactive, onSelectMode],
  );
  const pressInMode = useCallback(
    (mode: PerpsViewMode) => {
      if (interactive && activeMode === 'simple' && mode === 'pro') {
        onPressInPro?.();
      }
    },
    [activeMode, interactive, onPressInPro],
  );
  const pressOutMode = useCallback(
    (mode: PerpsViewMode) => {
      // Always release a prepared intent, including a press cancelled by a drag.
      if (mode === 'pro') {
        onPressOutPro?.();
      }
    },
    [onPressOutPro],
  );
  const pressAccount = useCallback(() => {
    if (!interactive) {
      return;
    }
    setPopupState(current => ({
      ...current,
      isShowLoginPopup: !current.isShowLoginPopup,
    }));
  }, [interactive, setPopupState]);

  return (
    <PerpsHeader
      accountAddress={account?.address}
      accountBrandName={account?.brandName}
      accountExpanded={popupState.isShowLoginPopup}
      accountLabel={accountLabel}
      accountTriggerVariant="wallet-icon"
      activeMode={activeMode}
      businessControlsEnabled={interactive}
      extendProHitAreaRight={activeMode === 'simple'}
      isModeSwitching={!interactive}
      navigationEnabled={navigationEnabled}
      pagerUI={pagerUI}
      onPressAccount={account ? pressAccount : undefined}
      // UI-thread Root taps must not enqueue delayed JS navigation or optional
      // prewarm work. Pro's active initialization also covers cold swipes.
      onPressInMode={pagerUI ? undefined : pressInMode}
      onPressOutMode={pagerUI ? undefined : pressOutMode}
      onSelectMode={selectMode}
      showBottomDivider={false}
      showProNewBadge={activeMode === 'simple' && showProNewBadge}
      transparentBackground
    />
  );
});

// Business children update without rerendering the native animation host. This
// matches the existing Pro overlay's native-clock presentation contract.
const HeaderSlotContext = React.createContext<React.ReactNode>(null);
const HeaderSlot = () => useContext(HeaderSlotContext);
const headerSlot = <HeaderSlot />;
const NativeHeaderHost = memo(function NativeHeaderHost({
  animatedStyle,
}: {
  animatedStyle: PerpsRootHeaderAnimatedStyle;
}) {
  return (
    <Animated.View
      pointerEvents="box-none"
      style={animatedStyle}
      testID="perps-root-header-presentation">
      {headerSlot}
    </Animated.View>
  );
});

/**
 * A single transparent header outside the horizontal track. Page backgrounds
 * and the Pro wash remain inside their moving pages; decoration and controls
 * stay here. The Root supplies the shared native vertical presentation graph.
 */
export const PerpsRootHeader = memo(function PerpsRootHeader({
  animatedStyle,
  ...contentProps
}: Props) {
  const { safeTop } = useSafeSizes();
  const { interactive, navigationEnabled = interactive } = contentProps;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.clip, { top: safeTop }]}
      testID="perps-root-header-clip">
      <HeaderSlotContext.Provider
        value={
          <View
            collapsable={false}
            pointerEvents={navigationEnabled ? 'auto' : 'none'}
            accessibilityElementsHidden={!navigationEnabled}
            importantForAccessibility={
              navigationEnabled ? 'auto' : 'no-hide-descendants'
            }
            testID="perps-root-header-controls">
            <HeaderContent {...contentProps} />
          </View>
        }>
        <NativeHeaderHost animatedStyle={animatedStyle} />
      </HeaderSlotContext.Provider>
    </View>
  );
});

const styles = StyleSheet.create({
  clip: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: PERPS_HEADER_HEIGHT,
    overflow: 'hidden',
  },
});
