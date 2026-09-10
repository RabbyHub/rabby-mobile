const mockCaptureException = jest.fn();
const mockRequest = jest.fn();
const mockNetInfo: {
  state: { isConnected: boolean | null };
  listener: ((state: { isConnected: boolean | null }) => void) | null;
} = { state: { isConnected: true }, listener: null };

jest.mock('@sentry/react-native', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    // Mirrors NetInfo: the listener receives the current state on subscribe.
    addEventListener: (
      listener: (state: { isConnected: boolean | null }) => void,
    ) => {
      mockNetInfo.listener = listener;
      listener(mockNetInfo.state);
      return () => {
        mockNetInfo.listener = null;
      };
    },
  },
}));

jest.mock('@rabby-wallet/hyperliquid-sdk', () => {
  class HttpClient {
    async info(data: any) {
      return mockRequest('info', data);
    }
    async exchange(data: any) {
      return mockRequest('exchange', data);
    }
  }
  return { HttpClient };
});

import { HttpClient } from '@rabby-wallet/hyperliquid-sdk';
import type { WebSocketClient } from '@rabby-wallet/hyperliquid-sdk';
import { appMMKV } from '@/core/storage/mmkvInstances';
import { APP_MMKV_WEAK_KEYS } from '@/core/storage/mmkvConstants';
import {
  installPerpsSdkTimeoutReport,
  attachPerpsWsReconnectReport,
  PERPS_NET_OUTAGE_REPORT_AFTER_MS,
  PERPS_NET_OUTAGE_GAP_RESET_MS,
  PERPS_NET_REPORT_COOLDOWN_MS,
} from './perpsSdkNetworkReport';

const BASE_TIME = new Date('2026-09-09T00:00:00Z').getTime();
const SECOND = 1000;
const REPORT_AFTER = PERPS_NET_OUTAGE_REPORT_AFTER_MS;

const at = (ms: number) => jest.setSystemTime(BASE_TIME + ms);
const setDeviceOnline = (isConnected: boolean | null) => {
  mockNetInfo.state = { isConnected };
  mockNetInfo.listener?.(mockNetInfo.state);
};

const client = new HttpClient();
const callInfo = () =>
  client.info({ type: 'clearinghouseState' }).catch(() => {});
const callExchange = () =>
  client.exchange({ action: { type: 'order' } }).catch(() => {});
const failInfoAt = async (ms: number, message = 'Network request failed') => {
  at(ms);
  mockRequest.mockRejectedValueOnce(new Error(message));
  await callInfo();
};

beforeEach(() => {
  jest.useFakeTimers();
  at(0);
  appMMKV.delete(APP_MMKV_WEAK_KEYS.PERPS_NET_REPORT);
  mockCaptureException.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('installPerpsSdkTimeoutReport', () => {
  beforeAll(() => {
    installPerpsSdkTimeoutReport();
  });

  beforeEach(async () => {
    mockRequest.mockReset();
    setDeviceOnline(true);
    // A success closes any outage window left by the previous test.
    mockRequest.mockResolvedValueOnce('ok');
    await callInfo();
    mockCaptureException.mockClear();
  });

  it('does not report a burst of failures that has not lasted 60s', async () => {
    for (let i = 0; i < 6; i++) {
      await failInfoAt(i * 200);
    }
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('reports once failures have continued for 60s, with request context', async () => {
    await failInfoAt(0, 'Request timeout');
    await failInfoAt(30 * SECOND);
    await failInfoAt(REPORT_AFTER - 1);
    expect(mockCaptureException).not.toHaveBeenCalled();

    await failInfoAt(REPORT_AFTER + 5 * SECOND);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [error, hint] = mockCaptureException.mock.calls[0];
    expect(error.message).toBe('Hyperliquid API keeps failing');
    expect(hint.extra).toEqual({
      endpoint: 'info',
      requestType: 'clearinghouseState',
      lastError: 'Network request failed',
      failures: 4,
      outageMs: REPORT_AFTER + 5 * SECOND,
    });
  });

  it('does not report again while the same outage continues', async () => {
    await failInfoAt(0);
    await failInfoAt(REPORT_AFTER + SECOND);
    await failInfoAt(REPORT_AFTER + 10 * SECOND);
    await failInfoAt(2 * REPORT_AFTER + 10 * SECOND);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });

  it('a success resets the outage window', async () => {
    await failInfoAt(0);

    at(30 * SECOND);
    mockRequest.mockResolvedValueOnce('ok');
    await callInfo();

    await failInfoAt(40 * SECOND);
    await failInfoAt(40 * SECOND + REPORT_AFTER - 1);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('a non-network error resets the outage window', async () => {
    await failInfoAt(0);
    // An HTTP status error proves the API is reachable.
    await failInfoAt(30 * SECOND, 'HTTP 500: Internal Error');
    await failInfoAt(40 * SECOND);
    await failInfoAt(40 * SECOND + REPORT_AFTER - 1);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('the outage window spans info and exchange endpoints', async () => {
    await failInfoAt(0);

    at(REPORT_AFTER + SECOND);
    mockRequest.mockRejectedValueOnce(new Error('Network request timed out'));
    await callExchange();

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException.mock.calls[0][1].extra).toEqual({
      endpoint: 'exchange',
      requestType: 'order',
      lastError: 'Network request timed out',
      failures: 2,
      outageMs: REPORT_AFTER + SECOND,
    });
  });

  it('installing twice does not double-count failures', async () => {
    installPerpsSdkTimeoutReport();
    await failInfoAt(0);
    await failInfoAt(REPORT_AFTER + SECOND);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    // Double-wrapped methods would count each failure twice.
    expect(mockCaptureException.mock.calls[0][1].extra.failures).toBe(2);
  });

  it('does not report while the device is offline', async () => {
    setDeviceOnline(false);
    await failInfoAt(0);
    await failInfoAt(REPORT_AFTER + SECOND);
    await failInfoAt(2 * REPORT_AFTER + 2 * SECOND);
    expect(mockCaptureException).not.toHaveBeenCalled();

    // Back online: the outage clock only counts time spent online.
    setDeviceOnline(true);
    await failInfoAt(2 * REPORT_AFTER + 10 * SECOND);
    await failInfoAt(3 * REPORT_AFTER + 9 * SECOND);
    expect(mockCaptureException).not.toHaveBeenCalled();
    await failInfoAt(3 * REPORT_AFTER + 11 * SECOND);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});

describe('attachPerpsWsReconnectReport', () => {
  type Listener = (payload: any) => void;

  const makeFakeWs = () => {
    const listeners: Record<string, Listener[]> = {};
    const ws = {
      on: (event: string, listener: Listener) => {
        (listeners[event] ??= []).push(listener);
      },
    };
    const emit = (event: string, payload: any) =>
      listeners[event]?.forEach(listener => listener(payload));
    const failAt = (ms: number, attempt: number) => {
      at(ms);
      emit('reconnecting', { attempt, delayMs: 1000 });
    };
    return { ws: ws as unknown as WebSocketClient, emit, failAt };
  };

  beforeEach(() => {
    setDeviceOnline(true);
  });

  it('does not report a reconnect burst that has not lasted 60s', () => {
    const { ws, failAt } = makeFakeWs();
    attachPerpsWsReconnectReport(ws);

    [0, 3, 9, 21, 45].forEach((sec, i) => failAt(sec * SECOND, i + 1));
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('reports once the outage has lasted 60s, with outage context', () => {
    const { ws, failAt } = makeFakeWs();
    attachPerpsWsReconnectReport(ws);

    failAt(0, 1);
    failAt(20 * SECOND, 2);
    failAt(40 * SECOND, 3);
    failAt(REPORT_AFTER - 1, 4);
    expect(mockCaptureException).not.toHaveBeenCalled();

    failAt(REPORT_AFTER + 5 * SECOND, 5);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [error, hint] = mockCaptureException.mock.calls[0];
    expect(error.message).toBe('Hyperliquid WebSocket keeps reconnecting');
    expect(hint.extra).toEqual({
      attempt: 5,
      delayMs: 1000,
      outageMs: REPORT_AFTER + 5 * SECOND,
      everConnected: false,
    });
  });

  it('does not report again while the same outage continues', () => {
    const { ws, failAt } = makeFakeWs();
    attachPerpsWsReconnectReport(ws);

    failAt(0, 1);
    failAt(REPORT_AFTER + 5 * SECOND, 2);
    failAt(REPORT_AFTER + 40 * SECOND, 3);
    failAt(2 * REPORT_AFTER + 40 * SECOND, 4);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });

  it('a successful open resets the window and marks the next outage as a drop', () => {
    const { ws, emit, failAt } = makeFakeWs();
    attachPerpsWsReconnectReport(ws);

    failAt(0, 1);
    at(30 * SECOND);
    emit('open', { resubscribed: 2 });

    failAt(40 * SECOND, 1);
    failAt(40 * SECOND + REPORT_AFTER - 1, 2);
    expect(mockCaptureException).not.toHaveBeenCalled();

    failAt(40 * SECOND + REPORT_AFTER, 3);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException.mock.calls[0][1].extra).toMatchObject({
      everConnected: true,
      outageMs: REPORT_AFTER,
    });
  });

  it('does not report while the device is offline', () => {
    const { ws, failAt } = makeFakeWs();
    attachPerpsWsReconnectReport(ws);
    setDeviceOnline(false);

    failAt(0, 1);
    failAt(REPORT_AFTER + SECOND, 2);
    failAt(2 * REPORT_AFTER + 2 * SECOND, 3);
    expect(mockCaptureException).not.toHaveBeenCalled();

    // Back online: the outage clock only counts time spent online.
    setDeviceOnline(true);
    failAt(2 * REPORT_AFTER + 10 * SECOND, 4);
    failAt(3 * REPORT_AFTER + 9 * SECOND, 5);
    expect(mockCaptureException).not.toHaveBeenCalled();
    failAt(3 * REPORT_AFTER + 11 * SECOND, 6);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });

  it('a gap longer than the reset threshold starts a new outage window', () => {
    const { ws, failAt } = makeFakeWs();
    attachPerpsWsReconnectReport(ws);

    failAt(0, 1);
    // e.g. the app sat in the background; the SDK stops retrying there.
    const resumedAt = PERPS_NET_OUTAGE_GAP_RESET_MS + SECOND;
    failAt(resumedAt, 1);
    failAt(resumedAt + REPORT_AFTER - 1, 2);
    expect(mockCaptureException).not.toHaveBeenCalled();

    failAt(resumedAt + REPORT_AFTER, 3);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException.mock.calls[0][1].extra.outageMs).toBe(
      REPORT_AFTER,
    );
  });

  it('reports at most once per device per cooldown, across SDK instances', () => {
    const first = makeFakeWs();
    attachPerpsWsReconnectReport(first.ws);
    first.failAt(0, 1);
    first.failAt(REPORT_AFTER + SECOND, 2);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);

    // destroyPerpsSDK + rebuild (lock/unlock, relaunch) gives a fresh client.
    const second = makeFakeWs();
    attachPerpsWsReconnectReport(second.ws);
    second.failAt(REPORT_AFTER + 10 * SECOND, 1);
    second.failAt(2 * REPORT_AFTER + 11 * SECOND, 2);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);

    const third = makeFakeWs();
    attachPerpsWsReconnectReport(third.ws);
    const later = PERPS_NET_REPORT_COOLDOWN_MS + 10 * SECOND;
    third.failAt(later, 1);
    third.failAt(later + REPORT_AFTER + SECOND, 2);
    expect(mockCaptureException).toHaveBeenCalledTimes(2);
  });

  it('the WebSocket and HTTP cooldowns are independent', async () => {
    const { ws, failAt } = makeFakeWs();
    attachPerpsWsReconnectReport(ws);
    failAt(0, 1);
    failAt(REPORT_AFTER + SECOND, 2);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);

    installPerpsSdkTimeoutReport();
    mockRequest.mockReset();
    mockRequest.mockResolvedValueOnce('ok');
    await callInfo();
    await failInfoAt(REPORT_AFTER + 2 * SECOND);
    await failInfoAt(2 * REPORT_AFTER + 3 * SECOND);
    expect(mockCaptureException).toHaveBeenCalledTimes(2);
    expect(mockCaptureException.mock.calls[1][0].message).toBe(
      'Hyperliquid API keeps failing',
    );
  });

  it('reports when the SDK gives up reconnecting entirely', () => {
    const { ws, emit } = makeFakeWs();
    attachPerpsWsReconnectReport(ws);

    emit('reconnectFailed', { attempts: 10 });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException.mock.calls[0][0].message).toBe(
      'Hyperliquid WebSocket reconnect gave up',
    );
  });
});
