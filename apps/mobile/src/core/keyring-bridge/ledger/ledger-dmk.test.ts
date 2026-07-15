import { Observable, of } from 'rxjs';

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
const mockAppStorageGetItem = jest.fn();
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

jest.mock('@/core/storage/mmkv', () => ({
  appStorage: {
    getItem: (...args: unknown[]) => mockAppStorageGetItem(...args),
  },
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
    mockAppStorageGetItem.mockReset();
    mockAppStorageGetItem.mockReturnValue({});
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

    resolveConnect('late-session');
    await Promise.resolve();

    expect(mockDmk.disconnect).toHaveBeenCalledWith({
      sessionId: 'late-session',
    });

    mockDmk.connect.mockResolvedValueOnce('session-2');

    await expect(connectLedgerDevice(device)).resolves.toBe('session-2');
    expect(mockDmk.connect).toHaveBeenCalledTimes(2);
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

  it('uses the DMK session state current app before sending an app command', async () => {
    const deviceId = 'ledger-app-state-device-id';
    const sessionId = 'session-1';

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);

    const { getLedgerAppAndVersion } = require('./ledger-dmk');

    await expect(getLedgerAppAndVersion(deviceId)).resolves.toEqual({
      appName: 'Ethereum',
      version: '1.0.0',
    });
    expect(mockDmk.sendCommand).not.toHaveBeenCalled();
  });

  it('falls back to an app command when the DMK session state has no current app yet', async () => {
    const deviceId = 'ledger-app-command-device-id';
    const sessionId = 'session-1';
    const connectedState = {
      sessionStateType: 0,
      deviceStatus: 'CONNECTED',
      deviceModelId: 'nanoX',
    };

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockDmk.getDeviceSessionState
      .mockReturnValueOnce(of(connectedState))
      .mockReturnValueOnce(of(connectedState));

    const { getLedgerAppAndVersion } = require('./ledger-dmk');

    await expect(getLedgerAppAndVersion(deviceId)).resolves.toEqual({
      appName: 'Ethereum',
      version: '1.0.0',
    });
    expect(mockDmk.sendCommand).toHaveBeenCalledTimes(1);
  });

  it('reconnects when the app state read uses a stale DMK session', async () => {
    const deviceId = 'ledger-stale-app-state-device-id';
    const staleSessionId = 'stale-session-1';
    const freshSessionId = 'fresh-session-1';

    mockDmk.connect
      .mockResolvedValueOnce(staleSessionId)
      .mockResolvedValueOnce(freshSessionId);
    mockDmk.getDeviceSessionState
      .mockImplementationOnce(() => {
        throw {
          _tag: 'DeviceSessionNotFound',
          originalError: new Error('Device session not found'),
        };
      })
      .mockReturnValueOnce(
        of({
          sessionStateType: 1,
          deviceStatus: 'CONNECTED',
          currentApp: {
            name: 'Ethereum',
            version: '1.0.0',
          },
        }),
      );

    const { getLedgerAppAndVersion } = require('./ledger-dmk');

    await expect(getLedgerAppAndVersion(deviceId)).resolves.toEqual({
      appName: 'Ethereum',
      version: '1.0.0',
    });
    expect(mockDmk.disconnect).toHaveBeenCalledWith({
      sessionId: staleSessionId,
    });
    expect(mockDmk.connect).toHaveBeenCalledTimes(2);
    expect(mockDmk.sendCommand).not.toHaveBeenCalled();
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
    expect(mockDmk.sendCommand).not.toHaveBeenCalled();
    expect(signer.signTransaction).toHaveBeenCalledWith(
      "44'/60'/0'/0/0",
      rawTx,
    );
  });

  it('unsubscribes a completed action before allowing the next signer action', async () => {
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
    expect(mockSignerEthBuilder).toHaveBeenCalledTimes(1);
  });

  it('rejects a concurrent signer action and allows retry after the active action finishes', async () => {
    const deviceId = 'ledger-concurrent-device-id';
    const sessionId = 'session-1';
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

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockSignerEthBuilder.mockReturnValue(makeSignerBuilder(signer));

    const { getLedgerDmkSession } = require('./ledger-dmk');
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
    expect(signer.signTransaction).toHaveBeenCalledTimes(1);
    expect(mockDmk.sendCommand).not.toHaveBeenCalled();

    completeFirstAction?.();
    await firstAction;

    await expect(
      session.signTransaction("44'/60'/0'/0/1", new Uint8Array()),
    ).resolves.toEqual({ r: '0x3', s: '0x4', v: '0x1c' });
    expect(signer.signTransaction).toHaveBeenCalledTimes(2);
  });

  it('uses a basic context module by default and ignores the deprecated clear signing key', async () => {
    jest.resetModules();
    mockAppStorageGetItem.mockReturnValue({
      ledgerDmkClearSigningEnabled: true,
    });

    const deviceId = 'ledger-default-basic-context-device-id';
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

    expect(mockContextModuleSetChain).toHaveBeenCalledWith('ethereum');
    expect(mockContextModuleSetBlindSigningReporter).toHaveBeenCalledWith(
      expect.objectContaining({ report: expect.any(Function) }),
    );
    expect(mockContextModuleRemoveDefaultLoaders).toHaveBeenCalledTimes(1);
    expect(mockContextModuleAddTypedDataLoader).toHaveBeenCalledWith(
      expect.objectContaining({ load: expect.any(Function) }),
    );
    expect(signerBuilder.withContextModule).toHaveBeenCalledWith(
      mockContextModule,
    );
  });

  it('keeps clear signing loaders when the new clear signing key is enabled', async () => {
    jest.resetModules();
    mockAppStorageGetItem.mockReturnValue({
      ledgerDmkClearSigningEnabledV2: true,
    });

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

    expect(mockContextModuleSetChain).toHaveBeenCalledWith('ethereum');
    expect(mockContextModuleSetBlindSigningReporter).toHaveBeenCalledWith(
      expect.objectContaining({ report: expect.any(Function) }),
    );
    expect(mockContextModuleRemoveDefaultLoaders).not.toHaveBeenCalled();
    expect(mockContextModuleAddTypedDataLoader).not.toHaveBeenCalled();
    expect(signerBuilder.withContextModule).toHaveBeenCalledWith(
      mockContextModule,
    );
  });
});
