import type { PerpsProInfoTab } from '@/core/services/perpsService';
import { Dimensions, findNodeHandle, Platform } from 'react-native';

import {
  type PerpsProPagerProbeEventKind,
  type PerpsProPagerProbeListRef,
  type PerpsProPagerProbeNativeSnapshot,
  type PerpsProPagerProbePayload,
} from './contracts';
import { PerpsProPagerProbeStore } from './store';

export const PERPS_PRO_PAGER_PROBE_AVAILABLE = Platform.OS === 'android';

const store = new PerpsProPagerProbeStore();
const registeredListRefs = new Map<
  PerpsProInfoTab,
  PerpsProPagerProbeListRef
>();
const pendingNativeCaptures = new Set<Promise<void>>();

type ProbeNativeHelpers = {
  buildInfo?: {
    BUILD_GIT_HASH?: string;
  };
  getPerpsProPagerProbeSnapshot?: (
    reactTag: number,
  ) => Promise<PerpsProPagerProbeNativeSnapshot>;
};

const getProbeNativeHelpers = () =>
  (
    require('@/core/native/RNHelpers') as {
      default: ProbeNativeHelpers;
    }
  ).default;

const getScrollableReactTag = (
  ref: PerpsProPagerProbeListRef | null | undefined,
) => {
  if (!ref) {
    return null;
  }
  const scrollableNode = ref.getScrollableNode?.();
  if (typeof scrollableNode === 'number') {
    return scrollableNode;
  }
  return findNodeHandle((scrollableNode ?? ref) as never);
};

const trackNativeCapture = (capture: Promise<void>) => {
  pendingNativeCaptures.add(capture);
  capture.finally(() => pendingNativeCaptures.delete(capture));
};

const captureNativeSnapshot = async ({
  checkpoint,
  extra,
  ref,
  tab,
}: {
  checkpoint: string;
  extra?: PerpsProPagerProbePayload;
  ref: PerpsProPagerProbeListRef | null | undefined;
  tab: PerpsProInfoTab;
}) => {
  const status = store.getStatus();
  if (!store.isCapturing() || !status.sessionId) {
    return;
  }
  const sessionId = status.sessionId;
  let reactTag: number | null = null;

  try {
    reactTag = getScrollableReactTag(ref);
    if (reactTag == null) {
      store.record('native_snapshot_error', {
        checkpoint,
        reason: 'missing_scrollable_react_tag',
        tab,
        ...(extra ?? {}),
      });
      return;
    }
    const nativeHelpers = getProbeNativeHelpers();
    const getSnapshot = nativeHelpers.getPerpsProPagerProbeSnapshot;
    if (typeof getSnapshot !== 'function') {
      store.record('native_snapshot_error', {
        checkpoint,
        reactTag,
        reason: 'native_method_unavailable',
        tab,
        ...(extra ?? {}),
      });
      return;
    }
    const snapshot = await getSnapshot(reactTag);
    if (store.getStatus().sessionId !== sessionId) {
      return;
    }
    store.record('native_snapshot', {
      checkpoint,
      tab,
      ...snapshot,
      ...(extra ?? {}),
    });
  } catch (error) {
    if (store.getStatus().sessionId !== sessionId) {
      return;
    }
    store.record('native_snapshot_error', {
      checkpoint,
      reactTag,
      reason: error instanceof Error ? error.message : String(error),
      tab,
      ...(extra ?? {}),
    });
  }
};

const requestNativeSnapshot = (
  tab: PerpsProInfoTab,
  checkpoint: string,
  extra?: PerpsProPagerProbePayload,
  ref: PerpsProPagerProbeListRef | null | undefined = registeredListRefs.get(
    tab,
  ),
) => {
  if (!store.isCapturing()) {
    return;
  }
  trackNativeCapture(captureNativeSnapshot({ checkpoint, extra, ref, tab }));
};

export const subscribePerpsProPagerProbe = store.subscribe;
export const getPerpsProPagerProbeStatus = store.getStatus;
export const isPerpsProPagerProbeCapturing = store.isCapturing;

export const recordPerpsProPagerProbeEvent = (
  kind: PerpsProPagerProbeEventKind,
  payload: PerpsProPagerProbePayload = {},
) => store.record(kind, payload);

export const registerPerpsProPagerProbeListRef = (
  tab: PerpsProInfoTab,
  ref: PerpsProPagerProbeListRef | null,
) => {
  if (ref) {
    registeredListRefs.set(tab, ref);
  } else {
    registeredListRefs.delete(tab);
  }
};

export const capturePerpsProPagerProbeNativeSnapshot = (
  tab: PerpsProInfoTab,
  checkpoint: string,
  extra?: PerpsProPagerProbePayload,
  ref?: PerpsProPagerProbeListRef | null,
) => requestNativeSnapshot(tab, checkpoint, extra, ref);

export const schedulePerpsProPagerProbeNativeSnapshots = (
  tab: PerpsProInfoTab,
  checkpoint: string,
  extra?: PerpsProPagerProbePayload,
) => {
  if (!store.isCapturing()) {
    return;
  }
  requestNativeSnapshot(tab, `${checkpoint}:sync`, extra);
  requestAnimationFrame(() =>
    requestNativeSnapshot(tab, `${checkpoint}:raf`, extra),
  );
  setTimeout(
    () => requestNativeSnapshot(tab, `${checkpoint}:100ms`, extra),
    100,
  );
};

export const recordPerpsProPagerProbeCoordinatorState = (
  payload: PerpsProPagerProbePayload,
) => {
  if (!store.record('coordinator_state', payload)) {
    return;
  }
  const activeIndex = Number(payload.activeIndex);
  const tab = (['positions', 'openOrders', 'account'] as const)[activeIndex];
  if (tab) {
    requestNativeSnapshot(tab, 'coordinator_state', {
      coordinatorEpoch: Number(payload.epoch),
      privateTouchIntent: Number(payload.privateTouchIntent),
      publicTouchIntent: Number(payload.publicTouchIntent),
    });
  }
};

const captureAllRegisteredLists = (checkpoint: string) => {
  registeredListRefs.forEach((_ref, tab) =>
    requestNativeSnapshot(tab, checkpoint),
  );
};

export const startPerpsProPagerProbeCapture = () => {
  if (!PERPS_PRO_PAGER_PROBE_AVAILABLE) {
    return false;
  }
  try {
    const window = Dimensions.get('window');
    const screen = Dimensions.get('screen');
    const nativeHelpers = getProbeNativeHelpers();
    const DeviceInfo = (
      require('react-native-device-info') as {
        default: typeof import('react-native-device-info');
      }
    ).default;
    store.start({
      buildChannel: process.env.buildchannel ?? '',
      buildGitHash: nativeHelpers.buildInfo?.BUILD_GIT_HASH ?? '',
      deviceBrand: DeviceInfo.getBrand(),
      deviceModel: DeviceInfo.getModel(),
      platform: Platform.OS,
      platformVersion: String(Platform.Version),
      screenHeight: screen.height,
      screenScale: screen.scale,
      screenWidth: screen.width,
      windowHeight: window.height,
      windowScale: window.scale,
      windowWidth: window.width,
      systemVersion: DeviceInfo.getSystemVersion(),
    });
    captureAllRegisteredLists('capture_started');
    return true;
  } catch {
    return false;
  }
};

export const markPerpsProPagerProbeIncident = (
  marker: 'blank' | 'recovered',
) => {
  const kind = marker === 'blank' ? 'manual_blank' : 'manual_recovered';
  if (!store.record(kind, {})) {
    return;
  }
  captureAllRegisteredLists(kind);
};

export const stopAndSharePerpsProPagerProbeCapture = async () => {
  if (store.isCapturing()) {
    if (pendingNativeCaptures.size > 0) {
      await Promise.allSettled([...pendingNativeCaptures]);
    }
    store.stop();
  }
  const exported = store.export();
  if (!exported) {
    return false;
  }
  const requiredRNFS =
    require('@rabby-wallet/react-native-fs') as typeof import('@rabby-wallet/react-native-fs') & {
      default?: typeof import('@rabby-wallet/react-native-fs');
    };
  // react-native-fs is a direct CommonJS export at runtime, while some test
  // and transform environments wrap it in an ESM-shaped default export.
  const RNFS = requiredRNFS.default ?? requiredRNFS;
  const { shareLocalFile } =
    require('@/utils/shareLocalFile') as typeof import('@/utils/shareLocalFile');
  const tmpDir = RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath;
  if (!tmpDir) {
    throw new Error('Pager probe temporary directory is unavailable');
  }
  const tmpPath = `${tmpDir}/${exported.sessionId}.json`;
  await RNFS.writeFile(tmpPath, JSON.stringify(exported), 'utf8');
  await shareLocalFile({
    cleanupPaths: [tmpPath],
    message: `Perps Pro pager probe (${exported.events.length} events)`,
    mimeType: 'application/json',
    name: `${exported.sessionId}.json`,
    path: tmpPath,
    subject: 'Rabby Perps Pro Android pager probe',
    title: 'Share Perps Pro pager probe',
  });
  return true;
};
