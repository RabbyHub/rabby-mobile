import { HttpClient, WebSocketClient } from '@rabby-wallet/hyperliquid-sdk';
import * as Sentry from '@sentry/react-native';

// The SDK's HttpClient converts its own abort-timer firing into exactly
// `new Error('Request timeout')` — the only timeout signature it produces.
const TIMEOUT_MESSAGE = 'Request timeout';

// A single timeout is routine on mobile networks. Only a streak of consecutive
// timeouts means the Hyperliquid official API is effectively unreachable.
const CONSECUTIVE_TIMEOUT_THRESHOLD = 5;

// With the SDK's 3s-base / 30s-cap jittered backoff, 5 straight failed
// reconnects means the WS endpoint has been unreachable for roughly a minute.
const WS_RECONNECT_ATTEMPT_THRESHOLD = 5;

let consecutiveTimeouts = 0;
let installed = false;

/**
 * The SDK keys active subscriptions by `JSON.stringify(subscription)`, so
 * user-scoped channels embed the wallet address (and other params). Reduce to
 * `{ type: count }` so the outage report carries no account identity.
 */
function summarizeSubscriptionTypes(keys: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  keys.forEach(key => {
    let type = 'unknown';
    try {
      const parsed = JSON.parse(key);
      if (typeof parsed?.type === 'string') {
        type = parsed.type;
      }
    } catch {
      // Not JSON — keep 'unknown' rather than leaking the raw key.
    }
    counts[type] = (counts[type] ?? 0) + 1;
  });
  return counts;
}

function trackRequestError(
  endpoint: 'info' | 'exchange',
  requestType: unknown,
  error: unknown,
) {
  if ((error as Error | null)?.message !== TIMEOUT_MESSAGE) {
    // A non-timeout failure (HTTP status / business error) means the network
    // path to the API works — break the streak.
    consecutiveTimeouts = 0;
    return;
  }
  consecutiveTimeouts += 1;
  // Report exactly once per streak, not on every request past the threshold.
  if (consecutiveTimeouts !== CONSECUTIVE_TIMEOUT_THRESHOLD) {
    return;
  }
  Sentry.captureException(
    new Error('Hyperliquid API consecutive request timeout'),
    {
      extra: {
        endpoint,
        requestType,
        consecutiveTimeouts,
      },
    },
  );
}

/**
 * Patch the SDK's HttpClient prototype so every Hyperliquid HTTP request goes
 * through one choke point: InfoClient and ExchangeClient each construct their
 * own HttpClient internally, so instance-level wrapping cannot cover both.
 * Reports to Sentry when the official API keeps timing out; a success or a
 * non-timeout error resets the streak. Install once, before the SDK is created.
 */
export function installPerpsSdkTimeoutReport() {
  if (installed) {
    return;
  }
  installed = true;
  (['info', 'exchange'] as const).forEach(endpoint => {
    const original = HttpClient.prototype[endpoint];
    HttpClient.prototype[endpoint] = async function (
      this: HttpClient,
      data: any,
    ) {
      try {
        const result = await original.call(this, data);
        consecutiveTimeouts = 0;
        return result;
      } catch (error) {
        // info bodies carry `type`; exchange bodies nest it in `action.type`.
        trackRequestError(endpoint, data?.type ?? data?.action?.type, error);
        throw error;
      }
    } as typeof original;
  });
}

/**
 * Report a Hyperliquid WebSocket outage to Sentry. The SDK resets its attempt
 * counter on every successful open, so `reconnecting.attempt` counts failed
 * reconnects within the current outage; report once per outage when it crosses
 * the threshold. Attach once per WebSocketClient instance, right after the SDK
 * is created (destroyPerpsSDK drops the instance, so a rebuilt SDK re-attaches
 * to its fresh client).
 */
export function attachPerpsWsReconnectReport(ws: WebSocketClient) {
  let reported = false;
  ws.on('reconnecting', ({ attempt, delayMs }) => {
    if (attempt < WS_RECONNECT_ATTEMPT_THRESHOLD || reported) {
      return;
    }
    reported = true;
    Sentry.captureException(
      new Error('Hyperliquid WebSocket keeps reconnecting'),
      {
        extra: {
          attempt,
          delayMs,
          subscriptionTypes: summarizeSubscriptionTypes(
            ws.getActiveSubscriptions(),
          ),
        },
      },
    );
  });
  ws.on('open', () => {
    reported = false;
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
