import { Observable, Subject, of } from 'rxjs';

const mockAddTransport = jest.fn();
const mockAddLogger = jest.fn();
const mockBuild = jest.fn();
const mockSignerEthBuilder = jest.fn();
const mockContextModule = {};
const mockContextModuleBuild = jest.fn(() => mockContextModule);
const mockContextModuleAddTypedDataLoader = jest.fn();
const mockContextModuleRemoveDefaultLoaders = jest.fn();
const mockContextModuleSetBlindSigningReporter = jest.fn();
const mockContextModuleSetChain = jest.fn();
const mockIsSuccessCommandResult = jest.fn();
const mockRNBleTransportFactory = jest.fn();
const mockDmk = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  sendCommand: jest.fn(),
  executeDeviceAction: jest.fn(),
  getDeviceSessionState: jest.fn(),
  listenToAvailableDevices: jest.fn(),
  startDiscovering: jest.fn(),
  stopDiscovering: jest.fn(),
  listConnectedDevices: jest.fn(() => []),
};

jest.mock('@ledgerhq/device-management-kit', () => ({
  CloseAppCommand: class {
    name = 'closeApp';
  },
  DeviceActionStatus: {
    Pending: 'pending',
    Completed: 'completed',
    Error: 'error',
    Stopped: 'stopped',
  },
  DeviceLockedError: class {
    _tag = 'DeviceLockedError';
    originalError = new Error('Device locked.');
  },
  UserInteractionRequired: {
    UnlockDevice: 'unlock-device',
  },
  DeviceManagementKitBuilder: jest.fn(() => ({
    addTransport: mockAddTransport.mockReturnThis(),
    addLogger: mockAddLogger.mockReturnThis(),
    build: mockBuild.mockReturnValue(mockDmk),
  })),
  DeviceStatus: {
    LOCKED: 'LOCKED',
    BUSY: 'BUSY',
    CONNECTED: 'CONNECTED',
    NOT_CONNECTED: 'NOT CONNECTED',
  },
  DeviceSessionStateType: {
    Connected: 0,
    ReadyWithoutSecureChannel: 1,
    ReadyWithSecureChannel: 2,
  },
  GetAppAndVersionCommand: jest.fn(),
  OpenAppCommand: class {
    name = 'openApp';
    args: { appName: string };

    constructor(args: { appName: string }) {
      this.args = args;
    }
  },
  isSuccessCommandResult: (...args: unknown[]) =>
    mockIsSuccessCommandResult(...args),
}));

jest.mock('@ledgerhq/device-transport-kit-react-native-ble', () => ({
  RNBleTransportFactory: mockRNBleTransportFactory,
  rnBleTransportIdentifier: 'RN_BLE',
}));

jest.mock('@ledgerhq/device-signer-kit-ethereum', () => ({
  SignerEthBuilder: (...args: unknown[]) => mockSignerEthBuilder(...args),
}));

jest.mock('@ledgerhq/context-module', () => ({
  ContextModuleBuilder: jest.fn(() => ({
    build: mockContextModuleBuild,
    addTypedDataLoader: mockContextModuleAddTypedDataLoader.mockReturnThis(),
    removeDefaultLoaders:
      mockContextModuleRemoveDefaultLoaders.mockReturnThis(),
    setBlindSigningReporter:
      mockContextModuleSetBlindSigningReporter.mockReturnThis(),
    setChain: mockContextModuleSetChain.mockReturnThis(),
  })),
  ContextModuleChainID: {
    Ethereum: 'ethereum',
  },
}));

function makeSignerBuilder(signer: Record<string, unknown>) {
  const builder = {
    build: jest.fn(() => signer),
    withContextModule: jest.fn(),
  };

  builder.withContextModule.mockReturnValue(builder);

  return builder;
}

describe('ledger DMK bridge discovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDmk.stopDiscovering.mockResolvedValue(undefined);
    mockDmk.disconnect.mockResolvedValue(undefined);
    mockDmk.listConnectedDevices.mockReturnValue([]);
    mockDmk.connect.mockReset();
    mockDmk.sendCommand.mockReset();
    mockDmk.sendCommand.mockResolvedValue({
      data: {
        name: 'Ethereum',
        version: '1.0.0',
      },
    });
    mockDmk.executeDeviceAction.mockReset();
    mockDmk.executeDeviceAction.mockReturnValue({
      observable: of({ status: 'completed' }),
    });
    mockDmk.getDeviceSessionState.mockReset();
    mockDmk.getDeviceSessionState.mockReturnValue(
      of({
        sessionStateType: 1,
        deviceStatus: 'CONNECTED',
        currentApp: {
          name: 'Ethereum',
          version: '1.0.0',
        },
      }),
    );
    mockSignerEthBuilder.mockReset();
    mockIsSuccessCommandResult.mockReset();
    mockIsSuccessCommandResult.mockImplementation(result =>
      Boolean(result?.data),
    );
    jest.useRealTimers();
  });

  it('registers the patched RN BLE transport factory', () => {
    jest.resetModules();

    const { getDmk } = require('./ledger-dmk-session');
    getDmk();

    expect(mockAddTransport).toHaveBeenCalledWith(mockRNBleTransportFactory);
    expect(mockAddLogger).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('listens to RN BLE available devices', () => {
    const device = {
      id: 'ledger-device-id',
      name: 'Ledger',
      transport: 'RN_BLE',
      deviceModel: { id: 'nanoX', name: 'Ledger Nano X' },
      rssi: -40,
    };
    const unsubscribe = jest.fn();
    const next = jest.fn();
    const error = jest.fn();

    mockDmk.listenToAvailableDevices.mockReturnValue({
      subscribe: observer => {
        of([device]).subscribe(observer);
        return { unsubscribe };
      },
    });
    const { subscribeLedgerDevices } = require('./ledger-dmk');
    const stop = subscribeLedgerDevices({ next, error });

    expect(mockDmk.listenToAvailableDevices).toHaveBeenCalledWith({
      transport: 'RN_BLE',
    });
    expect(mockDmk.startDiscovering).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(device);
    expect(error).not.toHaveBeenCalled();

    stop();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockDmk.stopDiscovering).toHaveBeenCalledTimes(1);
  });

  it('clears stale discovered devices before a new search', async () => {
    const deviceId = 'ledger-search-refresh-device-id';
    const staleDevice = {
      id: deviceId,
      name: 'Ledger stale',
      transport: 'RN_BLE',
    };
    const unsubscribe = jest.fn();

    mockDmk.listenToAvailableDevices
      .mockReturnValueOnce({
        subscribe: observer => {
          of([staleDevice]).subscribe(observer);
          return { unsubscribe };
        },
      })
      .mockReturnValueOnce({
        subscribe: observer => {
          of([]).subscribe(observer);
          return { unsubscribe };
        },
      });
    mockDmk.connect.mockResolvedValueOnce('session-1');

    const {
      connectLedgerDeviceById,
      subscribeLedgerDevices,
    } = require('./ledger-dmk');

    subscribeLedgerDevices({ next: jest.fn(), error: jest.fn() })();
    subscribeLedgerDevices({ next: jest.fn(), error: jest.fn() })();

    await expect(connectLedgerDeviceById(deviceId)).resolves.toBe('session-1');
    expect(mockDmk.connect).toHaveBeenCalledWith({
      device: expect.objectContaining({
        id: deviceId,
        name: 'Ledger',
        transport: 'RN_BLE',
      }),
      sessionRefresherOptions: { isRefresherDisabled: false },
    });
  });

  it('does not cancel a pending signer action from an app-side timeout', async () => {
    jest.useFakeTimers();

    const deviceId = 'ledger-probe-device-id';
    const sessionId = 'pending-session-1';
    const cancel = jest.fn();
    const signer = {
      signTransaction: jest.fn(() => ({
        observable: new Observable(() => undefined),
        cancel,
      })),
    };

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockSignerEthBuilder.mockReturnValue(makeSignerBuilder(signer));

    const { getLedgerDmkSession } = require('./ledger-dmk');
    const session = await getLedgerDmkSession(deviceId);
    const signing = session.signTransaction("44'/60'/0'/0/0", new Uint8Array());
    let rejection: Error | undefined;
    signing.catch((error: Error) => {
      rejection = error;
    });

    jest.advanceTimersByTime(120000);
    await Promise.resolve();

    expect(rejection).toBeUndefined();
    expect(cancel).not.toHaveBeenCalled();
    expect(mockDmk.disconnect).not.toHaveBeenCalledWith({ sessionId });
  });

  it('rejects a signer action before it starts when a cached session is disconnected', async () => {
    const deviceId = 'ledger-disconnected-cached-session-device-id';
    const sessionId = 'disconnected-cached-session-1';
    const signer = {
      signTransaction: jest.fn(() => ({
        observable: of({
          status: 'completed',
          output: { r: '1', s: '2', v: '1b' },
        }),
        cancel: jest.fn(),
      })),
    };

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockDmk.sendCommand.mockRejectedValueOnce({
      _tag: 'DeviceDisconnectedWhileSendingError',
      originalError: new Error('Device disconnected while sending APDU'),
    });
    mockSignerEthBuilder.mockReturnValue(makeSignerBuilder(signer));

    const { getLedgerDmkSession } = require('./ledger-dmk');
    const session = await getLedgerDmkSession(deviceId);

    await expect(
      session.signTransaction("44'/60'/0'/0/0", new Uint8Array()),
    ).rejects.toThrow('DeviceDisconnectedWhileSendingError');
    expect(mockDmk.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        abortTimeout: 2000,
      }),
    );
    expect(signer.signTransaction).not.toHaveBeenCalled();
    expect(mockDmk.disconnect).toHaveBeenCalledWith({ sessionId });
  });

  it('returns a signer probe error without waiting for stale session teardown', async () => {
    const deviceId = 'ledger-disconnected-probe-teardown-device-id';
    const sessionId = 'disconnected-probe-teardown-session-1';
    const signer = {
      signTransaction: jest.fn(() => ({
        observable: of({
          status: 'completed',
          output: { r: '1', s: '2', v: '1b' },
        }),
        cancel: jest.fn(),
      })),
    };

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockDmk.sendCommand.mockRejectedValueOnce({
      _tag: 'DeviceDisconnectedWhileSendingError',
      originalError: new Error('Device disconnected while sending APDU'),
    });
    mockDmk.disconnect.mockReturnValueOnce(new Promise(() => undefined));
    mockSignerEthBuilder.mockReturnValue(makeSignerBuilder(signer));

    const { getLedgerDmkSession } = require('./ledger-dmk');
    const session = await getLedgerDmkSession(deviceId);
    const signing = session.signTransaction("44'/60'/0'/0/0", new Uint8Array());
    const outcome = await Promise.race([
      signing.then(
        () => 'resolved',
        (error: Error) => error,
      ),
      new Promise(resolve => setTimeout(() => resolve('still pending'), 0)),
    ]);

    expect(outcome).toMatchObject({
      message: expect.stringContaining('DeviceDisconnectedWhileSendingError'),
    });
    expect(signer.signTransaction).not.toHaveBeenCalled();
    expect(mockDmk.disconnect).toHaveBeenCalledWith({ sessionId });
  });

  it('continues a signer action when the liveness probe receives a dashboard status', async () => {
    const deviceId = 'ledger-dashboard-session-device-id';
    const sessionId = 'dashboard-session-1';
    const signature = { r: '1', s: '2', v: '1b' };
    const signer = {
      signTransaction: jest.fn(() => ({
        observable: of({ status: 'completed', output: signature }),
        cancel: jest.fn(),
      })),
    };

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockDmk.sendCommand.mockResolvedValueOnce({
      error: { errorCode: '6e00' },
    });
    mockSignerEthBuilder.mockReturnValue(makeSignerBuilder(signer));

    const { getLedgerDmkSession } = require('./ledger-dmk');
    const session = await getLedgerDmkSession(deviceId);

    await expect(
      session.signTransaction("44'/60'/0'/0/0", new Uint8Array()),
    ).resolves.toEqual(signature);
    expect(signer.signTransaction).toHaveBeenCalledTimes(1);
    expect(mockDmk.disconnect).not.toHaveBeenCalledWith({ sessionId });
  });

  it('stops a signer action when DMK reports that the device must be unlocked', async () => {
    const deviceId = 'ledger-locked-device-id';
    const sessionId = 'locked-session-1';
    const cancel = jest.fn();
    let markActionStarted = () => undefined;
    const actionStarted = new Promise<void>(resolve => {
      markActionStarted = resolve;
    });
    const signer = {
      signTransaction: jest.fn(() => ({
        observable: new Observable(observer => {
          observer.next({
            status: 'pending',
            intermediateValue: {
              requiredUserInteraction: 'unlock-device',
            },
          });
          markActionStarted();
        }),
        cancel,
      })),
    };

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockSignerEthBuilder.mockReturnValue(makeSignerBuilder(signer));

    const { getLedgerDmkSession } = require('./ledger-dmk');
    const session = await getLedgerDmkSession(deviceId);
    const signing = session.signTransaction("44'/60'/0'/0/0", new Uint8Array());
    await actionStarted;

    await expect(
      Promise.race([
        signing,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Ledger signing remained pending')),
            50,
          ),
        ),
      ]),
    ).rejects.toThrow('0x5515');
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('marks a stale connected session when the DMK state read fails', async () => {
    const deviceId = 'ledger-device-id';
    const sessionId = 'session-1';

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockDmk.getDeviceSessionState.mockImplementationOnce(() => {
      throw new Error('SessionStateError');
    });

    const { getLedgerDeviceSessionState } = require('./ledger-dmk');
    const state = await getLedgerDeviceSessionState(deviceId);

    expect(state).toBeUndefined();
    expect(mockDmk.disconnect).toHaveBeenCalledWith({ sessionId });
  });

  it('keeps stale-session validation and reconnection single-flight', async () => {
    const device = { id: 'ledger-stale-single-flight-device' };
    const state = new Subject<{
      deviceStatus: string;
      sessionStateType: number;
    }>();

    mockDmk.listConnectedDevices.mockReturnValue([
      { id: device.id, sessionId: 'stale-session' },
    ]);
    mockDmk.getDeviceSessionState.mockReturnValueOnce(state);
    mockDmk.connect.mockResolvedValueOnce('fresh-session');

    const { connectLedgerDevice } = require('./ledger-dmk');
    const first = connectLedgerDevice(device);
    const second = connectLedgerDevice(device);

    expect(mockDmk.getDeviceSessionState).toHaveBeenCalledTimes(1);

    state.next({ deviceStatus: 'NOT CONNECTED', sessionStateType: 1 });
    state.complete();

    await expect(Promise.all([first, second])).resolves.toEqual([
      'fresh-session',
      'fresh-session',
    ]);
    expect(mockDmk.connect).toHaveBeenCalledTimes(1);
  });

  it('times out a pending connect and allows a later retry', async () => {
    jest.useFakeTimers();

    const device = { id: 'ledger-connect-timeout-device' };
    let resolveConnect: (sessionId: string) => void = () => undefined;

    mockDmk.connect.mockReturnValueOnce(
      new Promise(resolve => {
        resolveConnect = resolve;
      }),
    );

    const { connectLedgerDevice } = require('./ledger-dmk');
    const connecting = connectLedgerDevice(device);

    jest.advanceTimersByTime(10000);

    await expect(connecting).rejects.toThrow(
      'Ledger: Device connection timeout',
    );

    mockDmk.connect.mockResolvedValueOnce('session-2');
    const retrying = connectLedgerDevice(device);

    expect(mockDmk.connect).toHaveBeenCalledTimes(1);

    resolveConnect('late-session');

    await expect(retrying).resolves.toBe('session-2');
    expect(mockDmk.disconnect).toHaveBeenCalledWith({
      sessionId: 'late-session',
    });
    expect(mockDmk.connect).toHaveBeenCalledTimes(2);
  });

  it('rejects a connect timeout without waiting for teardown cleanup', async () => {
    jest.useFakeTimers();

    const device = { id: 'ledger-timeout-cleanup-device' };
    const sessionId = 'partial-session';
    mockDmk.connect.mockReturnValueOnce(new Promise(() => undefined));

    const { connectLedgerDevice } = require('./ledger-dmk');
    const connecting = connectLedgerDevice(device);

    expect(mockDmk.connect).toHaveBeenCalledTimes(1);

    mockDmk.listConnectedDevices.mockReturnValue([
      { id: device.id, sessionId },
    ]);
    mockDmk.disconnect.mockReturnValueOnce(new Promise(() => undefined));

    let connectError: Error | undefined;
    void connecting.catch((error: Error) => {
      connectError = error;
    });

    await jest.advanceTimersByTimeAsync(10000);

    expect(connectError?.message).toBe('Ledger: Device connection timeout');
    expect(mockDmk.disconnect).toHaveBeenCalledWith({ sessionId });
  });

  it('does not overlap a retry when the native connect never settles', async () => {
    jest.useFakeTimers();

    const device = { id: 'ledger-never-settles-device' };
    mockDmk.connect
      .mockReturnValueOnce(new Promise(() => undefined))
      .mockResolvedValueOnce('fresh-session');

    const { connectLedgerDevice } = require('./ledger-dmk');
    const connecting = connectLedgerDevice(device);

    jest.advanceTimersByTime(10000);
    await expect(connecting).rejects.toThrow(
      'Ledger: Device connection timeout',
    );

    const retrying = connectLedgerDevice(device);
    const retryRejected = expect(retrying).rejects.toThrow(
      'Ledger: Device connection timeout',
    );
    expect(mockDmk.connect).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(10000);

    await retryRejected;
    expect(mockDmk.connect).toHaveBeenCalledTimes(1);
  });

  it('times out while a previous device teardown remains pending', async () => {
    jest.useFakeTimers();

    const device = { id: 'ledger-pending-teardown-device' };
    mockDmk.connect.mockResolvedValueOnce('stale-session');

    const {
      connectLedgerDevice,
      resetLedgerDeviceSession,
    } = require('./ledger-dmk');

    await expect(connectLedgerDevice(device)).resolves.toBe('stale-session');

    mockDmk.connect.mockClear();
    mockDmk.disconnect.mockReturnValueOnce(new Promise(() => undefined));

    void resetLedgerDeviceSession(device.id);
    const reconnecting = connectLedgerDevice(device);
    let reconnectError: Error | undefined;
    void reconnecting.catch((error: Error) => {
      reconnectError = error;
    });

    await jest.advanceTimersByTimeAsync(10000);

    expect(reconnectError?.message).toBe('Ledger: Device connection timeout');
    expect(mockDmk.connect).not.toHaveBeenCalled();
  });

  it('bounds a direct device disconnect when native teardown remains pending', async () => {
    jest.useFakeTimers();

    const device = { id: 'ledger-direct-disconnect-timeout-device' };
    mockDmk.connect.mockResolvedValueOnce('session-1');

    const {
      connectLedgerDevice,
      disconnectLedgerDevice,
    } = require('./ledger-dmk');
    await expect(connectLedgerDevice(device)).resolves.toBe('session-1');

    mockDmk.disconnect.mockReturnValueOnce(new Promise(() => undefined));
    const disconnecting = disconnectLedgerDevice(device.id);
    let disconnectError: Error | undefined;
    void disconnecting.catch((error: Error) => {
      disconnectError = error;
    });

    await jest.advanceTimersByTimeAsync(10000);

    expect(disconnectError?.message).toBe('Ledger: Device connection timeout');
  });

  it('cleans up a late timed-out session before starting its retry', async () => {
    jest.useFakeTimers();

    const device = { id: 'ledger-late-session-device' };
    let resolveStaleConnect: (sessionId: string) => void = () => undefined;
    let finishDisconnect = () => undefined;
    let markDisconnectStarted = () => undefined;
    const disconnectStarted = new Promise<void>(resolve => {
      markDisconnectStarted = resolve;
    });
    mockDmk.connect
      .mockReturnValueOnce(
        new Promise(resolve => {
          resolveStaleConnect = resolve;
        }),
      )
      .mockResolvedValueOnce('fresh-session');
    mockDmk.disconnect.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finishDisconnect = resolve;
          markDisconnectStarted();
        }),
    );

    const { connectLedgerDevice } = require('./ledger-dmk');
    const staleConnection = connectLedgerDevice(device);
    const staleRejected = expect(staleConnection).rejects.toThrow(
      'Ledger: Device connection timeout',
    );

    await jest.advanceTimersByTimeAsync(10000);
    await staleRejected;

    const freshConnection = connectLedgerDevice(device);
    expect(mockDmk.connect).toHaveBeenCalledTimes(1);

    resolveStaleConnect('stale-session');
    await disconnectStarted;

    expect(mockDmk.disconnect).toHaveBeenCalledWith({
      sessionId: 'stale-session',
    });
    expect(mockDmk.connect).toHaveBeenCalledTimes(1);

    finishDisconnect();

    await expect(freshConnection).resolves.toBe('fresh-session');
    expect(mockDmk.connect).toHaveBeenCalledTimes(2);
    expect(mockDmk.disconnect).not.toHaveBeenCalledWith({
      sessionId: 'fresh-session',
    });
  });

  it('times out a retry instead of crossing a late session teardown', async () => {
    jest.useFakeTimers();

    const device = { id: 'ledger-late-teardown-device' };
    let resolveStaleConnect: (sessionId: string) => void = () => undefined;
    mockDmk.connect.mockReturnValueOnce(
      new Promise(resolve => {
        resolveStaleConnect = resolve;
      }),
    );
    mockDmk.disconnect.mockReturnValueOnce(new Promise(() => undefined));

    const { connectLedgerDevice } = require('./ledger-dmk');
    const staleConnection = connectLedgerDevice(device);
    const staleRejected = expect(staleConnection).rejects.toThrow(
      'Ledger: Device connection timeout',
    );

    await jest.advanceTimersByTimeAsync(10000);
    await staleRejected;

    const freshConnection = connectLedgerDevice(device);
    const freshRejected = expect(freshConnection).rejects.toThrow(
      'Ledger: Device connection timeout',
    );

    resolveStaleConnect('stale-session');
    await Promise.resolve();
    await Promise.resolve();

    expect(mockDmk.disconnect).toHaveBeenCalledWith({
      sessionId: 'stale-session',
    });
    expect(mockDmk.connect).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(10000);

    await freshRejected;
    expect(mockDmk.connect).toHaveBeenCalledTimes(1);
  });

  it('prevents a reset connection from overwriting or deleting its retry', async () => {
    const device = { id: 'ledger-reset-pending-device' };
    let resolveStaleConnect: (sessionId: string) => void = () => undefined;
    let resolveFreshConnect: (sessionId: string) => void = () => undefined;

    mockDmk.connect
      .mockReturnValueOnce(
        new Promise(resolve => {
          resolveStaleConnect = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise(resolve => {
          resolveFreshConnect = resolve;
        }),
      );

    const {
      connectLedgerDevice,
      resetLedgerDeviceSession,
    } = require('./ledger-dmk');
    const staleConnection = connectLedgerDevice(device);

    await resetLedgerDeviceSession(device.id);
    const freshConnection = connectLedgerDevice(device);

    resolveStaleConnect('stale-session');
    await expect(staleConnection).rejects.toThrow(
      'Ledger: Device connection cancelled',
    );
    expect(mockDmk.disconnect).toHaveBeenCalledWith({
      sessionId: 'stale-session',
    });

    const sharedFreshConnection = connectLedgerDevice(device);
    expect(mockDmk.connect).toHaveBeenCalledTimes(2);

    resolveFreshConnect('fresh-session');
    await expect(
      Promise.all([freshConnection, sharedFreshConnection]),
    ).resolves.toEqual(['fresh-session', 'fresh-session']);
    expect(mockDmk.disconnect).toHaveBeenCalledWith({
      sessionId: 'stale-session',
    });
  });

  it('does not overlap a reset retry when the native connect never settles', async () => {
    jest.useFakeTimers();

    const device = { id: 'ledger-reset-never-settles-device' };
    mockDmk.connect
      .mockReturnValueOnce(new Promise(() => undefined))
      .mockResolvedValueOnce('fresh-session');

    const {
      connectLedgerDevice,
      resetLedgerDeviceSession,
    } = require('./ledger-dmk');
    const staleConnection = connectLedgerDevice(device);
    const staleRejected = expect(staleConnection).rejects.toThrow(
      'Ledger: Device connection timeout',
    );

    await resetLedgerDeviceSession(device.id);

    const freshConnection = connectLedgerDevice(device);
    const freshRejected = expect(freshConnection).rejects.toThrow(
      'Ledger: Device connection timeout',
    );

    await jest.advanceTimersByTimeAsync(10000);

    await Promise.all([staleRejected, freshRejected]);
    expect(mockDmk.connect).toHaveBeenCalledTimes(1);
  });

  it('waits for teardown queued during an existing-session state probe', async () => {
    const device = { id: 'ledger-state-probe-teardown-device' };
    const sessionId = 'existing-session';
    const state = new Subject<{
      deviceStatus: string;
      sessionStateType: number;
    }>();
    let finishDisconnect = () => undefined;
    let markDisconnectStarted = () => undefined;
    const disconnectStarted = new Promise<void>(resolve => {
      markDisconnectStarted = resolve;
    });

    mockDmk.connect
      .mockResolvedValueOnce(sessionId)
      .mockResolvedValueOnce('fresh-session');
    mockDmk.getDeviceSessionState.mockReturnValueOnce(state);
    mockDmk.sendCommand.mockRejectedValueOnce({
      _tag: 'DeviceDisconnectedWhileSendingError',
      originalError: new Error('Device disconnected while sending APDU'),
    });
    mockDmk.disconnect.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finishDisconnect = resolve;
          markDisconnectStarted();
        }),
    );

    const { connectLedgerDevice } = require('./ledger-dmk');
    const { probeLedgerDeviceSession } = require('./ledger-dmk-session');
    await expect(connectLedgerDevice(device)).resolves.toBe(sessionId);

    const reconnecting = connectLedgerDevice(device);
    const probing = probeLedgerDeviceSession(device.id, sessionId, 2000);

    await expect(probing).rejects.toThrow(
      'DeviceDisconnectedWhileSendingError',
    );
    await disconnectStarted;

    state.next({ deviceStatus: 'CONNECTED', sessionStateType: 1 });
    state.complete();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockDmk.connect).toHaveBeenCalledTimes(1);

    finishDisconnect();

    await expect(reconnecting).resolves.toBe('fresh-session');
    expect(mockDmk.connect).toHaveBeenCalledTimes(2);
  });

  it('does not return a connected session reset during its state probe', async () => {
    const deviceId = 'ledger-reset-state-probe-device';
    const sessionId = 'stale-session';
    const state = new Subject<{
      deviceStatus: string;
      sessionStateType: number;
    }>();

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockDmk.getDeviceSessionState.mockReturnValueOnce(state);

    const {
      connectKnownLedgerDeviceById,
      resetLedgerDeviceSession,
    } = require('./ledger-dmk');
    const connecting = connectKnownLedgerDeviceById(deviceId);

    await resetLedgerDeviceSession(deviceId);
    state.next({ deviceStatus: 'CONNECTED', sessionStateType: 1 });
    state.complete();

    await expect(connecting).rejects.toThrow(
      'Ledger: Device connection cancelled',
    );
  });

  it('does not let an old state probe clear a replacement session', async () => {
    const deviceId = 'ledger-replaced-state-probe-device';
    const staleSessionId = 'stale-session';
    const freshSessionId = 'fresh-session';
    const state = new Subject<{
      deviceStatus: string;
      sessionStateType: number;
    }>();

    mockDmk.listConnectedDevices
      .mockReturnValueOnce([{ id: deviceId, sessionId: staleSessionId }])
      .mockReturnValue([]);
    mockDmk.getDeviceSessionState.mockReturnValueOnce(state);
    mockDmk.connect.mockResolvedValueOnce(freshSessionId);

    const {
      connectKnownLedgerDeviceById,
      getLedgerDeviceSessionState,
      resetLedgerDeviceSession,
    } = require('./ledger-dmk');
    const probing = getLedgerDeviceSessionState(deviceId);

    await resetLedgerDeviceSession(deviceId);
    await expect(connectKnownLedgerDeviceById(deviceId)).resolves.toBe(
      freshSessionId,
    );

    state.error(new Error('stale state probe failed'));

    await expect(probing).resolves.toBeUndefined();
    expect(mockDmk.disconnect).toHaveBeenCalledTimes(1);
    expect(mockDmk.disconnect).toHaveBeenCalledWith({
      sessionId: staleSessionId,
    });
  });

  it('connects a known Ledger id directly after a cached device connect fails', async () => {
    const deviceId = 'ledger-other-app-device-id';
    const staleDevice = { id: deviceId, name: 'Ledger stale' };

    mockDmk.connect
      .mockRejectedValueOnce(new Error('OpeningConnectionError'))
      .mockResolvedValueOnce('session-2');

    const {
      connectLedgerDevice,
      connectLedgerDeviceById,
    } = require('./ledger-dmk');

    await expect(connectLedgerDevice(staleDevice)).rejects.toThrow(
      'OpeningConnectionError',
    );

    await expect(connectLedgerDeviceById(deviceId)).resolves.toBe('session-2');
    expect(mockDmk.listenToAvailableDevices).not.toHaveBeenCalled();
    expect(mockDmk.connect).toHaveBeenLastCalledWith({
      device: expect.objectContaining({
        id: deviceId,
        name: 'Ledger',
        transport: 'RN_BLE',
      }),
      sessionRefresherOptions: { isRefresherDisabled: false },
    });
  });

  it('normalizes plain DMK connection errors before exposing them', async () => {
    const device = { id: 'ledger-normalized-connect-error-device' };

    mockDmk.connect.mockRejectedValueOnce({
      _tag: 'ConnectionOpeningError',
      originalError: new Error('Failed to open the device'),
    });

    const { connectLedgerDevice } = require('./ledger-dmk');

    const error = await connectLedgerDevice(device).catch(value => value);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('ConnectionOpeningError');
    expect(error.message).toContain('Failed to open the device');
  });

  it('retries direct device connect when DMK reports a stale session', async () => {
    const device = { id: 'ledger-stale-connect-device-id', name: 'Ledger' };
    let finishDisconnect = () => undefined;
    let markDisconnectStarted = () => undefined;
    const disconnectStarted = new Promise<void>(resolve => {
      markDisconnectStarted = resolve;
    });

    mockDmk.listConnectedDevices
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ id: device.id, sessionId: 'stale-session' }])
      .mockReturnValue([]);
    mockDmk.disconnect.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finishDisconnect = resolve;
          markDisconnectStarted();
        }),
    );

    mockDmk.connect
      .mockRejectedValueOnce({
        _tag: 'DeviceSessionNotFound',
        originalError: new Error('Device session not found'),
      })
      .mockResolvedValueOnce('session-2');

    const { connectLedgerDevice } = require('./ledger-dmk');

    const connection = connectLedgerDevice(device);

    await disconnectStarted;

    expect(mockDmk.connect).toHaveBeenCalledTimes(1);

    finishDisconnect();

    await expect(connection).resolves.toBe('session-2');
    expect(mockDmk.connect).toHaveBeenCalledTimes(2);
    expect(mockDmk.listenToAvailableDevices).not.toHaveBeenCalled();
  });

  it('does not retry a stale connect while its teardown remains pending', async () => {
    jest.useFakeTimers();

    const device = {
      id: 'ledger-stale-connect-pending-teardown-device-id',
      name: 'Ledger',
    };
    mockDmk.listConnectedDevices
      .mockReturnValueOnce([])
      .mockReturnValue([{ id: device.id, sessionId: 'stale-session' }]);
    mockDmk.disconnect.mockReturnValueOnce(new Promise(() => undefined));
    mockDmk.connect.mockRejectedValueOnce({
      _tag: 'DeviceSessionNotFound',
      originalError: new Error('Device session not found'),
    });

    const { connectLedgerDevice } = require('./ledger-dmk');
    const connecting = connectLedgerDevice(device);
    let connectError: Error | undefined;
    void connecting.catch((error: Error) => {
      connectError = error;
    });

    await jest.advanceTimersByTimeAsync(10000);

    expect(connectError?.message).toBe('Ledger: Device connection timeout');
    expect(mockDmk.connect).toHaveBeenCalledTimes(1);

    const retrying = connectLedgerDevice(device);
    let retryError: Error | undefined;
    void retrying.catch((error: Error) => {
      retryError = error;
    });

    await jest.advanceTimersByTimeAsync(10000);

    expect(retryError?.message).toBe('Ledger: Device connection timeout');
    expect(mockDmk.connect).toHaveBeenCalledTimes(1);
  });

  it('does not connect across a pending teardown after a state probe fails', async () => {
    jest.useFakeTimers();

    const device = { id: 'ledger-state-probe-pending-teardown-device-id' };
    const sessionId = 'stale-session';
    mockDmk.listConnectedDevices.mockReturnValue([
      { id: device.id, sessionId },
    ]);
    mockDmk.getDeviceSessionState.mockImplementationOnce(() => {
      throw new Error('SessionStateError');
    });
    mockDmk.disconnect.mockReturnValueOnce(new Promise(() => undefined));

    const { connectLedgerDevice } = require('./ledger-dmk');
    const connecting = connectLedgerDevice(device);
    let connectError: Error | undefined;
    void connecting.catch((error: Error) => {
      connectError = error;
    });

    await jest.advanceTimersByTimeAsync(10000);

    expect(connectError?.message).toBe('Ledger: Device connection timeout');
    expect(mockDmk.connect).not.toHaveBeenCalled();
  });

  it('does not retry an old stale-session request after reset', async () => {
    const device = { id: 'ledger-reset-stale-connect-device', name: 'Ledger' };
    let finishDisconnect = () => undefined;
    let markDisconnectStarted = () => undefined;
    const disconnectStarted = new Promise<void>(resolve => {
      markDisconnectStarted = resolve;
    });

    mockDmk.listConnectedDevices
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ id: device.id, sessionId: 'stale-session' }])
      .mockReturnValue([]);
    mockDmk.disconnect.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finishDisconnect = resolve;
          markDisconnectStarted();
        }),
    );
    mockDmk.connect
      .mockRejectedValueOnce({
        _tag: 'DeviceSessionNotFound',
        originalError: new Error('Device session not found'),
      })
      .mockResolvedValueOnce('fresh-session');

    const {
      connectLedgerDevice,
      resetLedgerDeviceSession,
    } = require('./ledger-dmk');
    const staleConnection = connectLedgerDevice(device);

    await disconnectStarted;
    const resetting = resetLedgerDeviceSession(device.id);
    const freshConnection = connectLedgerDevice(device);

    expect(mockDmk.connect).toHaveBeenCalledTimes(1);

    finishDisconnect();

    await resetting;
    await expect(staleConnection).rejects.toThrow(
      'Ledger: Device connection cancelled',
    );
    await expect(freshConnection).resolves.toBe('fresh-session');
    expect(mockDmk.connect).toHaveBeenCalledTimes(2);
  });

  it('clears a listed DMK session before reconnecting a known device id', async () => {
    const deviceId = 'ledger-reset-stale-session-device-id';
    const staleSessionId = 'stale-session-1';

    mockDmk.listConnectedDevices
      .mockReturnValueOnce([{ id: deviceId, sessionId: staleSessionId }])
      .mockReturnValue([]);
    mockDmk.connect.mockResolvedValueOnce('fresh-session-1');

    const {
      connectKnownLedgerDeviceById,
      resetLedgerDeviceSession,
    } = require('./ledger-dmk');

    await resetLedgerDeviceSession(deviceId);

    await expect(connectKnownLedgerDeviceById(deviceId)).resolves.toBe(
      'fresh-session-1',
    );
    expect(mockDmk.disconnect).toHaveBeenCalledWith({
      sessionId: staleSessionId,
    });
    expect(mockDmk.connect).toHaveBeenCalledWith({
      device: expect.objectContaining({
        id: deviceId,
        name: 'Ledger',
        transport: 'RN_BLE',
      }),
      sessionRefresherOptions: { isRefresherDisabled: false },
    });
  });

  it('does not scan the same persisted id when direct known-id connect fails', async () => {
    const deviceId = 'ledger-direct-fallback-device-id';

    mockDmk.connect.mockRejectedValueOnce(new Error('OpeningConnectionError'));

    const { connectKnownLedgerDeviceById } = require('./ledger-dmk');

    await expect(connectKnownLedgerDeviceById(deviceId)).rejects.toThrow(
      'OpeningConnectionError',
    );
    expect(mockDmk.listenToAvailableDevices).not.toHaveBeenCalled();
  });

  it('probes the device even when the DMK state has a cached current app', async () => {
    const deviceId = 'ledger-app-state-device-id';
    const sessionId = 'session-1';

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);

    const { getLedgerAppAndVersion } = require('./ledger-dmk');

    await expect(getLedgerAppAndVersion(deviceId)).resolves.toEqual({
      appName: 'Ethereum',
      version: '1.0.0',
    });
    expect(mockDmk.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        abortTimeout: 15000,
      }),
    );
  });

  it('does not mark a pending connection probe as an active device action', async () => {
    jest.useFakeTimers();

    const deviceId = 'ledger-pending-probe-device-id';
    mockDmk.connect.mockReturnValueOnce(new Promise(() => undefined));

    const { getLedgerAppAndVersion } = require('./ledger-dmk');
    const firstProbe = getLedgerAppAndVersion(deviceId, 2000);
    const publicCheck = Promise.race([
      firstProbe,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Ledger: Connection check timeout')),
          2000,
        ),
      ),
    ]);

    jest.advanceTimersByTime(2000);
    await expect(publicCheck).rejects.toThrow(
      'Ledger: Connection check timeout',
    );

    const retry = getLedgerAppAndVersion(deviceId, 2000);
    const retryRejected = expect(retry).rejects.toThrow(
      'Ledger: Device connection timeout',
    );
    const firstProbeRejected = expect(firstProbe).rejects.toThrow(
      'Ledger: Device connection timeout',
    );
    jest.advanceTimersByTime(8000);

    await retryRejected;
    await firstProbeRejected;
    expect(mockDmk.connect).toHaveBeenCalledTimes(1);
    expect(mockDmk.sendCommand).not.toHaveBeenCalled();
  });

  it('does not start a signer while a readiness APDU is pending', async () => {
    const deviceId = 'ledger-pending-readiness-device-id';
    const sessionId = 'pending-readiness-session-1';
    let finishReadiness: (value: {
      data: { name: string; version: string };
    }) => void = () => undefined;
    let markReadinessStarted = () => undefined;
    const readinessStarted = new Promise<void>(resolve => {
      markReadinessStarted = resolve;
    });
    const signer = {
      signTransaction: jest.fn(() => ({
        observable: of({
          status: 'completed',
          output: { r: '0x1', s: '0x2', v: '0x1b' },
        }),
      })),
    };

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockDmk.sendCommand.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishReadiness = resolve;
          markReadinessStarted();
        }),
    );
    mockSignerEthBuilder.mockReturnValue(makeSignerBuilder(signer));

    const {
      getLedgerAppAndVersion,
      getLedgerDmkSession,
    } = require('./ledger-dmk');
    const session = await getLedgerDmkSession(deviceId);
    const readiness = getLedgerAppAndVersion(deviceId, 2000);
    await readinessStarted;

    await expect(
      session.signTransaction("44'/60'/0'/0/0", new Uint8Array()),
    ).rejects.toThrow(
      'Ledger: Another request is awaiting confirmation. Finish or cancel it, then try again.',
    );
    expect(signer.signTransaction).not.toHaveBeenCalled();
    expect(mockDmk.sendCommand).toHaveBeenCalledTimes(1);
    expect(mockDmk.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId, abortTimeout: 2000 }),
    );

    finishReadiness({
      data: { name: 'Ethereum', version: '1.0.0' },
    });
    await expect(readiness).resolves.toEqual({
      appName: 'Ethereum',
      version: '1.0.0',
    });
  });

  it('reports the legacy BOLOS dashboard when GetAppAndVersion returns 0x6e00', async () => {
    const deviceId = 'ledger-legacy-dashboard-device-id';
    const sessionId = 'legacy-dashboard-session-1';

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockDmk.sendCommand.mockResolvedValueOnce({
      error: { errorCode: '6e00' },
    });

    const { getLedgerAppAndVersion } = require('./ledger-dmk');

    await expect(getLedgerAppAndVersion(deviceId)).resolves.toEqual({
      appName: 'BOLOS',
      version: '0.0.0',
    });
  });

  it('reconnects when the app version command uses a stale DMK session', async () => {
    const deviceId = 'ledger-stale-app-command-device-id';
    const staleSessionId = 'stale-session-1';
    const freshSessionId = 'fresh-session-1';
    const connectedState = {
      sessionStateType: 0,
      deviceStatus: 'CONNECTED',
      deviceModelId: 'nanoX',
    };

    mockDmk.connect
      .mockResolvedValueOnce(staleSessionId)
      .mockResolvedValueOnce(freshSessionId);
    mockDmk.getDeviceSessionState.mockReturnValue(of(connectedState));
    mockDmk.sendCommand
      .mockRejectedValueOnce({
        _tag: 'DeviceSessionNotFound',
        originalError: new Error('Device session not found'),
      })
      .mockResolvedValueOnce({
        data: {
          name: 'Ethereum',
          version: '1.0.0',
        },
      });

    const { getLedgerAppAndVersion } = require('./ledger-dmk');

    await expect(getLedgerAppAndVersion(deviceId)).resolves.toEqual({
      appName: 'Ethereum',
      version: '1.0.0',
    });
    expect(mockDmk.disconnect).toHaveBeenCalledWith({
      sessionId: staleSessionId,
    });
    expect(mockDmk.connect).toHaveBeenCalledTimes(2);
    expect(mockDmk.sendCommand).toHaveBeenCalledTimes(2);
  });

  it('does not let an old app probe clear a replacement session', async () => {
    const deviceId = 'ledger-replaced-app-probe-device';
    const staleSessionId = 'stale-session';
    const freshSessionId = 'fresh-session';
    let rejectAppProbe: (error: unknown) => void = () => undefined;
    let markAppProbeStarted = () => undefined;
    const appProbeStarted = new Promise<void>(resolve => {
      markAppProbeStarted = resolve;
    });

    mockDmk.listConnectedDevices
      .mockReturnValueOnce([{ id: deviceId, sessionId: staleSessionId }])
      .mockReturnValue([]);
    mockDmk.connect.mockResolvedValueOnce(freshSessionId);
    mockDmk.sendCommand.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectAppProbe = reject;
          markAppProbeStarted();
        }),
    );

    const {
      connectKnownLedgerDeviceById,
      getLedgerAppAndVersion,
      resetLedgerDeviceSession,
    } = require('./ledger-dmk');
    const probing = getLedgerAppAndVersion(deviceId);
    const probingRejected = expect(probing).rejects.toThrow(
      'Ledger: Device connection cancelled',
    );

    await appProbeStarted;
    await resetLedgerDeviceSession(deviceId);
    await expect(connectKnownLedgerDeviceById(deviceId)).resolves.toBe(
      freshSessionId,
    );

    rejectAppProbe({
      _tag: 'DeviceSessionNotFound',
      originalError: new Error('Device session not found'),
    });

    await probingRejected;
    expect(mockDmk.disconnect).toHaveBeenCalledTimes(1);
    expect(mockDmk.disconnect).toHaveBeenCalledWith({
      sessionId: staleSessionId,
    });
    expect(mockDmk.connect).toHaveBeenCalledTimes(1);
  });

  it('leaves user-interaction actions pending until DMK emits a terminal state', async () => {
    jest.useFakeTimers();

    const deviceId = 'ledger-open-app-device-id';
    const sessionId = 'pending-open-app-session-1';
    const cancel = jest.fn();
    const signer = {
      getAddress: jest.fn(() => ({
        observable: new Observable(observer => {
          observer.next({
            status: 'pending',
            intermediateValue: {
              requiredUserInteraction: 'confirm-open-app',
              step: 'OPEN_APP',
            },
          });
        }),
        cancel,
      })),
    };

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockSignerEthBuilder.mockReturnValue(makeSignerBuilder(signer));

    const { getLedgerDmkSession } = require('./ledger-dmk');
    const session = await getLedgerDmkSession(deviceId);
    const address = session.getAddress("44'/60'/0'/0/0");
    let rejection: Error | undefined;
    address.catch((error: Error) => {
      rejection = error;
    });

    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    expect(rejection).toBeUndefined();
    expect(cancel).not.toHaveBeenCalled();
    expect(mockDmk.disconnect).not.toHaveBeenCalledWith({ sessionId });
  });

  it('rebinds a cached keyring wrapper to the current DMK session', async () => {
    const deviceId = 'ledger-rebound-session-device-id';
    const staleSessionId = 'stale-session-1';
    const freshSessionId = 'fresh-session-2';
    const address = '0x0000000000000000000000000000000000000001';
    const staleSigner = {
      getAddress: jest.fn(() => ({
        observable: of({
          status: 'error',
          error: {
            _tag: 'DeviceSessionNotFound',
            originalError: new Error('Device session not found'),
          },
        }),
      })),
    };
    const freshSigner = {
      getAddress: jest.fn(() => ({
        observable: of({
          status: 'completed',
          output: { address },
        }),
      })),
    };

    mockDmk.listConnectedDevices.mockReturnValue([
      { id: deviceId, sessionId: staleSessionId },
    ]);
    mockSignerEthBuilder.mockImplementation(({ sessionId }) =>
      makeSignerBuilder(
        sessionId === staleSessionId ? staleSigner : freshSigner,
      ),
    );

    const { getLedgerDmkSession } = require('./ledger-dmk');
    const session = await getLedgerDmkSession(deviceId);

    mockDmk.listConnectedDevices.mockReturnValue([]);
    mockDmk.getDeviceSessionState.mockImplementationOnce(() => {
      throw {
        _tag: 'DeviceSessionNotFound',
        originalError: new Error('Device session not found'),
      };
    });
    mockDmk.connect.mockResolvedValueOnce(freshSessionId);

    await expect(session.getAddress("44'/60'/0'/0/0")).resolves.toEqual({
      address,
    });
    expect(mockSignerEthBuilder).toHaveBeenLastCalledWith({
      dmk: mockDmk,
      sessionId: freshSessionId,
    });
    expect(mockContextModuleBuild).toHaveBeenCalledTimes(1);
  });

  it('normalizes DMK user rejection errors to the legacy rejected status word', async () => {
    const deviceId = 'ledger-reject-device-id';
    const sessionId = 'session-1';
    const signer = {
      signTransaction: jest.fn(() => ({
        observable: new Observable(observer => {
          observer.next({
            status: 'error',
            error: {
              _tag: 'RefusedByUserDAError',
            },
          });
        }),
        cancel: jest.fn(),
      })),
    };

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockSignerEthBuilder.mockReturnValue(makeSignerBuilder(signer));

    const { getLedgerDmkSession } = require('./ledger-dmk');
    const session = await getLedgerDmkSession(deviceId);

    await expect(
      session.signTransaction("44'/60'/0'/0/0", new Uint8Array()),
    ).rejects.toThrow('0x6985');
  });

  it('normalizes DMK lock errors to the legacy locked status word', () => {
    const { toLedgerDmkError } = require('./ledger-dmk-error');

    expect(
      toLedgerDmkError({
        _tag: 'DeviceLockedError',
        originalError: new Error('Device locked.'),
      }),
    ).toMatchObject({
      errorCode: '5515',
      message: expect.stringContaining('0x5515'),
    });
  });

  it('preserves nested DMK error details for UI display', async () => {
    const deviceId = 'ledger-detailed-error-device-id';
    const sessionId = 'session-1';
    const signer = {
      signTransaction: jest.fn(() => ({
        observable: of({
          status: 'error',
          error: {
            name: 'DeviceActionStateError',
            message: {
              message: 'Blind signing must be enabled',
              statusCode: '0x6a80',
              statusText: 'INCORRECT_DATA',
              reason: 'Contract data disabled',
            },
            originalError: {
              message: 'TransportStatusError',
              errorCode: '6a80',
            },
            cause: new Error('Nested cause text'),
          },
        }),
        cancel: jest.fn(),
      })),
    };

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockSignerEthBuilder.mockReturnValue(makeSignerBuilder(signer));

    const { getLedgerDmkSession } = require('./ledger-dmk');
    const session = await getLedgerDmkSession(deviceId);

    let error: Error | undefined;
    try {
      await session.signTransaction("44'/60'/0'/0/0", new Uint8Array());
    } catch (err) {
      error = err as Error;
    }

    expect(error?.message).toContain(
      'DeviceActionStateError Blind signing must be enabled 0x6a80 INCORRECT_DATA Contract data disabled',
    );
    expect(error?.message).toContain('TransportStatusError 6a80');
    expect(error?.message).toContain('Nested cause text');
  });

  it('lets the Ethereum signer manage app opening', async () => {
    const deviceId = 'ledger-eth-state-device-id';
    const sessionId = 'session-1';
    const rawTx = new Uint8Array([1, 2, 3]);
    const signer = {
      signTransaction: jest.fn(() => ({
        observable: of({
          status: 'completed',
          output: { r: '0x1', s: '0x2', v: '0x1b' },
        }),
      })),
    };

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockSignerEthBuilder.mockReturnValue(makeSignerBuilder(signer));

    const { getLedgerDmkSession } = require('./ledger-dmk');
    const session = await getLedgerDmkSession(deviceId);

    await expect(
      session.signTransaction("44'/60'/0'/0/0", rawTx),
    ).resolves.toEqual({
      r: '0x1',
      s: '0x2',
      v: '0x1b',
    });

    expect(mockDmk.executeDeviceAction).not.toHaveBeenCalled();
    expect(mockDmk.sendCommand).toHaveBeenCalledTimes(1);
    expect(mockDmk.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId, abortTimeout: 2000 }),
    );
    expect(signer.signTransaction).toHaveBeenCalledWith(
      "44'/60'/0'/0/0",
      rawTx,
    );
  });

  it('unsubscribes a completed action and resets the clear signing deadline before the next action', async () => {
    const deviceId = 'ledger-sequential-device-id';
    const sessionId = 'session-1';
    const firstUnsubscribe = jest.fn();
    const signer = {
      signTransaction: jest
        .fn()
        .mockReturnValueOnce({
          observable: new Observable(observer => {
            observer.next({
              status: 'completed',
              output: { r: '0x1', s: '0x2', v: '0x1b' },
            });
            return firstUnsubscribe;
          }),
          cancel: jest.fn(),
        })
        .mockReturnValueOnce({
          observable: new Observable(observer => {
            observer.next({
              status: 'completed',
              output: { r: '0x3', s: '0x4', v: '0x1c' },
            });
          }),
          cancel: jest.fn(),
        }),
    };

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockSignerEthBuilder.mockReturnValue(makeSignerBuilder(signer));

    const { getLedgerDmkSession } = require('./ledger-dmk');
    const session = await getLedgerDmkSession(deviceId);

    await session.signTransaction("44'/60'/0'/0/0", new Uint8Array());

    expect(firstUnsubscribe).toHaveBeenCalledTimes(1);

    await session.signTransaction("44'/60'/0'/0/1", new Uint8Array());

    expect(signer.signTransaction).toHaveBeenCalledTimes(2);
    expect(mockSignerEthBuilder).toHaveBeenCalledTimes(2);
    expect(mockContextModuleBuild).toHaveBeenCalledTimes(2);
  });

  it('guards concurrent actions per device and allows retry after signing finishes', async () => {
    const deviceId = 'ledger-concurrent-device-id';
    const sessionId = 'session-1';
    const otherDeviceId = 'ledger-other-device-id';
    const otherSessionId = 'session-2';
    let completeFirstAction: (() => void) | undefined;
    let markFirstActionStarted: (() => void) | undefined;
    const firstActionStarted = new Promise<void>(resolve => {
      markFirstActionStarted = resolve;
    });
    const signer = {
      signTransaction: jest
        .fn()
        .mockReturnValueOnce({
          observable: new Observable(observer => {
            markFirstActionStarted?.();
            completeFirstAction = () => {
              observer.next({
                status: 'completed',
                output: { r: '0x1', s: '0x2', v: '0x1b' },
              });
            };
          }),
        })
        .mockReturnValueOnce({
          observable: of({
            status: 'completed',
            output: { r: '0x3', s: '0x4', v: '0x1c' },
          }),
        }),
    };

    mockDmk.listConnectedDevices.mockReturnValue([
      { id: deviceId, sessionId },
      { id: otherDeviceId, sessionId: otherSessionId },
    ]);
    mockSignerEthBuilder.mockReturnValue(makeSignerBuilder(signer));

    const {
      getLedgerAppAndVersion,
      getLedgerDmkSession,
    } = require('./ledger-dmk');
    const session = await getLedgerDmkSession(deviceId);
    const firstAction = session.signTransaction(
      "44'/60'/0'/0/0",
      new Uint8Array(),
    );
    await firstActionStarted;

    await expect(
      session.signTransaction("44'/60'/0'/0/1", new Uint8Array()),
    ).rejects.toThrow(
      'Ledger: Another request is awaiting confirmation. Finish or cancel it, then try again.',
    );
    await expect(session.getAppAndVersion()).rejects.toThrow(
      'Ledger: Another request is awaiting confirmation. Finish or cancel it, then try again.',
    );
    await expect(getLedgerAppAndVersion(deviceId, 2000)).rejects.toThrow(
      'Ledger: Another request is awaiting confirmation. Finish or cancel it, then try again.',
    );
    await expect(getLedgerAppAndVersion(otherDeviceId, 2000)).resolves.toEqual({
      appName: 'Ethereum',
      version: '1.0.0',
    });
    expect(signer.signTransaction).toHaveBeenCalledTimes(1);
    expect(mockDmk.sendCommand).toHaveBeenCalledTimes(2);
    expect(mockDmk.sendCommand).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sessionId, abortTimeout: 2000 }),
    );
    expect(mockDmk.sendCommand).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sessionId: otherSessionId,
        abortTimeout: 2000,
      }),
    );
    expect(mockDmk.disconnect).not.toHaveBeenCalledWith({ sessionId });

    completeFirstAction?.();
    await firstAction;

    await expect(
      session.signTransaction("44'/60'/0'/0/1", new Uint8Array()),
    ).resolves.toEqual({ r: '0x3', s: '0x4', v: '0x1c' });
    expect(signer.signTransaction).toHaveBeenCalledTimes(2);
    expect(mockDmk.sendCommand).toHaveBeenCalledTimes(3);
  });

  it('runs the public app controls through real DMK commands', async () => {
    const deviceId = 'ledger-app-control-device-id';
    const sessionId = 'session-1';

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockDmk.sendCommand.mockResolvedValue({ data: undefined });
    mockIsSuccessCommandResult.mockReturnValue(true);

    const { getLedgerDmkSession } = require('./ledger-dmk');
    const session = await getLedgerDmkSession(deviceId);

    await session.openEthApp?.();
    await session.quitApp?.();

    expect(mockDmk.sendCommand).toHaveBeenNthCalledWith(1, {
      sessionId,
      command: expect.objectContaining({
        name: 'openApp',
        args: { appName: 'Ethereum' },
      }),
    });
    expect(mockDmk.sendCommand).toHaveBeenNthCalledWith(2, {
      sessionId,
      command: expect.objectContaining({ name: 'closeApp' }),
    });
  });

  it('builds the signer with default clear signing and a bounded network budget', async () => {
    jest.resetModules();

    const deviceId = 'ledger-clear-signing-context-device-id';
    const sessionId = 'session-1';
    const signer = {
      signTransaction: jest.fn(() => ({
        observable: of({
          status: 'completed',
          output: { r: '0x1', s: '0x2', v: '0x1b' },
        }),
      })),
    };
    const signerBuilder = makeSignerBuilder(signer);

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockSignerEthBuilder.mockReturnValue(signerBuilder);

    const { getLedgerDmkSession } = require('./ledger-dmk');
    const session = await getLedgerDmkSession(deviceId);

    await session.signTransaction("44'/60'/0'/0/0", new Uint8Array());

    const { ContextModuleBuilder } = jest.requireMock(
      '@ledgerhq/context-module',
    );
    expect(ContextModuleBuilder).toHaveBeenCalledWith({
      loggerFactory: expect.any(Function),
      networkTimeoutMs: 2000,
    });
    expect(mockSignerEthBuilder.mock.calls[0][0]).not.toHaveProperty(
      'originToken',
    );
    expect(mockContextModuleSetChain).toHaveBeenCalledWith('ethereum');
    expect(mockContextModuleSetBlindSigningReporter).toHaveBeenCalledWith(
      expect.objectContaining({ report: expect.any(Function) }),
    );
    expect(mockContextModuleRemoveDefaultLoaders).not.toHaveBeenCalled();
    expect(mockContextModuleAddTypedDataLoader).not.toHaveBeenCalled();
    expect(signerBuilder.withContextModule).toHaveBeenCalledWith(
      mockContextModule,
    );
    const blindSigningReporter =
      mockContextModuleSetBlindSigningReporter.mock.calls[0][0];
    await expect(blindSigningReporter.report()).resolves.toBeUndefined();
  });
});
