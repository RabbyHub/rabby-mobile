import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { StyleSheet, View, useAnimatedValue } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import {
  RootScenePager,
  type RootScenePageContext,
  type RootScenePagerProps,
} from '@rabby-wallet/rn-collapsible-scene-view';

import type { PerpsViewMode } from '@/core/services/perpsService';
import { StoreActivityBoundary } from '@/hooks/storeActivity/StoreActivityBoundary';
import { useRootPagerEnabled } from '@/hooks/useRootPagerEnabled';
import {
  getTopPerpsProSheetNavigationRegistration,
  subscribePerpsProSheetNavigation,
} from '../PerpsPro/components/common/perpsProSheetNavigationRegistry';
import { PerpsProScreen, type PerpsProScreenProps } from '../PerpsPro';
import {
  PerpsSimpleScreen,
  type PerpsSimpleScreenProps,
} from './PerpsSimpleScreen';
import { usePerpsPopupState } from './hooks/usePerpsPopupState';
import { usePerpsRootModeAdapter } from './hooks/usePerpsRootModeAdapter';
import type { PerpsRootModePreferenceSource } from './hooks/perpsRootModeAdapter';
import { PerpsRootHeader } from './PerpsRootHeader';
import {
  PerpsProRootHeaderWash,
  usePerpsRootHeaderPresentation,
} from './PerpsRootHeaderPresentation';

const MODES: readonly PerpsViewMode[] = ['simple', 'pro'];
const hasProSheet = () => getTopPerpsProSheetNavigationRegistration() !== null;

type Props = {
  preferenceSource: PerpsRootModePreferenceSource;
  presentationBlocked: boolean;
  onPreparePro: () => void;
  onPrepareSimple: () => void;
  simpleProps: Omit<
    PerpsSimpleScreenProps,
    'isModeSwitching' | 'onSwitchToPro' | 'sceneActive'
  >;
  proProps: Pick<PerpsProScreenProps, 'initialRegionAlertLayout'>;
};

const RetainedMode = memo(function RetainedMode({
  mode,
  context,
  prewarm,
  focused,
  simpleProps,
  proProps,
}: {
  mode: PerpsViewMode;
  context: RootScenePageContext;
  prewarm: boolean;
  focused: boolean;
  simpleProps: PerpsSimpleScreenProps;
  proProps: PerpsProScreenProps;
}) {
  const [mounted, setMounted] = useState(context.visible);
  if (!mounted && (prewarm || context.visible)) {
    setMounted(true);
  }
  // The saved mode is a return-visit preference, not business authorization.
  // Account, runtime and trade validation remain inside the active scene.
  const sceneActive = focused && context.selected;
  // Root previews retain their last display snapshot. `selected` changes only
  // on settlement; visibility, touch gating and preference saves must not
  // repeatedly wake display subscriptions while the track is moving.
  const displayActive = focused && context.selected;
  // Preview metadata must not fan out into a full business-tree render.
  const content = useMemo(
    () =>
      mode === 'simple' ? (
        <PerpsSimpleScreen {...simpleProps} sceneActive={sceneActive} />
      ) : (
        <PerpsProScreen {...proProps} sceneActive={sceneActive} />
      ),
    [mode, proProps, sceneActive, simpleProps],
  );
  return mounted ? (
    <StoreActivityBoundary active={displayActive} label={`perps-root:${mode}`}>
      <View
        // Keep children under the same native parent as touch gating changes.
        // testID retains this View, but does not prevent Fabric from flattening
        // its children when pointerEvents switches between auto and none.
        collapsable={false}
        style={styles.container}
        pointerEvents={sceneActive && context.interactive ? 'auto' : 'none'}
        testID={`perps-root-business-${mode}`}>
        {content}
      </View>
    </StoreActivityBoundary>
  ) : null;
});

/** Mount after preference hydration so a saved Pro visit never flashes Simple. */
export const PerpsRootPager = memo(function PerpsRootPager({
  preferenceSource,
  presentationBlocked,
  onPreparePro,
  onPrepareSimple,
  simpleProps,
  proProps,
}: Props) {
  const focused = useIsFocused();
  const baseEnabled = useRootPagerEnabled(focused);
  const [popupState] = usePerpsPopupState();
  const proSheetVisible = useSyncExternalStore(
    subscribePerpsProSheetNavigation,
    hasProSheet,
    hasProSheet,
  );
  const mode = usePerpsRootModeAdapter(preferenceSource);
  const proNativeScrollY = useAnimatedValue(0);
  const headerPresentation = usePerpsRootHeaderPresentation(
    proNativeScrollY,
    mode.settledMode,
  );
  const { requestMode, onSettled: settleMode } = mode;
  const [prewarm, setPrewarm] = useState(false);
  const enabled =
    baseEnabled &&
    !presentationBlocked &&
    !proSheetVisible &&
    !Object.values(popupState).some(Boolean);

  useEffect(() => {
    if (!enabled || prewarm) {
      return;
    }
    const idle = requestIdleCallback(() => setPrewarm(true));
    return () => cancelIdleCallback(idle);
  }, [enabled, prewarm]);

  const prepare = useCallback(
    (key: PerpsViewMode) => {
      if (key === 'pro') {
        onPreparePro();
      } else {
        onPrepareSimple();
      }
    },
    [onPreparePro, onPrepareSimple],
  );
  const requestPro = useCallback(() => {
    prepare('pro');
    requestMode('pro');
  }, [requestMode, prepare]);
  const requestSimple = useCallback(() => {
    prepare('simple');
    requestMode('simple');
  }, [requestMode, prepare]);
  const onSettled = useCallback(
    (key: string) => {
      if (key !== 'simple' && key !== 'pro') {
        return;
      }
      prepare(key);
      settleMode(key);
    },
    [settleMode, prepare],
  );

  const simple = useMemo(
    () => ({
      ...simpleProps,
      sharedHeader: true,
      isModeSwitching: false,
      onSwitchToPro: requestPro,
    }),
    [requestPro, simpleProps],
  );
  const pro = useMemo(
    () => ({
      ...proProps,
      sharedHeaderNativeScrollY: proNativeScrollY,
      isModeSwitching: false,
      onSwitchToSimple: requestSimple,
    }),
    [proNativeScrollY, proProps, requestSimple],
  );
  const selectMode = useCallback(
    (key: PerpsViewMode) => {
      if (key === 'pro') {
        requestPro();
      } else {
        requestSimple();
      }
    },
    [requestPro, requestSimple],
  );
  const renderOverlay = useCallback<
    NonNullable<RootScenePagerProps['renderOverlay']>
  >(
    context => (
      <PerpsRootHeader
        activeMode={context.selectedKey as PerpsViewMode}
        interactive={focused && context.interactive && !presentationBlocked}
        navigationEnabled={enabled}
        pagerUI={context.ui}
        animatedStyle={headerPresentation.headerStyle}
        onSelectMode={selectMode}
        onPressInPro={simpleProps.onPressInPro}
        onPressOutPro={simpleProps.onPressOutPro}
        showProNewBadge={simpleProps.showProNewBadge}
      />
    ),
    [
      enabled,
      focused,
      presentationBlocked,
      headerPresentation.headerStyle,
      selectMode,
      simpleProps.onPressInPro,
      simpleProps.onPressOutPro,
      simpleProps.showProNewBadge,
    ],
  );
  const renderPage = useCallback<RootScenePagerProps['renderPage']>(
    (key, context) => (
      <View style={styles.container}>
        <RetainedMode
          mode={key as PerpsViewMode}
          context={context}
          prewarm={prewarm}
          focused={focused}
          simpleProps={simple}
          proProps={pro}
        />
        {key === 'pro' ? (
          <PerpsProRootHeaderWash
            animatedStyle={headerPresentation.backdropStyle}
          />
        ) : null}
      </View>
    ),
    [focused, headerPresentation.backdropStyle, prewarm, pro, simple],
  );

  return (
    <View style={styles.container}>
      <RootScenePager
        keys={MODES}
        requestedKey={mode.requestedKey}
        onSettled={onSettled}
        renderPage={renderPage}
        renderOverlay={renderOverlay}
        enabled={enabled}
        testID="perps-root"
      />
    </View>
  );
});

const styles = StyleSheet.create({ container: { flex: 1 } });
