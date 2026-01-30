import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Image,
  InteractionManager,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerStateChangeEvent,
  State,
} from 'react-native-gesture-handler';

import {
  DappFrameAccountHeader_LAYOUT,
  INNER_DAPP_LIST,
} from '@/components2024/DappFrameAccountHeader';
import { RootNames, ScreenLayouts } from '@/constant/layout';
import { useInnerDappSelection } from '@/hooks/useInnerDappSelection';
import { useCurrentRouteName } from '@/hooks/navigation';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { WebViewProps } from 'react-native-webview';
import ViewShot from 'react-native-view-shot';
import { useTranslation } from 'react-i18next';

import DappWebViewCore, { DappWebViewProgressState } from './DappWebViewCore';
import { useAppUnlocked } from '@/hooks/useLock';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInnerDappLastUrl } from '@/hooks/useInnerDappLastUrl';
import { useInnerDappSnapshot } from '@/hooks/useInnerDappSnapshot';
import { navBack } from '@/hooks/navigation';
import { BrowserProgressBar } from '@/screens/Browser/BrowserScreen/components/BrowserTab/BrowserProgressBar';
import { getViewShotFilePath } from '@/utils/browser';
import { useInnerDappPreloadStrategy } from '@/config/innerDappPreloadStrategy';
import {
  normalizeMaxRetainedWebviews,
  useInnerDappPreloadRetention,
} from '@/config/innerDappPreloadRetention';
import { openapi } from '@/core/request';
import RcIconGlobeCC from '@/assets2024/icons/common/globe-cc.svg';
import { useTheme2024 } from '@/hooks/theme';
import { dappService } from '@/core/services';
import { createGetStyles2024 } from '@/utils/styles';

type SceneKey = 'Lending' | 'Perps' | 'Prediction';

type PreloadItem = {
  scene: SceneKey;
  id: string;
  url?: string;
};

type NavigationEvent = Parameters<
  NonNullable<WebViewProps['onNavigationStateChange']>
>[0];

type InnerDappWebViewPreloadLayerProps = {
  maxRetainedWebviews?: number;
  offscreenPreload?: boolean;
};

const DEFAULT_LENDING_ID = INNER_DAPP_LIST.LENDING[0]?.id ?? 'aave';
const DEFAULT_PERPS_ID = INNER_DAPP_LIST.PERPS[0]?.id ?? 'hyperliquid';
const DEFAULT_PREDICTION_ID = INNER_DAPP_LIST.PREDICTION[0]?.id ?? 'polymarket';

export default function InnerDappWebViewPreloadLayer({
  offscreenPreload = false,
}: InnerDappWebViewPreloadLayerProps) {
  const { top } = useSafeAreaInsets();
  const { currentRouteName } = useCurrentRouteName();
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const preloadStrategy = useInnerDappPreloadStrategy();
  const configuredMaxRetained = useInnerDappPreloadRetention();
  const { lending, perps } = useInnerDappSelection();
  const [readyRouteName, setReadyRouteName] = useState<string | null>(null);
  const [retainedKeys, setRetainedKeys] = useState<string[]>([]);
  const { getIsAppUnlocked } = useAppUnlocked();
  const { lastUrlByKey, setLastUrl } = useInnerDappLastUrl();
  const { snapshotByKey, saveSnapshot } = useInnerDappSnapshot();
  const activeKeyRef = useRef<string | null>(null);
  const viewShotRefs = useRef<Record<string, ViewShot | null>>({});
  const lastCaptureAtRef = useRef<Record<string, number>>({});
  const captureInFlightRef = useRef<Record<string, boolean>>({});
  const [progressByKey, setProgressByKey] = useState<
    Record<string, DappWebViewProgressState>
  >({});
  const [dappPermission, setDappPermission] = useState(true);
  const permissionRequestIdRef = useRef(0);

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
      ...INNER_DAPP_LIST.LENDING.filter(e => e.id !== 'aave').map(item => ({
        scene: 'Lending',
        id: item.id,
        url: item.url,
      })),
      ...INNER_DAPP_LIST.PERPS.filter(e => e.id !== 'hyperliquid').map(
        item => ({
          scene: 'Perps',
          id: item.id,
          url: item.url,
        }),
      ),
    ] as PreloadItem[];
  }, []);

  const preloadItemsByKey = useMemo(() => {
    const map: Record<string, PreloadItem> = {};
    preloadItems.forEach(item => {
      if (!item.url) {
        return;
      }
      map[`${item.scene}-${item.id}`] = item;
    });
    return map;
  }, [preloadItems]);

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

  useEffect(() => {
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  const [initialUrlByKey, setInitialUrlByKey] = useState<
    Record<string, string>
  >({});

  const candidateMaxRetained = configuredMaxRetained;
  const resolvedMaxRetained = normalizeMaxRetainedWebviews(
    preloadStrategy === 'screen' ? 1 : candidateMaxRetained,
  );

  useEffect(() => {
    if (!activeKey) {
      return;
    }
    setRetainedKeys(prev => {
      const next = [activeKey, ...prev.filter(key => key !== activeKey)];
      return next.slice(0, resolvedMaxRetained);
    });
  }, [activeKey, resolvedMaxRetained]);

  useEffect(() => {
    setRetainedKeys(prev => prev.slice(0, resolvedMaxRetained));
  }, [resolvedMaxRetained]);

  useEffect(() => {
    if (!activeKey) {
      setDappPermission(true);
      return;
    }
    if (!getIsAppUnlocked()) {
      setDappPermission(true);
      return;
    }

    const activeItem = preloadItemsByKey[activeKey];
    if (!activeItem?.url || ['aave', 'hyperliquid'].includes(activeItem.id)) {
      setDappPermission(true);
      return;
    }
    const dappOrigin = safeGetOrigin(activeItem.url);
    const requestId = ++permissionRequestIdRef.current;
    const dappInfo = dappService.getDapp(dappOrigin);
    let cancelled = false;
    setDappPermission(true);

    openapi
      .getDappPermission({
        dapp: activeItem.id,
        id: dappInfo?.currentAccount?.address,
      })
      .then(result => {
        if (cancelled || requestId !== permissionRequestIdRef.current) {
          return;
        }

        setDappPermission(result.has_permission);
      })
      .catch(error => {
        console.error('getDappPermission', error);
      });

    return () => {
      cancelled = true;
    };
  }, [activeKey, getIsAppUnlocked, preloadItemsByKey]);

  const keysToRender = useMemo(() => {
    const limit = resolvedMaxRetained;
    const next: string[] = [];
    const seen = new Set<string>();
    const pushKey = (key?: string | null) => {
      if (!key || seen.has(key)) {
        return;
      }
      seen.add(key);
      next.push(key);
    };
    pushKey(activeKey);
    retainedKeys.forEach(pushKey);
    return next.slice(0, limit);
  }, [activeKey, retainedKeys, resolvedMaxRetained]);

  const keysToRenderSet = useMemo(() => {
    return new Set(keysToRender);
  }, [keysToRender]);

  useEffect(() => {
    setProgressByKey(prev => {
      const next: Record<string, DappWebViewProgressState> = {};
      keysToRender.forEach(key => {
        if (key in prev) {
          if (prev[key]) {
            next[key] = prev[key];
          }
        }
      });
      return next;
    });
  }, [keysToRender]);

  const captureSnapshot = useCallback(
    async (key: string, force = false) => {
      if (!key) {
        return;
      }
      if (activeKeyRef.current !== key) {
        return;
      }
      const now = Date.now();
      const last = lastCaptureAtRef.current[key] || 0;
      const throttleMs = 1500;
      if (!force && now - last < throttleMs) {
        return;
      }
      if (captureInFlightRef.current[key]) {
        return;
      }
      const viewShot = viewShotRefs.current[key];
      if (!viewShot?.capture) {
        return;
      }
      captureInFlightRef.current[key] = true;
      lastCaptureAtRef.current[key] = now;
      try {
        const tempUri = await viewShot.capture();
        if (tempUri) {
          await saveSnapshot(key, tempUri);
        }
      } catch (e) {
        console.error('captureSnapshot', e);
      } finally {
        captureInFlightRef.current[key] = false;
      }
    },
    [saveSnapshot],
  );

  const resolveRestoredUrl = useCallback(
    (baseUrl?: string, storedUrl?: string) => {
      if (!baseUrl) {
        return storedUrl;
      }
      if (!storedUrl) {
        return baseUrl;
      }
      const baseOrigin = safeGetOrigin(baseUrl) || baseUrl;
      const storedOrigin = safeGetOrigin(storedUrl) || storedUrl;
      if (!baseOrigin || !storedOrigin || baseOrigin !== storedOrigin) {
        return baseUrl;
      }
      return storedUrl;
    },
    [],
  );

  useEffect(() => {
    setInitialUrlByKey(prev => {
      let changed = false;
      const next = { ...prev };

      keysToRender.forEach(key => {
        if (next[key]) {
          return;
        }
        const item = preloadItemsByKey[key];
        if (!item?.url) {
          return;
        }
        const restoredUrl = resolveRestoredUrl(item.url, lastUrlByKey[key]);
        if (restoredUrl) {
          next[key] = restoredUrl;
          changed = true;
        }
      });

      Object.keys(next).forEach(key => {
        if (!keysToRenderSet.has(key)) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [
    keysToRender,
    keysToRenderSet,
    lastUrlByKey,
    preloadItemsByKey,
    resolveRestoredUrl,
  ]);

  const handleNavigationStateChange = useCallback(
    (key: string, baseUrl?: string) => {
      return (event: NavigationEvent) => {
        if (!baseUrl || !event?.url) {
          return;
        }
        if (activeKeyRef.current !== key) {
          return;
        }
        const baseOrigin = safeGetOrigin(baseUrl) || baseUrl;
        const nextOrigin = safeGetOrigin(event.url) || event.url;
        if (!baseOrigin || !nextOrigin || baseOrigin !== nextOrigin) {
          return;
        }
        setLastUrl(key, event.url);
      };
    },
    [setLastUrl],
  );

  const handleProgressStateChange = useCallback((key: string) => {
    return (state: DappWebViewProgressState) => {
      setProgressByKey(prev => {
        const prevState = prev[key];
        if (
          prevState &&
          prevState.isLoading === state.isLoading &&
          prevState.progress === state.progress
        ) {
          return prev;
        }
        return {
          ...prev,
          [key]: state,
        };
      });
    };
  }, []);

  const handleLoadEnd = useCallback(
    (key: string) => {
      return (event: Parameters<NonNullable<WebViewProps['onLoadEnd']>>[0]) => {
        if (!event.nativeEvent.loading) {
          captureSnapshot(key, true);
        }
      };
    },
    [captureSnapshot],
  );

  const handleEdgeBackSwipe = useCallback(
    (event: PanGestureHandlerStateChangeEvent) => {
      const { nativeEvent } = event;
      if (nativeEvent.state !== State.END) {
        return;
      }
      const swipeDistance = nativeEvent.translationX;
      const verticalDrift = Math.abs(nativeEvent.translationY);
      // const swipeVelocity = nativeEvent.velocityX;
      // console.log('handleEdgeBackSwipe', {
      //   swipeDistance,
      //   verticalDrift,
      //   swipeVelocity,
      // });

      if (swipeDistance > 60 && verticalDrift < 30) {
        navBack();
      }
    },
    [],
  );

  if (!getIsAppUnlocked()) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.overlay,
        {
          top: top + DappFrameAccountHeader_LAYOUT.height,
        },
      ]}>
      {preloadItems.map(item => {
        if (!item.url) {
          return null;
        }

        const key = `${item.scene}-${item.id}`;
        if (!keysToRenderSet.has(key)) {
          return null;
        }
        const isActive = activeKey === key;
        const origin = safeGetOrigin(item.url) || item.url;
        const resolvedUrl = initialUrlByKey[key] || item.url;
        const snapshotUri = snapshotByKey[key];
        const progressState = progressByKey[key];
        const isLoading = progressState?.isLoading;
        const shouldShowSnapshot =
          isActive &&
          !!snapshotUri &&
          isLoading !== false &&
          !progressState?.isError;
        const shouldShowPermissionUnavailable = isActive && !dappPermission;
        const shouldShowProgress =
          isActive && !!progressState?.isLoading && !progressState?.isError;

        return (
          <View
            key={key}
            pointerEvents={isActive ? 'auto' : 'none'}
            style={[
              styles.webviewContainer,
              // { top: top + 44 },
              isActive ? styles.webviewVisible : styles.webviewHidden,
            ]}>
            <View style={styles.webviewWrapper}>
              {isActive && offscreenPreload ? (
                <PanGestureHandler
                  enabled={isActive}
                  activeOffsetX={10}
                  failOffsetY={[-10, 10]}
                  onHandlerStateChange={handleEdgeBackSwipe}>
                  <View style={styles.edgeBackSwipeArea} />
                </PanGestureHandler>
              ) : null}
              <ViewShot
                ref={ref => {
                  if (ref) {
                    viewShotRefs.current[key] = ref;
                  } else {
                    delete viewShotRefs.current[key];
                  }
                }}
                style={styles.webviewWrapper}
                options={{
                  format: 'jpg',
                  quality: 0.35,
                }}>
                <DappWebViewCore
                  dappOrigin={origin}
                  url={resolvedUrl}
                  webviewKey={key}
                  webviewActive={isActive}
                  progressBar={() => null}
                  onProgressStateChange={handleProgressStateChange(key)}
                  onLoadEnd={handleLoadEnd(key)}
                  onNavigationStateChange={handleNavigationStateChange(
                    key,
                    item.url,
                  )}
                  offscreenPreload={offscreenPreload}
                />
              </ViewShot>
              {shouldShowSnapshot ? (
                <View
                  pointerEvents="none"
                  style={styles.snapshotOverlayContainer}>
                  <Image
                    source={{ uri: getViewShotFilePath(snapshotUri) }}
                    style={styles.snapshotOverlayImage}
                    resizeMode="cover"
                  />
                </View>
              ) : null}

              {shouldShowPermissionUnavailable ? (
                <View pointerEvents="auto" style={styles.permissionOverlay}>
                  <View style={styles.permissionCard}>
                    <View style={styles.permissionTextGroup}>
                      <RcIconGlobeCC color={'white'} width={24} height={24} />

                      <Text style={[styles.permissionTitle]}>
                        {t('page.dappPermission.serviceUnavailableTitle')}
                      </Text>
                    </View>
                    <Text style={[styles.permissionDesc]}>
                      {t('page.dappPermission.serviceUnavailableDesc')}
                    </Text>
                  </View>
                </View>
              ) : null}

              {shouldShowProgress ? (
                <BrowserProgressBar
                  progress={progressState?.progress ?? 0}
                  style={styles.progressOverlay}
                />
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  overlay: {
    ...StyleSheet.absoluteFillObject,

    zIndex: 20,
  },
  webviewContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  webviewWrapper: {
    flex: 1,
  },
  webviewHidden: {
    opacity: 0,
    zIndex: 0,
  },
  webviewVisible: {
    opacity: 1,
    zIndex: 1,
  },
  snapshotOverlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  snapshotOverlayImage: {
    flex: 1,
  },
  progressOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 3,
  },
  edgeBackSwipeArea: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 20,
    zIndex: 5,
  },
  permissionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 6,
  },
  permissionCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors2024['brand-default'],
    gap: 4,
  },
  permissionTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  permissionTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: '#fff',
  },
  permissionDesc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: '#fff',
  },
}));
