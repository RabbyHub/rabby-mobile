import { Observable, of } from 'rxjs';

const mockAddTransport = jest.fn();
const mockBuild = jest.fn();
const mockSignerEthBuilder = jest.fn();
const mockContextModule = {};
const mockContextModuleBuild = jest.fn(() => mockContextModule);
const mockContextModuleRemoveDefaultLoaders = jest.fn();
const mockContextModuleSetChain = jest.fn();
const mockIsSuccessCommandResult = jest.fn();
const mockAppStorageGetItem = jest.fn();
const mockDmk = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  sendCommand: jest.fn(),
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
  DeviceManagementKitBuilder: jest.fn(() => ({
    addTransport: mockAddTransport.mockReturnThis(),
    build: mockBuild.mockReturnValue(mockDmk),
  })),
  GetAppAndVersionCommand: jest.fn(),
  isSuccessCommandResult: (...args: unknown[]) =>
    mockIsSuccessCommandResult(...args),
}));

jest.mock('@ledgerhq/device-transport-kit-react-native-ble', () => ({
  RNBleTransportFactory: 'RNBleTransportFactory',
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
    removeDefaultLoaders:
      mockContextModuleRemoveDefaultLoaders.mockReturnThis(),
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
    mockSignerEthBuilder.mockReset();
    mockIsSuccessCommandResult.mockReset();
    jest.useRealTimers();
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

    const {
      getLedgerDmkSession,
      isLedgerDeviceConnected,
    } = require('./ledger-dmk');
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
    expect(isLedgerDeviceConnected(deviceId)).toBe(true);
  });

  it('marks a stale connected session unreachable when the DMK probe aborts', async () => {
    const deviceId = 'ledger-device-id';
    const sessionId = 'session-1';

    mockDmk.listConnectedDevices.mockReturnValue([{ id: deviceId, sessionId }]);
    mockDmk.sendCommand.mockRejectedValue(new Error('SendCommandTimeoutError'));

    const {
      isLedgerDeviceReachable,
      isLedgerDeviceConnected,
    } = require('./ledger-dmk');
    const reachable = await isLedgerDeviceReachable(deviceId, 1000);

    expect(reachable).toBe(false);
    expect(mockDmk.sendCommand).toHaveBeenCalledWith({
      sessionId,
      command: expect.any(Object),
      abortTimeout: 1000,
    });
    expect(mockDmk.disconnect).toHaveBeenCalledWith({ sessionId });
    expect(isLedgerDeviceConnected(deviceId)).toBe(false);
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

  it('drops a cached discovered device after a failed connect so the retry rescans', async () => {
    const deviceId = 'ledger-other-app-device-id';
    const staleDevice = { id: deviceId, name: 'Ledger stale' };
    const freshDevice = { id: deviceId, name: 'Ledger fresh' };
    const unsubscribe = jest.fn();
    let observer: { next(devices: unknown[]): void } | undefined;

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

    mockDmk.listenToAvailableDevices.mockReturnValueOnce({
      subscribe: nextObserver => {
        observer = nextObserver;
        return { unsubscribe };
      },
    });

    const retry = connectLedgerDeviceById(deviceId);

    expect(mockDmk.listenToAvailableDevices).toHaveBeenCalledWith({
      transport: 'RN_BLE',
    });

    observer?.next([freshDevice]);

    await expect(retry).resolves.toBe('session-2');
    expect(mockDmk.connect).toHaveBeenLastCalledWith({ device: freshDevice });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockDmk.stopDiscovering).toHaveBeenCalledTimes(1);
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
  });

  it('queues mixed signer actions on the same session', async () => {
    const deviceId = 'ledger-mixed-sequential-device-id';
    const sessionId = 'mixed-session-1';
    let getAddressObserver:
      | {
          next: (value: unknown) => void;
        }
      | undefined;
    const signer = {
      getAddress: jest.fn(() => ({
        observable: new Observable(observer => {
          getAddressObserver = observer;
        }),
      })),
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
    const getAddressPromise = session.getAddress("44'/60'/0'/0/0");

    await Promise.resolve();

    expect(signer.getAddress).toHaveBeenCalledTimes(1);

    const signPromise = session.signTransaction(
      "44'/60'/0'/0/0",
      new Uint8Array(),
    );

    await Promise.resolve();

    expect(signer.signTransaction).not.toHaveBeenCalled();

    getAddressObserver!.next({
      status: 'completed',
      output: { address: '0xabc' },
    });

    await expect(getAddressPromise).resolves.toEqual({ address: '0xabc' });
    await expect(signPromise).resolves.toEqual({
      r: '0x1',
      s: '0x2',
      v: '0x1b',
    });
    expect(signer.signTransaction).toHaveBeenCalledTimes(1);
  });

  it('uses a basic context module by default to skip remote clear-signing loaders', async () => {
    jest.resetModules();

    const deviceId = 'ledger-basic-context-device-id';
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
    expect(mockContextModuleRemoveDefaultLoaders).toHaveBeenCalledTimes(1);
    expect(signerBuilder.withContextModule).toHaveBeenCalledWith(
      mockContextModule,
    );
  });

  it('uses the DMK default context module when clear signing is enabled', async () => {
    jest.resetModules();
    mockAppStorageGetItem.mockReturnValue({
      ledgerDmkClearSigningEnabled: true,
    });

    const deviceId = 'ledger-clear-signing-device-id';
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

    expect(mockContextModuleBuild).not.toHaveBeenCalled();
    expect(signerBuilder.withContextModule).not.toHaveBeenCalled();
  });
});
