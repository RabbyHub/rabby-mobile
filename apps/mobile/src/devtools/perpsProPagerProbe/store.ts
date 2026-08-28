import {
  PERPS_PRO_PAGER_PROBE_LIMITS,
  type PerpsProPagerProbeEvent,
  type PerpsProPagerProbeEventKind,
  type PerpsProPagerProbeExport,
  type PerpsProPagerProbePayload,
  type PerpsProPagerProbeScalar,
  type PerpsProPagerProbeStatus,
} from './contracts';

type StoreLimits = {
  maxBytes: number;
  maxEventBytes: number;
  maxEvents: number;
  maxPayloadEntries: number;
  maxStringLength: number;
};

type StoreOptions = {
  limits?: StoreLimits;
  now?: () => number;
};

const utf8ByteLength = (value: string) => {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);
    if (codePoint < 0x80) {
      bytes += 1;
    } else if (codePoint < 0x800) {
      bytes += 2;
    } else if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
};

const sanitizeScalar = (
  value: PerpsProPagerProbeScalar,
  maxStringLength: number,
): PerpsProPagerProbeScalar => {
  if (typeof value === 'string') {
    return value.slice(0, maxStringLength);
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  return value;
};

const sanitizePayload = (
  payload: PerpsProPagerProbePayload,
  limits: StoreLimits,
) =>
  Object.fromEntries(
    Object.entries(payload)
      .slice(0, limits.maxPayloadEntries)
      .map(([key, value]) => [
        key.slice(0, limits.maxStringLength),
        sanitizeScalar(value, limits.maxStringLength),
      ]),
  ) as PerpsProPagerProbePayload;

export class PerpsProPagerProbeStore {
  private bytes = 0;
  private droppedEvents = 0;
  private events: PerpsProPagerProbeEvent[] = [];
  private listeners = new Set<() => void>();
  private metadata: PerpsProPagerProbePayload = {};
  private nextEventId = 1;
  private readonly now: () => number;
  private readonly limits: StoreLimits;
  private sessionId: string | null = null;
  private startedAt = 0;
  private state: PerpsProPagerProbeStatus['state'] = 'idle';
  private stoppedAt: number | null = null;

  constructor(options: StoreOptions = {}) {
    this.limits = options.limits ?? PERPS_PRO_PAGER_PROBE_LIMITS;
    this.now = options.now ?? Date.now;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getStatus = (): PerpsProPagerProbeStatus => ({
    bytes: this.bytes,
    droppedEvents: this.droppedEvents,
    eventCount: this.events.length,
    sessionId: this.sessionId,
    state: this.state,
  });

  isCapturing = () => this.state === 'capturing';

  start = (metadata: PerpsProPagerProbePayload = {}) => {
    const startedAt = this.now();
    this.bytes = 0;
    this.droppedEvents = 0;
    this.events = [];
    this.metadata = sanitizePayload(metadata, this.limits);
    this.nextEventId = 1;
    this.sessionId = `perps-pro-pager-${startedAt}`;
    this.startedAt = startedAt;
    this.state = 'capturing';
    this.stoppedAt = null;
    this.record('capture_started', this.metadata);
    this.emit();
  };

  stop = () => {
    if (this.state !== 'capturing') {
      return;
    }
    this.record('capture_stopped', {});
    this.state = 'stopped';
    this.stoppedAt = this.now();
    this.emit();
  };

  record = (
    kind: PerpsProPagerProbeEventKind,
    payload: PerpsProPagerProbePayload,
  ) => {
    if (this.state !== 'capturing') {
      return false;
    }
    if (
      this.events.length >= this.limits.maxEvents ||
      this.bytes >= this.limits.maxBytes
    ) {
      this.droppedEvents += 1;
      this.emit();
      return false;
    }

    const timestamp = this.now();
    const event: PerpsProPagerProbeEvent = {
      elapsedMs: Math.max(0, timestamp - this.startedAt),
      id: this.nextEventId,
      kind,
      payload: sanitizePayload(payload, this.limits),
      timestamp,
    };
    const eventBytes = utf8ByteLength(JSON.stringify(event));
    if (
      eventBytes > this.limits.maxEventBytes ||
      this.bytes + eventBytes > this.limits.maxBytes
    ) {
      this.droppedEvents += 1;
      this.emit();
      return false;
    }

    this.events.push(event);
    this.bytes += eventBytes;
    this.nextEventId += 1;
    this.emit();
    return true;
  };

  export = (): PerpsProPagerProbeExport | null => {
    if (!this.sessionId) {
      return null;
    }
    return {
      droppedEvents: this.droppedEvents,
      events: [...this.events],
      limits: PERPS_PRO_PAGER_PROBE_LIMITS,
      metadata: { ...this.metadata },
      schemaVersion: 1,
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt,
      totalEventBytes: this.bytes,
    };
  };

  private emit = () => {
    this.listeners.forEach(listener => listener());
  };
}
