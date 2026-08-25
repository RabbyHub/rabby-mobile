const mockCaptureException = jest.fn();
const mockRequest = jest.fn();

jest.mock('@sentry/react-native', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
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
import {
  installPerpsSdkTimeoutReport,
  attachPerpsWsReconnectReport,
} from './perpsSdkNetworkReport';

const client = new HttpClient();

const timeoutOnce = () =>
  mockRequest.mockRejectedValueOnce(new Error('Request timeout'));

const callInfo = () =>
  client.info({ type: 'clearinghouseState' }).catch(() => {});
const callExchange = () =>
  client.exchange({ action: { type: 'order' } }).catch(() => {});

const timeoutInfoTimes = async (n: number) => {
  for (let i = 0; i < n; i++) {
    timeoutOnce();
    await callInfo();
  }
};

describe('installPerpsSdkTimeoutReport', () => {
  beforeAll(() => {
    installPerpsSdkTimeoutReport();
  });

  beforeEach(async () => {
    mockRequest.mockReset();
    // A success resets the consecutive-timeout streak left by the previous test.
    mockRequest.mockResolvedValueOnce('ok');
    await callInfo();
    mockCaptureException.mockClear();
  });

  it('reports once after 5 consecutive timeouts, with request context', async () => {
    await timeoutInfoTimes(4);
    expect(mockCaptureException).not.toHaveBeenCalled();

    await timeoutInfoTimes(1);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [error, hint] = mockCaptureException.mock.calls[0];
    expect(error.message).toBe('Hyperliquid API consecutive request timeout');
    expect(hint.extra).toEqual({
      endpoint: 'info',
      requestType: 'clearinghouseState',
      consecutiveTimeouts: 5,
    });
  });

  it('does not report again while the same streak continues', async () => {
    await timeoutInfoTimes(8);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });

  it('a success resets the streak', async () => {
    await timeoutInfoTimes(4);

    mockRequest.mockResolvedValueOnce('ok');
    await callInfo();

    await timeoutInfoTimes(4);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('a non-timeout error resets the streak', async () => {
    await timeoutInfoTimes(4);

    mockRequest.mockRejectedValueOnce(new Error('HTTP 500: Internal Error'));
    await callInfo();

    await timeoutInfoTimes(4);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('the streak spans info and exchange endpoints', async () => {
    await timeoutInfoTimes(4);

    timeoutOnce();
    await callExchange();
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException.mock.calls[0][1].extra).toEqual({
      endpoint: 'exchange',
      requestType: 'order',
      consecutiveTimeouts: 5,
    });
  });

  it('installing twice does not double-count timeouts', async () => {
    installPerpsSdkTimeoutReport();
    // Double-wrapped methods would count each failure twice and report here.
    await timeoutInfoTimes(4);
    expect(mockCaptureException).not.toHaveBeenCalled();
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
      getActiveSubscriptions: () => ['allMids', 'webData2'],
    };
    const emit = (event: string, payload: any) =>
      listeners[event]?.forEach(listener => listener(payload));
    return { ws: ws as unknown as WebSocketClient, emit };
  };

  beforeEach(() => {
    mockCaptureException.mockClear();
  });

  it('reports once per outage when reconnect attempts reach the threshold', () => {
    const { ws, emit } = makeFakeWs();
    attachPerpsWsReconnectReport(ws);

    for (let attempt = 1; attempt <= 4; attempt++) {
      emit('reconnecting', { attempt, delayMs: 1000 });
    }
    expect(mockCaptureException).not.toHaveBeenCalled();

    emit('reconnecting', { attempt: 5, delayMs: 8000 });
    emit('reconnecting', { attempt: 6, delayMs: 16000 });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [error, hint] = mockCaptureException.mock.calls[0];
    expect(error.message).toBe('Hyperliquid WebSocket keeps reconnecting');
    expect(hint.extra).toEqual({
      attempt: 5,
      delayMs: 8000,
      activeSubscriptions: ['allMids', 'webData2'],
    });
  });

  it('a successful open starts a new outage that can report again', () => {
    const { ws, emit } = makeFakeWs();
    attachPerpsWsReconnectReport(ws);

    emit('reconnecting', { attempt: 5, delayMs: 8000 });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);

    emit('open', { resubscribed: 2 });
    emit('reconnecting', { attempt: 5, delayMs: 8000 });
    expect(mockCaptureException).toHaveBeenCalledTimes(2);
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
