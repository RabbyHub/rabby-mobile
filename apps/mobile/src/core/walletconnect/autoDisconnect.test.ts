type AutoDisconnectModule = typeof import('./autoDisconnect');

type MockWalletKit = {
  getActiveSessions: jest.Mock;
  disconnectSession: jest.Mock;
};

const WALLETCONNECT_SETTINGS_KEY = '@walletConnectSettings';
const ONE_SECOND_IN_MINUTES = 1 / 60;

function makeWalletKit(topics: string[]): MockWalletKit {
  const sessions = Object.fromEntries(
    topics.map(topic => [topic, { topic }]),
  ) as Record<string, { topic: string }>;

  return {
    getActiveSessions: jest.fn(() => sessions),
    disconnectSession: jest.fn(async ({ topic }: { topic: string }) => {
      delete sessions[topic];
    }),
  };
}

function loadAutoDisconnectPolicy(
  input: {
    storedSettings?: unknown;
    defaultEnabled?: boolean;
    defaultInactiveMinutes?: number;
  } = {},
) {
  jest.resetModules();
  const storage = new Map<string, unknown>();
  if (typeof input.storedSettings !== 'undefined') {
    storage.set(WALLETCONNECT_SETTINGS_KEY, input.storedSettings);
  }
  jest.doMock('./constants', () => ({
    WalletConnectAutoDisconnect: input.defaultEnabled ?? true,
    WALLETCONNECT_AUTO_DISCONNECT_DEFAULT_INACTIVE_MINUTES:
      input.defaultInactiveMinutes ?? ONE_SECOND_IN_MINUTES,
  }));
  jest.doMock('@/core/storage/mmkv', () => ({
    appStorage: {
      getItem: jest.fn((key: string) =>
        storage.has(key) ? storage.get(key) : null,
      ),
      setItem: jest.fn((key: string, value: unknown) => {
        storage.set(key, value);
      }),
    },
  }));
  jest.doMock('@walletconnect/utils', () => ({
    getSdkError: () => ({
      code: 6000,
      message: 'User disconnected.',
    }),
  }));
  jest.doMock('./debugLog', () => ({
    addWalletConnectLog: jest.fn(),
  }));
  jest.doMock('./accountSelection', () => ({
    forgetWalletConnectAccountForTopic: jest.fn(),
  }));
  jest.doMock('./sessions', () => ({
    syncWalletConnectSessionsFromClient: jest.fn(),
  }));

  return require('./autoDisconnect') as AutoDisconnectModule;
}

async function flushTimers() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('walletconnect auto disconnect policy', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
    jest.dontMock('./constants');
    jest.dontMock('@/core/storage/mmkv');
    jest.dontMock('@walletconnect/utils');
    jest.dontMock('./debugLog');
    jest.dontMock('./accountSelection');
    jest.dontMock('./sessions');
  });

  it('uses true as the default auto-disconnect setting', async () => {
    const policy = loadAutoDisconnectPolicy();

    expect(policy.getWalletConnectAutoDisconnectEnabled()).toBe(true);
  });

  it('falls back to defaults when stored settings are invalid', async () => {
    const policy = loadAutoDisconnectPolicy({
      storedSettings: {
        autoDisconnect: {
          enabled: 'invalid',
          inactiveMinutes: 0,
        },
      },
      defaultInactiveMinutes: ONE_SECOND_IN_MINUTES,
    });

    expect(policy.getWalletConnectAutoDisconnectEnabled()).toBe(true);
    expect(policy.getWalletConnectAutoDisconnectInactiveMinutes()).toBe(
      ONE_SECOND_IN_MINUTES,
    );
  });

  it('uses the persisted inactive minute setting', async () => {
    const policy = loadAutoDisconnectPolicy({
      storedSettings: {
        autoDisconnect: {
          enabled: true,
          inactiveMinutes: 0.5,
        },
      },
    });

    expect(policy.getWalletConnectAutoDisconnectInactiveMinutes()).toBe(0.5);
  });

  it('keeps current behavior when persisted auto-disconnect is false', async () => {
    jest.useFakeTimers();
    const policy = loadAutoDisconnectPolicy({
      storedSettings: {
        autoDisconnect: {
          enabled: false,
        },
      },
    });
    const walletKit = makeWalletKit(['topic-1', 'topic-2']);

    await policy.disconnectRestoredWalletConnectSessionsForAutoDisconnect(
      walletKit as never,
    );
    await policy.replaceWalletConnectSessionsForAutoDisconnect(
      walletKit as never,
      'topic-2',
    );
    policy.recordWalletConnectSessionActivity(walletKit as never, 'topic-1');

    jest.advanceTimersByTime(1000);
    await flushTimers();

    expect(walletKit.disconnectSession).not.toHaveBeenCalled();
  });

  it('disconnects restored sessions on startup when enabled', async () => {
    const policy = loadAutoDisconnectPolicy();
    const { forgetWalletConnectAccountForTopic } =
      jest.requireMock('./accountSelection');
    const walletKit = makeWalletKit(['topic-1', 'topic-2']);

    await policy.disconnectRestoredWalletConnectSessionsForAutoDisconnect(
      walletKit as never,
    );

    expect(walletKit.disconnectSession).toHaveBeenCalledTimes(2);
    expect(walletKit.disconnectSession).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'topic-1' }),
    );
    expect(walletKit.disconnectSession).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'topic-2' }),
    );
    expect(forgetWalletConnectAccountForTopic).toHaveBeenCalledWith('topic-1');
    expect(forgetWalletConnectAccountForTopic).toHaveBeenCalledWith('topic-2');
  });

  it('replaces older sessions after a new session is approved', async () => {
    const policy = loadAutoDisconnectPolicy();
    const { forgetWalletConnectAccountForTopic } =
      jest.requireMock('./accountSelection');
    const walletKit = makeWalletKit(['old-topic', 'new-topic']);

    await policy.replaceWalletConnectSessionsForAutoDisconnect(
      walletKit as never,
      'new-topic',
    );

    expect(walletKit.disconnectSession).toHaveBeenCalledTimes(1);
    expect(walletKit.disconnectSession).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'old-topic' }),
    );
    expect(forgetWalletConnectAccountForTopic).toHaveBeenCalledWith(
      'old-topic',
    );
    expect(forgetWalletConnectAccountForTopic).not.toHaveBeenCalledWith(
      'new-topic',
    );
  });

  it('disconnects an active session after one inactivity window', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    const policy = loadAutoDisconnectPolicy({
      defaultInactiveMinutes: ONE_SECOND_IN_MINUTES,
    });
    const { forgetWalletConnectAccountForTopic } =
      jest.requireMock('./accountSelection');
    const walletKit = makeWalletKit(['topic-1']);

    policy.recordWalletConnectSessionActivity(walletKit as never, 'topic-1');
    jest.setSystemTime(999);
    jest.advanceTimersByTime(999);
    await flushTimers();
    expect(walletKit.disconnectSession).not.toHaveBeenCalled();

    jest.setSystemTime(1000);
    jest.advanceTimersByTime(1);
    await flushTimers();

    expect(walletKit.disconnectSession).toHaveBeenCalledTimes(1);
    expect(walletKit.disconnectSession).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'topic-1' }),
    );
    expect(forgetWalletConnectAccountForTopic).toHaveBeenCalledWith('topic-1');
  });

  it('uses configured inactive minutes for the inactivity window', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    const policy = loadAutoDisconnectPolicy({
      storedSettings: {
        autoDisconnect: {
          inactiveMinutes: ONE_SECOND_IN_MINUTES,
        },
      },
      defaultInactiveMinutes: 60,
    });
    const walletKit = makeWalletKit(['topic-1']);

    policy.recordWalletConnectSessionActivity(walletKit as never, 'topic-1');
    jest.setSystemTime(999);
    jest.advanceTimersByTime(999);
    await flushTimers();
    expect(walletKit.disconnectSession).not.toHaveBeenCalled();

    jest.setSystemTime(1000);
    jest.advanceTimersByTime(1);
    await flushTimers();

    expect(walletKit.disconnectSession).toHaveBeenCalledTimes(1);
  });

  it('reschedules pending inactive sessions when the expiry changes', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    const policy = loadAutoDisconnectPolicy({
      defaultInactiveMinutes: 60,
    });
    const walletKit = makeWalletKit(['topic-1']);

    policy.recordWalletConnectSessionActivity(walletKit as never, 'topic-1');
    jest.setSystemTime(30 * 1000);
    policy.setWalletConnectAutoDisconnectInactiveMinutes(
      0.25,
      walletKit as never,
    );
    jest.advanceTimersByTime(0);
    await flushTimers();

    expect(walletKit.disconnectSession).toHaveBeenCalledTimes(1);
  });

  it('does not disconnect pending inactive sessions after the setting is disabled', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    const policy = loadAutoDisconnectPolicy({
      defaultInactiveMinutes: ONE_SECOND_IN_MINUTES,
    });
    const walletKit = makeWalletKit(['topic-1']);

    policy.recordWalletConnectSessionActivity(walletKit as never, 'topic-1');
    policy.setWalletConnectAutoDisconnectEnabled(false);

    jest.setSystemTime(1000);
    jest.advanceTimersByTime(1000);
    await flushTimers();

    expect(policy.getWalletConnectAutoDisconnectEnabled()).toBe(false);
    expect(walletKit.disconnectSession).not.toHaveBeenCalled();
  });
});
