import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { HttpClient, WebSocketClient } from '@rabby-wallet/hyperliquid-sdk';
import * as Sentry from '@sentry/react-native';
import { APP_MMKV_WEAK_KEYS } from '@/core/storage/mmkvConstants';
import { appMMKV } from '@/core/storage/mmkvInstances';

/**
 * Report only after Hyperliquid has kept failing for this long while the
 * device was online. The SDK's full-jitter backoff reaches its 5th reconnect
 * about 20s in on average (and can within seconds), so any attempt-count
 * threshold fires on the routine startup blip; a time floor does not.
 */
export const PERPS_NET_OUTAGE_REPORT_AFTER_MS = 60_000;

/**
 * Failures further apart than this are not one continuous outage. The SDK
 * retries at most every 30s while active but not at all in the background,
 * so a longer silence means the app was suspended in between.
 */
export const PERPS_NET_OUTAGE_GAP_RESET_MS = 120_000;

/**
 * Per-device, per-signal cooldown. A user whose network blocks Hyperliquid
 * would otherwise report on every launch and on every lock/unlock rebuild of
 * the SDK. A real outage still shows up as many distinct users reporting.
 */
export const PERPS_NET_REPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// The SDK's HttpClient rethrows every failure as a plain Error carrying only
// the message, so transport failures are recognised by message. `Request
// timeout` is the SDK's own abort timer; the other two are React Native's
// fetch rejections for a request that never got a response.
const TRANSPORT_FAILURE_MESSAGES = new Set([
  'Request timeout',
  'Network request failed',
  'Network request timed out',
]);

type ReportKind = 'ws' | 'http';

// ---------------------------------------------------------------------------
// Device connectivity
// ---------------------------------------------------------------------------

let lastNetInfo: NetInfoState | null = null;
let netInfoWatched = false;

function watchNetInfo() {
  if (netInfoWatched) {
    return;
  }
  netInfoWatched = true;
  NetInfo.addEventListener(state => {
    lastNetInfo = state;
  });
}

/**
 * Only `isConnected` is consulted. NetInfo's `isInternetReachable` probes a
 * Google URL by default, which reads as offline wherever that host is
 * blocked even though the network works.
 */
function isDeviceOffline() {
  return lastNetInfo?.isConnected === false;
}

// ---------------------------------------------------------------------------
// Per-device cooldown
// ---------------------------------------------------------------------------

type LastReportedAt = Partial<Record<ReportKind, number>>;

function readLastReportedAt(): LastReportedAt {
  const raw = appMMKV.getString(APP_MMKV_WEAK_KEYS.PERPS_NET_REPORT);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Claims the report slot for `kind`; false while its cooldown is running. */
function claimReportSlot(kind: ReportKind, now: number): boolean {
  const last = readLastReportedAt();
  const previous = last[kind];
  if (
    typeof previous === 'number' &&
    previous <= now &&
    now - previous < PERPS_NET_REPORT_COOLDOWN_MS
  ) {
    return false;
  }
  appMMKV.set(
    APP_MMKV_WEAK_KEYS.PERPS_NET_REPORT,
    JSON.stringify({ ...last, [kind]: now }),
  );
  return true;
}

// ---------------------------------------------------------------------------
// Outage window
// ---------------------------------------------------------------------------

type OutageContext = { outageMs: number; failures: number };

/**
 * A run of transport failures, each no more than the gap threshold apart,
 * observed while the device was online. Reports once per window, the first
 * time the run has lasted the report floor.
 */
class OutageWindow {
  private startedAt: number | null = null;
  private lastFailureAt = 0;
  private failures = 0;
  private reported = false;

  fail(now: number): OutageContext | null {
    if (isDeviceOffline()) {
      // Offline time is the device's outage, not Hyperliquid's.
      this.recover();
      return null;
    }
    if (
      this.startedAt === null ||
      now - this.lastFailureAt > PERPS_NET_OUTAGE_GAP_RESET_MS
    ) {
      this.startedAt = now;
      this.failures = 0;
      this.reported = false;
    }
    this.lastFailureAt = now;
    this.failures += 1;
    const outageMs = now - this.startedAt;
    if (this.reported || outageMs < PERPS_NET_OUTAGE_REPORT_AFTER_MS) {
      return null;
    }
    this.reported = true;
    return { outageMs, failures: this.failures };
  }

  recover() {
    this.startedAt = null;
    this.lastFailureAt = 0;
    this.failures = 0;
    this.reported = false;
  }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const httpOutage = new OutageWindow();
let installed = false;

function isTransportFailure(error: unknown) {
  return TRANSPORT_FAILURE_MESSAGES.has((error as Error | null)?.message ?? '');
}

function trackRequestError(
  endpoint: 'info' | 'exchange',
  requestType: unknown,
  error: unknown,
) {
  if (!isTransportFailure(error)) {
    // The API answered (HTTP status / business error): the network path works.
    httpOutage.recover();
    return;
  }
  const now = Date.now();
  const outage = httpOutage.fail(now);
  if (!outage || !claimReportSlot('http', now)) {
    return;
  }
  Sentry.captureException(new Error('Hyperliquid API keeps failing'), {
    extra: {
      endpoint,
      requestType,
      lastError: (error as Error).message,
      failures: outage.failures,
      outageMs: outage.outageMs,
    },
  });
}

/**
 * Patch the SDK's HttpClient prototype so every Hyperliquid HTTP request goes
 * through one choke point: InfoClient and ExchangeClient each construct their
 * own HttpClient internally, so instance-level wrapping cannot cover both.
 * Reports to Sentry when the official API keeps failing at the transport
 * level; a success or an answered request closes the outage. Install once,
 * before the SDK is created.
 */
export function installPerpsSdkTimeoutReport() {
  if (installed) {
    return;
  }
  installed = true;
  watchNetInfo();
  (['info', 'exchange'] as const).forEach(endpoint => {
    const original = HttpClient.prototype[endpoint];
    HttpClient.prototype[endpoint] = async function (
      this: HttpClient,
      data: any,
    ) {
      try {
        const result = await original.call(this, data);
        httpOutage.recover();
        return result;
      } catch (error) {
        // info bodies carry `type`; exchange bodies nest it in `action.type`.
        trackRequestError(endpoint, data?.type ?? data?.action?.type, error);
        throw error;
      }
    } as typeof original;
  });
}

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

/**
 * Report a Hyperliquid WebSocket outage to Sentry. Every failed connection —
 * the first one included — emits `reconnecting`, so the outage window starts
 * at the first failure and closes on `open`. Attach once per WebSocketClient
 * instance, right after the SDK is created (destroyPerpsSDK drops the
 * instance, so a rebuilt SDK re-attaches to its fresh client); the per-device
 * cooldown keeps rebuilds from re-reporting the same blocked network.
 */
export function attachPerpsWsReconnectReport(ws: WebSocketClient) {
  watchNetInfo();
  const outage = new OutageWindow();
  let everConnected = false;

  ws.on('reconnecting', ({ attempt, delayMs }) => {
    const now = Date.now();
    const context = outage.fail(now);
    if (!context || !claimReportSlot('ws', now)) {
      return;
    }
    Sentry.captureException(
      new Error('Hyperliquid WebSocket keeps reconnecting'),
      {
        extra: {
          attempt,
          delayMs,
          outageMs: context.outageMs,
          // false: never connected since the SDK was built (cold start with
          // Hyperliquid unreachable); true: an established socket dropped.
          everConnected,
        },
      },
    );
  });
  ws.on('open', () => {
    everConnected = true;
    outage.recover();
  });
  // Never fires with the default Infinity maxReconnectAttempts, but covers any
  // future config that makes the SDK give up for good.
  ws.on('reconnectFailed', ({ attempts }) => {
    Sentry.captureException(
      new Error('Hyperliquid WebSocket reconnect gave up'),
      {
        extra: { attempts },
      },
    );
  });
}
