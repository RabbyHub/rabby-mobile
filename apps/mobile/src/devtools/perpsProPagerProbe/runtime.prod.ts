import type { PerpsProInfoTab } from '@/core/services/perpsService';

import type {
  PerpsProPagerProbeEventKind,
  PerpsProPagerProbeListRef,
  PerpsProPagerProbePayload,
  PerpsProPagerProbeStatus,
} from './contracts';

export const PERPS_PRO_PAGER_PROBE_AVAILABLE = false;

const PROD_STATUS: PerpsProPagerProbeStatus = Object.freeze({
  bytes: 0,
  droppedEvents: 0,
  eventCount: 0,
  sessionId: null,
  state: 'idle',
});

export const subscribePerpsProPagerProbe = (_listener: () => void) => () => {};
export const getPerpsProPagerProbeStatus = () => PROD_STATUS;
export const isPerpsProPagerProbeCapturing = () => false;
export const recordPerpsProPagerProbeEvent = (
  _kind: PerpsProPagerProbeEventKind,
  _payload: PerpsProPagerProbePayload = {},
) => false;
export const registerPerpsProPagerProbeListRef = (
  _tab: PerpsProInfoTab,
  _ref: PerpsProPagerProbeListRef | null,
) => {};
export const capturePerpsProPagerProbeNativeSnapshot = (
  _tab: PerpsProInfoTab,
  _checkpoint: string,
  _extra?: PerpsProPagerProbePayload,
  _ref?: PerpsProPagerProbeListRef | null,
) => {};
export const schedulePerpsProPagerProbeNativeSnapshots = (
  _tab: PerpsProInfoTab,
  _checkpoint: string,
  _extra?: PerpsProPagerProbePayload,
) => {};
export const recordPerpsProPagerProbeCoordinatorState = (
  _payload: PerpsProPagerProbePayload,
) => {};
export const startPerpsProPagerProbeCapture = () => false;
export const markPerpsProPagerProbeIncident = (
  _marker: 'blank' | 'recovered',
) => {};
export const stopAndSharePerpsProPagerProbeCapture = async () => false;
