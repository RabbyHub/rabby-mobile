import type { PerpsProInfoTab } from '@/core/services/perpsService';

type PerpsProPagerProbeSharedValue<T> = {
  value: T;
};

export const PERPS_PRO_PAGER_PROBE_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  maxEventBytes: 4 * 1024,
  maxEvents: 800,
  maxPayloadEntries: 64,
  maxStringLength: 256,
} as const;

export type PerpsProPagerProbeScalar = boolean | number | string | null;

export type PerpsProPagerProbePayload = Record<
  string,
  PerpsProPagerProbeScalar
>;

export type PerpsProPagerProbeEventKind =
  | 'capture_started'
  | 'capture_stopped'
  | 'coordinator_state'
  | 'list_attached'
  | 'list_content_size'
  | 'list_layout'
  | 'manual_blank'
  | 'manual_recovered'
  | 'native_snapshot'
  | 'native_snapshot_error'
  | 'page_drag_started'
  | 'page_prepare'
  | 'page_selected'
  | 'page_selection_rejected'
  | 'page_set_requested'
  | 'pending_correction_applied'
  | 'pending_correction_queued'
  | 'list_scroll_end'
  | 'scroll_command'
  | 'tab_commit'
  | 'tab_request'
  | 'tab_request_frame';

export type PerpsProPagerProbeEvent = {
  elapsedMs: number;
  id: number;
  kind: PerpsProPagerProbeEventKind;
  payload: PerpsProPagerProbePayload;
  timestamp: number;
};

export type PerpsProPagerProbeCaptureState = 'capturing' | 'idle' | 'stopped';

export type PerpsProPagerProbeStatus = {
  bytes: number;
  droppedEvents: number;
  eventCount: number;
  sessionId: string | null;
  state: PerpsProPagerProbeCaptureState;
};

export type PerpsProPagerProbeExport = {
  droppedEvents: number;
  events: PerpsProPagerProbeEvent[];
  limits: typeof PERPS_PRO_PAGER_PROBE_LIMITS;
  metadata: PerpsProPagerProbePayload;
  schemaVersion: 1;
  sessionId: string;
  startedAt: number;
  stoppedAt: number | null;
  totalEventBytes: number;
};

export type PerpsProPagerProbeListRef = {
  getScrollableNode?: () => number | object | null;
};

export type PerpsProPagerProbeNativeSnapshot = PerpsProPagerProbePayload & {
  reactTag: number;
};

export type PerpsProPagerProbeRegisteredTab = PerpsProInfoTab;

export type PerpsProAndroidCoordinatorProbeInput = {
  controller: {
    activeIndex: PerpsProPagerProbeSharedValue<number>;
    epoch: PerpsProPagerProbeSharedValue<number>;
    pageGestureActive: PerpsProPagerProbeSharedValue<boolean>;
    targets: readonly {
      maxOffset: PerpsProPagerProbeSharedValue<number>;
      offset: PerpsProPagerProbeSharedValue<number>;
    }[];
    touchIntent: PerpsProPagerProbeSharedValue<number>;
    touchSessionId: PerpsProPagerProbeSharedValue<number>;
  };
  driverOffset: PerpsProPagerProbeSharedValue<number>;
  enabled: boolean;
  sessionActive: PerpsProPagerProbeSharedValue<boolean>;
  sessionEpoch: PerpsProPagerProbeSharedValue<number>;
  sessionTargetIndex: PerpsProPagerProbeSharedValue<number>;
  touchIntentState: PerpsProPagerProbeSharedValue<number>;
  visualOffset: PerpsProPagerProbeSharedValue<number>;
};
