import type { Platform } from 'react-native';
import type { BleManager, Characteristic, Device } from 'react-native-ble-plx';
import {
  BleDeviceInfos,
  DeviceModelId,
  TransportDeviceModel,
  defaultApduReceiverServiceStubBuilder,
  defaultApduSenderServiceStubBuilder,
  noopLoggerFactory,
  type ApduReceiverServiceFactory,
  type ApduSenderServiceFactory,
  type DeviceModelDataSource,
} from '@ledgerhq/device-management-kit';
import { RNBleTransport } from '@ledgerhq/device-transport-kit-react-native-ble';

jest.mock('react-native-ble-plx', () => ({
  BleError: class BleError extends Error {},
  BleErrorCode: {
    OperationCancelled: 2,
    DeviceDisconnected: 201,
    DeviceRSSIReadFailed: 202,
    DeviceNotConnected: 205,
  },
  State: {
    Unknown: 'Unknown',
    PoweredOn: 'PoweredOn',
  },
}));

const SERVICE_UUID = 'ledger-service';
const WRITE_UUID = 'ledger-write';
const WRITE_CMD_UUID = 'ledger-write-command';
const NOTIFY_UUID = 'ledger-notify';
const DEVICE_ID = 'ledger-device';
const TEST_APDU = Uint8Array.from([0xe0, 0x04, 0x00, 0x00, 0x00]);

const deviceModel = new TransportDeviceModel({
  id: DeviceModelId.NANO_X,
  productName: 'Ledger Nano X',
  usbProductId: 0x40,
  bootloaderUsbProductId: 0x0004,
  usbOnly: false,
  memorySize: 2 * 1024 * 1024,
  getBlockSize: () => 32,
  masks: [0x33000000],
});

const deviceModelDataSource = {
  getBluetoothServices: () => [SERVICE_UUID],
  getBluetoothServicesInfos: () => ({
    [SERVICE_UUID]: new BleDeviceInfos(
      deviceModel,
      SERVICE_UUID,
      WRITE_UUID,
      WRITE_CMD_UUID,
      NOTIFY_UUID,
    ),
  }),
  getAllDeviceModels: () => [deviceModel],
  getDeviceModel: () => deviceModel,
  filterDeviceModels: () => [deviceModel],
} as DeviceModelDataSource;

const apduSenderServiceFactory: ApduSenderServiceFactory = args =>
  defaultApduSenderServiceStubBuilder(args, noopLoggerFactory);
const apduReceiverServiceFactory: ApduReceiverServiceFactory = args =>
  defaultApduReceiverServiceStubBuilder(args, noopLoggerFactory);

type DisconnectListener = (error: Error | null, device: Device | null) => void;
type MonitorListener = (
  error: Error | null,
  characteristic: Characteristic | null,
) => void;

function createBleHarness() {
  const disconnectListeners: DisconnectListener[] = [];
  let rejectPayloadWrites = false;
  let connected = true;

  const apduResponse = Buffer.from([
    0x12, 0x34, 0x05, 0x00, 0x00, 0x00, 0x02, 0x90, 0x00,
  ]);
  const createDeviceRecord = () => {
    let monitorListener: MonitorListener | undefined;
    let mtuFrameSize = 0x99;
    let rssiReadErrorCode: number | undefined;
    let rssiReadsHang = false;
    let shouldHangNextServices = false;
    let resolvePendingServices: (() => void) | undefined;
    let shouldHangNextPayloadWrite = false;
    const pendingPayloadWriteResolutions: Array<() => void> = [];
    const pendingRssiReadRejections: Array<(error: Error) => void> = [];
    let device: Device;

    const writeWithoutResponse = jest.fn(async value => {
      if (rejectPayloadWrites) {
        connected = false;
        throw new Error('BLE frame write failed');
      }

      const frame = Buffer.from(value, 'base64');
      if (frame[0] !== 0x08 && shouldHangNextPayloadWrite) {
        shouldHangNextPayloadWrite = false;
        return new Promise<Characteristic>(resolve => {
          pendingPayloadWriteResolutions.push(() => resolve(characteristic));
        });
      }

      if (frame[0] === 0x08) {
        queueMicrotask(() => {
          monitorListener?.(null, {
            value: Buffer.from([
              0x08,
              0x00,
              0x00,
              0x00,
              0x00,
              mtuFrameSize,
            ]).toString('base64'),
          } as Characteristic);
        });
      }

      return characteristic;
    });

    const characteristic = {
      uuid: WRITE_CMD_UUID,
      isWritableWithoutResponse: true,
      writeWithoutResponse,
    } as Characteristic;

    device = {
      id: DEVICE_ID,
      localName: 'Ledger',
      name: 'Ledger',
      mtu: 156,
      services: jest.fn(async () => {
        if (shouldHangNextServices) {
          shouldHangNextServices = false;
          return new Promise<Array<{ uuid: string }>>(resolve => {
            resolvePendingServices = () => resolve([{ uuid: SERVICE_UUID }]);
          });
        }

        return [{ uuid: SERVICE_UUID }];
      }),
      discoverAllServicesAndCharacteristics: jest.fn(async () => device),
      monitorCharacteristicForService: jest.fn(
        (_serviceUuid, _notifyUuid, listener: MonitorListener) => {
          monitorListener = listener;
          return { remove: jest.fn() };
        },
      ),
      isConnected: jest.fn(async () => connected),
      readRSSI: jest.fn(async (_transactionId?: string) => {
        if (rssiReadsHang) {
          return new Promise<Device>((_resolve, reject) => {
            pendingRssiReadRejections.push(reject);
          });
        }

        if (rssiReadErrorCode !== undefined) {
          const error = new Error('RSSI read failed');
          Object.assign(error, { errorCode: rssiReadErrorCode });
          throw error;
        }

        return device;
      }),
      cancelConnection: jest.fn(async () => device),
    } as unknown as Device;

    return {
      characteristic,
      device,
      emitMonitorFrame(frame: Uint8Array) {
        monitorListener?.(null, {
          value: Buffer.from(frame).toString('base64'),
        } as Characteristic);
      },
      hangRssiReads() {
        rssiReadsHang = true;
      },
      hangNextServices() {
        shouldHangNextServices = true;
      },
      hangNextPayloadWrite() {
        shouldHangNextPayloadWrite = true;
      },
      payloadWriteCount() {
        return writeWithoutResponse.mock.calls.filter(
          ([value]) => Buffer.from(value, 'base64')[0] !== 0x08,
        ).length;
      },
      releasePendingPayloadWrites() {
        pendingPayloadWriteResolutions.splice(0).forEach(resolve => resolve());
      },
      releasePendingServices() {
        resolvePendingServices?.();
        resolvePendingServices = undefined;
      },
      rejectPendingRssiReads(errorCode = 201) {
        rssiReadsHang = false;
        const error = new Error('RSSI read failed');
        Object.assign(error, { errorCode });
        pendingRssiReadRejections.splice(0).forEach(reject => reject(error));
      },
      rejectRssiReads(errorCode = 201) {
        rssiReadErrorCode = errorCode;
      },
      respondToApdu() {
        this.emitMonitorFrame(apduResponse);
      },
      setMtuFrameSize(frameSize: number) {
        mtuFrameSize = frameSize;
      },
    };
  };

  const initialDevice = createDeviceRecord();
  const reconnectedDevice = createDeviceRecord();
  let activeDevice = initialDevice;
  let connectCount = 0;
  let shouldHangNextConnect = false;
  let shouldFailNextCharacteristicsLookup = false;
  let resolvePendingConnect: (() => void) | undefined;

  const manager = {
    onStateChange: jest.fn(() => ({ remove: jest.fn() })),
    stopDeviceScan: jest.fn(async () => undefined),
    connectedDevices: jest.fn(async () => []),
    connectToDevice: jest.fn(async () => {
      const nextDevice = connectCount === 0 ? initialDevice : reconnectedDevice;
      connectCount += 1;

      if (shouldHangNextConnect) {
        shouldHangNextConnect = false;
        return new Promise<Device>(resolve => {
          resolvePendingConnect = () => {
            activeDevice = nextDevice;
            resolve(nextDevice.device);
          };
        });
      }

      activeDevice = nextDevice;
      return activeDevice.device;
    }),
    discoverAllServicesAndCharacteristicsForDevice: jest.fn(
      async () => activeDevice.device,
    ),
    onDeviceDisconnected: jest.fn(
      (_deviceId: string, listener: DisconnectListener) => {
        disconnectListeners.push(listener);
        return { remove: jest.fn() };
      },
    ),
    characteristicsForDevice: jest.fn(async () => {
      if (shouldFailNextCharacteristicsLookup) {
        shouldFailNextCharacteristicsLookup = false;
        return [];
      }

      return [activeDevice.characteristic];
    }),
    cancelDeviceConnection: jest.fn(async () => activeDevice.device),
    cancelTransaction: jest.fn(async () => undefined),
  } as unknown as BleManager;

  const getDeviceRecord = (target: Device) =>
    target === reconnectedDevice.device ? reconnectedDevice : initialDevice;

  return {
    device: initialDevice.device,
    reconnectedDevice: reconnectedDevice.device,
    manager,
    hangNextConnect() {
      shouldHangNextConnect = true;
    },
    failNextCharacteristicsLookup() {
      shouldFailNextCharacteristicsLookup = true;
    },
    resolvePendingConnect() {
      resolvePendingConnect?.();
      resolvePendingConnect = undefined;
    },
    disconnect(
      error: Error | null = null,
      listenerIndex = disconnectListeners.length - 1,
    ) {
      disconnectListeners[listenerIndex]?.(error, initialDevice.device);
    },
    rejectPayloadWrites() {
      rejectPayloadWrites = true;
    },
    rejectPendingRssiReads(errorCode = 201, target = initialDevice.device) {
      getDeviceRecord(target).rejectPendingRssiReads(errorCode);
    },
    rejectRssiReads(errorCode = 201, target = initialDevice.device) {
      getDeviceRecord(target).rejectRssiReads(errorCode);
    },
    hangRssiReads(target = initialDevice.device) {
      getDeviceRecord(target).hangRssiReads();
    },
    hangNextServices(target = initialDevice.device) {
      getDeviceRecord(target).hangNextServices();
    },
    hangNextPayloadWrite(target = initialDevice.device) {
      getDeviceRecord(target).hangNextPayloadWrite();
    },
    payloadWriteCount(target = initialDevice.device) {
      return getDeviceRecord(target).payloadWriteCount();
    },
    releasePendingPayloadWrites(target = initialDevice.device) {
      getDeviceRecord(target).releasePendingPayloadWrites();
    },
    releasePendingServices(target = initialDevice.device) {
      getDeviceRecord(target).releasePendingServices();
    },
    sendMonitorFrame(frame: Uint8Array, target = activeDevice.device) {
      getDeviceRecord(target).emitMonitorFrame(frame);
    },
    setMtuFrameSize(frameSize: number, target = initialDevice.device) {
      getDeviceRecord(target).setMtuFrameSize(frameSize);
    },
    respondToApdu(target = activeDevice.device) {
      getDeviceRecord(target).respondToApdu();
    },
  };
}

function createTransport(manager: BleManager) {
  return new RNBleTransport(
    deviceModelDataSource,
    noopLoggerFactory,
    apduSenderServiceFactory,
    apduReceiverServiceFactory,
    manager,
    { OS: 'android', Version: 34 } as Platform,
    {
      checkRequiredPermissions: async () => true,
      requestRequiredPermissions: async () => true,
    },
  );
}

function createMultiDeviceReconnectHarness() {
  const deviceIds = ['ledger-device-a', 'ledger-device-b'] as const;
  const disconnectListeners = new Map<string, DisconnectListener>();
  const devices = new Map(
    deviceIds.map(deviceId => {
      let device: Device;
      device = {
        id: deviceId,
        localName: deviceId,
        name: deviceId,
        services: jest.fn(async () => [{ uuid: SERVICE_UUID }]),
        discoverAllServicesAndCharacteristics: jest.fn(async () => device),
      } as unknown as Device;
      return [deviceId, device] as const;
    }),
  );
  const connectCounts = new Map<string, number>();
  let rejectPendingReconnect = () => undefined;
  let markPendingReconnectStarted = () => undefined;
  const pendingReconnectStarted = new Promise<void>(resolve => {
    markPendingReconnectStarted = resolve;
  });

  const manager = {
    onStateChange: jest.fn(() => ({ remove: jest.fn() })),
    stopDeviceScan: jest.fn(async () => undefined),
    connectedDevices: jest.fn(async () => []),
    connectToDevice: jest.fn((deviceId: string) => {
      const connectCount = (connectCounts.get(deviceId) ?? 0) + 1;
      connectCounts.set(deviceId, connectCount);

      if (deviceId === deviceIds[1] && connectCount === 2) {
        markPendingReconnectStarted();
        return new Promise<Device>((_resolve, reject) => {
          rejectPendingReconnect = () =>
            reject(new Error('BLE reconnect attempt failed'));
        });
      }

      return Promise.resolve(devices.get(deviceId));
    }),
    discoverAllServicesAndCharacteristicsForDevice: jest.fn(
      async (deviceId: string) => devices.get(deviceId),
    ),
    onDeviceDisconnected: jest.fn(
      (deviceId: string, listener: DisconnectListener) => {
        disconnectListeners.set(deviceId, listener);
        return { remove: jest.fn() };
      },
    ),
    cancelDeviceConnection: jest.fn(async () => undefined),
  } as unknown as BleManager;

  type DeviceApduSenderFactory = NonNullable<
    ConstructorParameters<typeof RNBleTransport>[9]
  >;
  const deviceApduSenderFactory: DeviceApduSenderFactory = args => {
    let dependencies = args.dependencies;
    return {
      getDependencies: () => dependencies,
      setDependencies: nextDependencies => {
        dependencies = nextDependencies;
      },
      setupConnection: jest.fn(async () => undefined),
      sendApdu: jest.fn(),
      closeConnection: jest.fn(),
    } as never;
  };
  type StateMachineFactory = NonNullable<
    ConstructorParameters<typeof RNBleTransport>[8]
  >;
  const stateMachineFactory: StateMachineFactory = args => {
    let terminated = false;
    return {
      getDependencies: () => args.deviceApduSender.getDependencies(),
      sendApdu: jest.fn(),
      closeConnection: () => {
        if (!terminated) {
          terminated = true;
          void args.onTerminated();
        }
      },
      eventDeviceDisconnected: () => {
        void args.tryToReconnect();
      },
      setDependencies: dependencies =>
        args.deviceApduSender.setDependencies(dependencies),
      setupConnection: () => args.deviceApduSender.setupConnection(),
      eventDeviceConnected: jest.fn(),
    } as never;
  };

  const transport = new RNBleTransport(
    deviceModelDataSource,
    noopLoggerFactory,
    apduSenderServiceFactory,
    apduReceiverServiceFactory,
    manager,
    { OS: 'android', Version: 34 } as Platform,
    {
      checkRequiredPermissions: async () => true,
      requestRequiredPermissions: async () => true,
    },
    1000,
    stateMachineFactory,
    deviceApduSenderFactory,
  );

  return {
    deviceIds,
    manager,
    pendingReconnectStarted,
    rejectPendingReconnect() {
      rejectPendingReconnect();
    },
    disconnect(deviceId: string) {
      disconnectListeners.get(deviceId)?.(null, devices.get(deviceId) ?? null);
    },
    async connect(deviceId: string) {
      const result = await transport.connect({
        deviceId,
        onDisconnect: jest.fn(),
      });
      return result.caseOf({
        Left: error => {
          throw error;
        },
        Right: connectedDevice => connectedDevice,
      });
    },
    transport,
  };
}

async function connectTransport(transport: RNBleTransport) {
  const result = await transport.connect({
    deviceId: DEVICE_ID,
    onDisconnect: jest.fn(),
  });

  return result.caseOf({
    Left: error => {
      throw error;
    },
    Right: connectedDevice => connectedDevice,
  });
}

type ConnectedLedgerDevice = Awaited<ReturnType<typeof connectTransport>>;

function sendTestApdu(connectedDevice: ConnectedLedgerDevice) {
  return connectedDevice.sendApdu(TEST_APDU);
}

async function expectSuccessfulApdu(
  resultPromise: ReturnType<ConnectedLedgerDevice['sendApdu']>,
) {
  return (await resultPromise).caseOf({
    Left: error => {
      throw error;
    },
    Right: value => value,
  });
}

async function flushMicrotasks() {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
}

async function waitForConnectCalls(
  harness: ReturnType<typeof createBleHarness>,
  count: number,
) {
  for (let index = 0; index < 10; index += 1) {
    await flushMicrotasks();
    if (harness.manager.connectToDevice.mock.calls.length >= count) {
      return;
    }
  }

  throw new Error(`BLE connect call ${count} did not start`);
}

async function waitForDeviceConnectCalls(
  manager: BleManager,
  deviceId: string,
  count: number,
) {
  for (let index = 0; index < 10; index += 1) {
    await flushMicrotasks();
    const calls = manager.connectToDevice.mock.calls.filter(
      ([calledDeviceId]) => calledDeviceId === deviceId,
    );
    if (calls.length >= count) {
      return;
    }
  }

  throw new Error(`BLE connect call ${count} did not start for ${deviceId}`);
}

async function waitForReconnectSetup(
  harness: ReturnType<typeof createBleHarness>,
) {
  for (let index = 0; index < 10; index += 1) {
    await flushMicrotasks();
    if (
      harness.reconnectedDevice.monitorCharacteristicForService.mock.calls
        .length > 0
    ) {
      return;
    }
  }

  throw new Error('BLE reconnect setup did not finish');
}

async function waitForReconnectServices(
  harness: ReturnType<typeof createBleHarness>,
) {
  for (let index = 0; index < 10; index += 1) {
    await flushMicrotasks();
    if (harness.reconnectedDevice.services.mock.calls.length > 0) {
      return;
    }
  }

  throw new Error('BLE reconnect services lookup did not start');
}

describe('patched Ledger DMK RN BLE transport', () => {
  it('ignores a reconnect that finishes after teardown and a fresh connection', async () => {
    const harness = createBleHarness();
    const transport = createTransport(harness.manager);
    let connectedDevice = await connectTransport(transport);

    harness.hangNextConnect();
    harness.disconnect();
    await waitForConnectCalls(harness, 2);

    await transport.disconnect({ connectedDevice });
    connectedDevice = await connectTransport(transport);
    expect(harness.manager.connectToDevice).toHaveBeenCalledTimes(3);

    const freshResultPromise = sendTestApdu(connectedDevice);
    let freshResultSettled = false;
    void freshResultPromise.then(() => {
      freshResultSettled = true;
    });
    await flushMicrotasks();

    try {
      harness.resolvePendingConnect();
      await flushMicrotasks();

      expect(freshResultSettled).toBe(false);

      harness.respondToApdu(harness.reconnectedDevice);
      await expectSuccessfulApdu(freshResultPromise);
    } finally {
      harness.resolvePendingConnect();
      await transport.disconnect({ connectedDevice }).catch(() => undefined);
    }
  });

  it('ignores reconnect setup that resumes while teardown is in progress', async () => {
    const harness = createBleHarness();
    let finishTeardown = () => undefined;
    let markTeardownStarted = () => undefined;
    const teardownStarted = new Promise<void>(resolve => {
      markTeardownStarted = resolve;
    });

    harness.manager.connectedDevices
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finishTeardown = () => resolve([]);
            markTeardownStarted();
          }),
      )
      .mockResolvedValue([]);

    const transport = createTransport(harness.manager);
    const connectedDevice = await connectTransport(transport);

    harness.hangNextServices(harness.reconnectedDevice);
    harness.disconnect();
    await waitForReconnectServices(harness);

    const disconnecting = transport.disconnect({ connectedDevice });
    await teardownStarted;

    try {
      harness.releasePendingServices(harness.reconnectedDevice);
      await flushMicrotasks();

      expect(
        harness.reconnectedDevice.monitorCharacteristicForService,
      ).not.toHaveBeenCalled();
    } finally {
      harness.releasePendingServices(harness.reconnectedDevice);
      finishTeardown();
      await disconnecting;
    }
  });

  it('waits for BLE teardown and ignores late callbacks from the old connection', async () => {
    const harness = createBleHarness();
    let finishFirstTeardown = () => undefined;
    let markFirstTeardownStarted = () => undefined;
    const firstTeardownStarted = new Promise<void>(resolve => {
      markFirstTeardownStarted = resolve;
    });

    harness.manager.connectedDevices
      .mockResolvedValueOnce([])
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finishFirstTeardown = () => resolve([harness.device]);
            markFirstTeardownStarted();
          }),
      )
      .mockResolvedValue([]);

    const transport = createTransport(harness.manager);
    let connectedDevice = await connectTransport(transport);

    try {
      const disconnecting = transport.disconnect({ connectedDevice });
      await firstTeardownStarted;
      let teardownFinished = false;
      void disconnecting.then(() => {
        teardownFinished = true;
      });

      await flushMicrotasks();
      expect(teardownFinished).toBe(false);

      finishFirstTeardown();
      await disconnecting;

      connectedDevice = await connectTransport(transport);
      expect(harness.manager.connectToDevice).toHaveBeenCalledTimes(2);

      harness.disconnect(null, 0);
      await flushMicrotasks();

      connectedDevice = await connectTransport(transport);
      expect(harness.manager.connectToDevice).toHaveBeenCalledTimes(2);
    } finally {
      finishFirstTeardown();
      await flushMicrotasks();
      await transport.disconnect({ connectedDevice }).catch(() => undefined);
    }
  });

  it('reconnects when the Android disconnect callback includes an error', async () => {
    const harness = createBleHarness();
    const transport = createTransport(harness.manager);
    const connectedDevice = await connectTransport(transport);

    try {
      expect(harness.manager.connectToDevice.mock.calls[0]?.[1]).toEqual(
        expect.objectContaining({
          timeout: 10000,
        }),
      );
      expect(
        harness.manager.connectToDevice.mock.calls[0]?.[1],
      ).not.toHaveProperty('connectionPriority');

      harness.disconnect(new Error('Android reported a disconnect error'));
      await flushMicrotasks();

      expect(harness.manager.connectToDevice).toHaveBeenNthCalledWith(
        2,
        DEVICE_ID,
        expect.objectContaining({
          timeout: 2000,
        }),
      );
      expect(
        harness.manager.connectToDevice.mock.calls[1]?.[1],
      ).not.toHaveProperty('connectionPriority');
    } finally {
      await transport.disconnect({ connectedDevice });
    }
  });

  it('retries when reconnect setup fails before the device is ready', async () => {
    const harness = createBleHarness();
    const transport = createTransport(harness.manager);
    const connectedDevice = await connectTransport(transport);

    try {
      harness.failNextCharacteristicsLookup();
      harness.disconnect();

      await waitForConnectCalls(harness, 3);
      await flushMicrotasks();

      expect(harness.manager.connectToDevice).toHaveBeenCalledTimes(3);

      const resultPromise = sendTestApdu(connectedDevice);
      await flushMicrotasks();
      harness.respondToApdu(harness.reconnectedDevice);
      await expectSuccessfulApdu(resultPromise);
    } finally {
      await transport.disconnect({ connectedDevice });
    }
  });

  it('keeps one device reconnecting when another device terminates', async () => {
    const harness = createMultiDeviceReconnectHarness();
    const [deviceAId, deviceBId] = harness.deviceIds;
    const connectedDeviceA = await harness.connect(deviceAId);
    const connectedDeviceB = await harness.connect(deviceBId);

    try {
      harness.disconnect(deviceBId);
      await harness.pendingReconnectStarted;

      await harness.transport.disconnect({ connectedDevice: connectedDeviceA });
      harness.rejectPendingReconnect();

      await waitForDeviceConnectCalls(harness.manager, deviceBId, 3);
      expect(
        harness.manager.connectToDevice.mock.calls.filter(
          ([calledDeviceId]) => calledDeviceId === deviceBId,
        ),
      ).toHaveLength(3);
    } finally {
      harness.rejectPendingReconnect();
      await harness.transport
        .disconnect({ connectedDevice: connectedDeviceB })
        .catch(() => undefined);
    }
  });

  it('finishes the pending APDU when writing a BLE frame fails', async () => {
    const harness = createBleHarness();
    const transport = createTransport(harness.manager);
    const connectedDevice = await connectTransport(transport);
    harness.rejectPayloadWrites();

    let errorTag: string | undefined;
    connectedDevice
      .sendApdu(Uint8Array.from([0xe0, 0x04, 0x00, 0x00, 0x00]))
      .then(result => {
        result.ifLeft(error => {
          errorTag = error._tag;
        });
      });

    try {
      await flushMicrotasks();
      expect(errorTag).toBe('DeviceDisconnectedWhileSendingError');
    } finally {
      if (!errorTag) {
        await new Promise(resolve => setTimeout(resolve, 550));
      }
      await transport.disconnect({ connectedDevice });
    }
  });

  it('finishes the pending APDU when the Android RSSI probe detects a disconnect', async () => {
    const harness = createBleHarness();
    const transport = createTransport(harness.manager);
    const connectedDevice = await connectTransport(transport);
    harness.rejectRssiReads();

    let errorTag: string | undefined;
    connectedDevice
      .sendApdu(Uint8Array.from([0xe0, 0x04, 0x00, 0x00, 0x00]))
      .then(result => {
        result.ifLeft(error => {
          errorTag = error._tag;
        });
      });

    try {
      await new Promise(resolve => setTimeout(resolve, 550));
      await flushMicrotasks();
      expect(harness.device.readRSSI).toHaveBeenCalledTimes(1);
      expect(errorTag).toBe('DeviceDisconnectedWhileSendingError');
    } finally {
      await transport.disconnect({ connectedDevice });
    }
  });

  it('stops the Android RSSI probe when the APDU finishes', async () => {
    const harness = createBleHarness();
    const transport = createTransport(harness.manager);
    const connectedDevice = await connectTransport(transport);

    try {
      const resultPromise = connectedDevice.sendApdu(
        Uint8Array.from([0xe0, 0x04, 0x00, 0x00, 0x00]),
      );
      await flushMicrotasks();
      harness.respondToApdu();

      const result = await resultPromise;
      result.caseOf({
        Left: error => {
          throw error;
        },
        Right: () => undefined,
      });

      await new Promise(resolve => setTimeout(resolve, 550));
      expect(harness.device.readRSSI).not.toHaveBeenCalled();
    } finally {
      await transport.disconnect({ connectedDevice });
    }
  });

  it('stops the previous Android RSSI probe when reconnect swaps the BLE device', async () => {
    const harness = createBleHarness();
    const transport = createTransport(harness.manager);
    const connectedDevice = await connectTransport(transport);

    try {
      const firstResultPromise = sendTestApdu(connectedDevice);
      await flushMicrotasks();

      harness.disconnect();
      await waitForReconnectSetup(harness);
      await firstResultPromise;

      const secondResultPromise = sendTestApdu(connectedDevice);
      await flushMicrotasks();
      harness.respondToApdu(harness.reconnectedDevice);

      await expectSuccessfulApdu(secondResultPromise);

      await new Promise(resolve => setTimeout(resolve, 550));
      expect(harness.device.readRSSI).not.toHaveBeenCalled();
      expect(harness.reconnectedDevice.readRSSI).not.toHaveBeenCalled();
    } finally {
      await transport.disconnect({ connectedDevice });
    }
  });

  it('does not let an old in-flight RSSI probe settle the next APDU after reconnect', async () => {
    const harness = createBleHarness();
    const transport = createTransport(harness.manager);
    const connectedDevice = await connectTransport(transport);
    harness.hangRssiReads();

    try {
      const firstResultPromise = sendTestApdu(connectedDevice);
      await new Promise(resolve => setTimeout(resolve, 550));
      await flushMicrotasks();
      expect(harness.device.readRSSI).toHaveBeenCalledTimes(1);

      harness.disconnect();
      await waitForReconnectSetup(harness);
      await firstResultPromise;

      let secondSettled = false;
      const secondResultPromise = sendTestApdu(connectedDevice).then(result => {
        secondSettled = true;
        return result;
      });
      await flushMicrotasks();

      harness.rejectPendingRssiReads();
      await flushMicrotasks();
      expect(secondSettled).toBe(false);

      harness.respondToApdu(harness.reconnectedDevice);
      await expectSuccessfulApdu(secondResultPromise);
    } finally {
      await transport.disconnect({ connectedDevice });
    }
  });

  it('ignores a queued monitor callback from the old BLE device after reconnect', async () => {
    const harness = createBleHarness();
    const transport = createTransport(harness.manager);
    const connectedDevice = await connectTransport(transport);

    try {
      const firstResultPromise = sendTestApdu(connectedDevice);
      await flushMicrotasks();

      harness.disconnect();
      await waitForReconnectSetup(harness);
      await firstResultPromise;

      let secondSettled = false;
      const secondResultPromise = sendTestApdu(connectedDevice).then(result => {
        secondSettled = true;
        return result;
      });
      await flushMicrotasks();

      harness.respondToApdu(harness.device);
      await flushMicrotasks();
      expect(secondSettled).toBe(false);

      harness.respondToApdu(harness.reconnectedDevice);
      await expectSuccessfulApdu(secondResultPromise);
    } finally {
      await transport.disconnect({ connectedDevice });
    }
  });

  it('drops a partial APDU response from the old BLE device when reconnecting', async () => {
    const harness = createBleHarness();
    const transport = createTransport(harness.manager);
    const connectedDevice = await connectTransport(transport);

    try {
      const firstResultPromise = sendTestApdu(connectedDevice);
      await flushMicrotasks();
      harness.sendMonitorFrame(
        Uint8Array.from([0x12, 0x34, 0x05, 0x00, 0x00, 0x00, 0x04, 0xaa, 0xbb]),
        harness.device,
      );

      harness.disconnect();
      await waitForReconnectSetup(harness);
      await firstResultPromise;

      const secondResultPromise = sendTestApdu(connectedDevice);
      await flushMicrotasks();
      harness.respondToApdu(harness.reconnectedDevice);

      const response = await expectSuccessfulApdu(secondResultPromise);
      expect(Array.from(response.data)).toEqual([]);
      expect(Array.from(response.statusCode)).toEqual([0x90, 0x00]);
    } finally {
      await transport.disconnect({ connectedDevice });
    }
  });

  it('does not continue an old APDU frame loop on the reconnected BLE device', async () => {
    const harness = createBleHarness();
    harness.setMtuFrameSize(10);
    const transport = createTransport(harness.manager);
    const connectedDevice = await connectTransport(transport);
    harness.hangNextPayloadWrite();

    try {
      const firstResultPromise = connectedDevice.sendApdu(
        Uint8Array.from({ length: 30 }, (_, index) => index),
      );
      await flushMicrotasks();
      expect(harness.payloadWriteCount()).toBe(1);

      harness.disconnect();
      await waitForReconnectSetup(harness);
      harness.releasePendingPayloadWrites();
      await flushMicrotasks();
      await firstResultPromise;

      expect(harness.payloadWriteCount(harness.reconnectedDevice)).toBe(0);

      const secondResultPromise = sendTestApdu(connectedDevice);
      await flushMicrotasks();
      harness.respondToApdu(harness.reconnectedDevice);
      await expectSuccessfulApdu(secondResultPromise);
    } finally {
      harness.releasePendingPayloadWrites();
      await transport.disconnect({ connectedDevice });
    }
  });

  it('settles and stops a pending Android RSSI probe when the connection closes', async () => {
    const harness = createBleHarness();
    const transport = createTransport(harness.manager);
    const connectedDevice = await connectTransport(transport);
    harness.hangRssiReads();

    const resultPromise = sendTestApdu(connectedDevice);
    await new Promise(resolve => setTimeout(resolve, 550));
    await flushMicrotasks();
    expect(harness.device.readRSSI).toHaveBeenCalledTimes(1);

    await transport.disconnect({ connectedDevice });
    const errorTag = (await resultPromise).caseOf({
      Left: error => error._tag,
      Right: () => undefined,
    });
    expect(errorTag).toBe('DeviceDisconnectedWhileSendingError');
    expect(harness.manager.cancelTransaction).toHaveBeenCalledTimes(1);
    expect(
      harness.manager.cancelTransaction.mock.invocationCallOrder[0],
    ).toBeLessThan(harness.device.cancelConnection.mock.invocationCallOrder[0]);

    await new Promise(resolve => setTimeout(resolve, 550));
    expect(harness.device.readRSSI).toHaveBeenCalledTimes(1);
  });

  it('requires two Android RSSI read failures before treating them as a disconnect', async () => {
    const harness = createBleHarness();
    const transport = createTransport(harness.manager);
    const connectedDevice = await connectTransport(transport);
    harness.rejectRssiReads(202);

    let errorTag: string | undefined;
    connectedDevice
      .sendApdu(Uint8Array.from([0xe0, 0x04, 0x00, 0x00, 0x00]))
      .then(result => {
        result.ifLeft(error => {
          errorTag = error._tag;
        });
      });

    try {
      await new Promise(resolve => setTimeout(resolve, 550));
      await flushMicrotasks();
      expect(harness.device.readRSSI).toHaveBeenCalledTimes(1);
      expect(errorTag).toBeUndefined();

      await new Promise(resolve => setTimeout(resolve, 500));
      await flushMicrotasks();
      expect(harness.device.readRSSI).toHaveBeenCalledTimes(2);
      expect(errorTag).toBe('DeviceDisconnectedWhileSendingError');
    } finally {
      await transport.disconnect({ connectedDevice });
    }
  });

  it('bounds hanging Android RSSI probes while an APDU is pending', async () => {
    const harness = createBleHarness();
    const transport = createTransport(harness.manager);
    const connectedDevice = await connectTransport(transport);
    harness.hangRssiReads();

    let errorTag: string | undefined;
    connectedDevice
      .sendApdu(Uint8Array.from([0xe0, 0x04, 0x00, 0x00, 0x00]))
      .then(result => {
        result.ifLeft(error => {
          errorTag = error._tag;
        });
      });

    try {
      await new Promise(resolve => setTimeout(resolve, 2100));
      await flushMicrotasks();
      expect(harness.device.readRSSI).toHaveBeenCalledTimes(2);
      expect(harness.manager.cancelTransaction).toHaveBeenCalledTimes(2);
      expect(errorTag).toBe('DeviceDisconnectedWhileSendingError');
    } finally {
      await transport.disconnect({ connectedDevice });
    }
  });
});
