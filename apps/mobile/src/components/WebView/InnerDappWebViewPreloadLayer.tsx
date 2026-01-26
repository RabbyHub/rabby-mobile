import React, { useEffect, useMemo, useState } from 'react';
import { InteractionManager, StyleSheet, View } from 'react-native';

import { INNER_DAPP_LIST } from '@/components2024/DappFrameAccountHeader';
import { RootNames } from '@/constant/layout';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useInnerDappSelection } from '@/hooks/useInnerDappSelection';
import { useCurrentRouteName } from '@/hooks/navigation';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';

import DappWebViewCore from './DappWebViewCore';
import { useNavigation } from '@react-navigation/native';
import { useAppUnlocked } from '@/hooks/useLock';

type SceneKey = 'Lending' | 'Perps' | 'Prediction';

type PreloadItem = {
  scene: SceneKey;
  id: string;
  url?: string;
};

const DEFAULT_LENDING_ID = INNER_DAPP_LIST.LENDING[0]?.id ?? 'aave';
const DEFAULT_PERPS_ID = INNER_DAPP_LIST.PERPS[0]?.id ?? 'hyperliquid';
const DEFAULT_PREDICTION_ID = INNER_DAPP_LIST.PREDICTION[0]?.id ?? 'polymarket';

export default function InnerDappWebViewPreloadLayer() {
  const { safeOffHeader } = useSafeSizes();
  const { currentRouteName } = useCurrentRouteName();
  const { lending, perps } = useInnerDappSelection();
  const [readyRouteName, setReadyRouteName] = useState<string | null>(null);
  const { getIsAppUnlocked } = useAppUnlocked();

  const isTargetRoute =
    currentRouteName === RootNames.Lending ||
    currentRouteName === RootNames.Perps ||
    currentRouteName === RootNames.Prediction;

  useEffect(() => {
    if (!isTargetRoute) {
      setReadyRouteName(null);
      return;
    }

    setReadyRouteName(null);
    const task = InteractionManager.runAfterInteractions(() => {
      setReadyRouteName(currentRouteName ?? null);
    });

    return () => {
      task.cancel?.();
    };
  }, [currentRouteName, isTargetRoute]);

  const preloadItems = useMemo<PreloadItem[]>(() => {
    return [
      ...INNER_DAPP_LIST.PREDICTION.map(item => ({
        scene: 'Prediction',
        id: item.id,
        url: item.url,
      })),
      ...INNER_DAPP_LIST.LENDING.map(item => ({
        scene: 'Lending',
        id: item.id,
        url: item.url,
      })),
      ...INNER_DAPP_LIST.PERPS.map(item => ({
        scene: 'Perps',
        id: item.id,
        url: item.url,
      })),
    ] as PreloadItem[];
  }, []);

  const displayRouteName =
    readyRouteName && readyRouteName === currentRouteName
      ? readyRouteName
      : null;

  const activeScene: SceneKey | null =
    displayRouteName === RootNames.Lending
      ? 'Lending'
      : displayRouteName === RootNames.Perps
      ? 'Perps'
      : displayRouteName === RootNames.Prediction
      ? 'Prediction'
      : null;

  const activeId =
    activeScene === 'Lending'
      ? lending
      : activeScene === 'Perps'
      ? perps
      : activeScene === 'Prediction'
      ? DEFAULT_PREDICTION_ID
      : undefined;

  const shouldShowActiveWebView =
    activeScene === 'Lending'
      ? !!activeId && activeId !== DEFAULT_LENDING_ID
      : activeScene === 'Perps'
      ? !!activeId && activeId !== DEFAULT_PERPS_ID
      : activeScene === 'Prediction'
      ? !!activeId
      : false;

  const activeKey =
    shouldShowActiveWebView && activeScene && activeId
      ? `${activeScene}-${activeId}`
      : null;

  if (!getIsAppUnlocked()) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      {preloadItems.map(item => {
        if (!item.url) {
          return null;
        }

        const key = `${item.scene}-${item.id}`;
        const isActive = activeKey === key;
        const origin = safeGetOrigin(item.url) || item.url;

        return (
          <View
            key={key}
            pointerEvents={isActive ? 'auto' : 'none'}
            style={[
              styles.webviewContainer,
              { top: safeOffHeader },
              isActive ? styles.webviewVisible : styles.webviewHidden,
            ]}>
            <DappWebViewCore
              dappOrigin={origin}
              url={item.url}
              webviewKey={key}
              webviewActive={isActive}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  webviewContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  webviewHidden: {
    opacity: 0,
    zIndex: 0,
  },
  webviewVisible: {
    opacity: 1,
    zIndex: 1,
  },
});
