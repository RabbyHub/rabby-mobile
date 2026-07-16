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
  let monitorListener: MonitorListener | undefined;
  let rejectPayloadWrites = false;
  let rssiReadErrorCode: number | undefined;
  let connected = true;

  const mtuResponse = Buffer.from([0x08, 0x00, 0x00, 0x00, 0x00, 0x99]);
  const apduResponse = Buffer.from([
    0x12, 0x34, 0x05, 0x00, 0x00, 0x00, 0x02, 0x90, 0x00,
  ]);
  const characteristic = {
    uuid: WRITE_CMD_UUID,
    isWritableWithoutResponse: true,
    writeWithoutResponse: jest.fn(async value => {
      if (rejectPayloadWrites) {
        connected = false;
        throw new Error('BLE frame write failed');
      }

      const frame = Buffer.from(value, 'base64');
      if (frame[0] === 0x08) {
        queueMicrotask(() => {
          monitorListener?.(null, {
            value: mtuResponse.toString('base64'),
          } as Characteristic);
        });
      }

      return characteristic as Characteristic;
    }),
  } as Characteristic;

  const device = {
    id: DEVICE_ID,
    localName: 'Ledger',
    name: 'Ledger',
    mtu: 156,
    services: jest.fn(async () => [{ uuid: SERVICE_UUID }]),
    monitorCharacteristicForService: jest.fn(
      (_serviceUuid, _notifyUuid, listener: MonitorListener) => {
        monitorListener = listener;
        return { remove: jest.fn() };
      },
    ),
    isConnected: jest.fn(async () => connected),
    readRSSI: jest.fn(async () => {
      if (rssiReadErrorCode !== undefined) {
        const error = new Error('RSSI read failed');
        Object.assign(error, { errorCode: rssiReadErrorCode });
        throw error;
      }

      return device;
    }),
    cancelConnection: jest.fn(async () => device),
  } as unknown as Device;

  const manager = {
    onStateChange: jest.fn(() => ({ remove: jest.fn() })),
    stopDeviceScan: jest.fn(async () => undefined),
    connectedDevices: jest.fn(async () => []),
    connectToDevice: jest.fn(async () => device),
    discoverAllServicesAndCharacteristicsForDevice: jest.fn(async () => device),
    onDeviceDisconnected: jest.fn(
      (_deviceId: string, listener: DisconnectListener) => {
        disconnectListeners.push(listener);
        return { remove: jest.fn() };
      },
    ),
    characteristicsForDevice: jest.fn(async () => [characteristic]),
    cancelDeviceConnection: jest.fn(async () => device),
  } as unknown as BleManager;

  return {
    device,
    manager,
    disconnect(
      error: Error | null = null,
      listenerIndex = disconnectListeners.length - 1,
    ) {
      disconnectListeners[listenerIndex]?.(error, device);
    },
    rejectPayloadWrites() {
      rejectPayloadWrites = true;
    },
    rejectRssiReads(errorCode = 201) {
      rssiReadErrorCode = errorCode;
    },
    respondToApdu() {
      monitorListener?.(null, {
        value: apduResponse.toString('base64'),
      } as Characteristic);
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

async function flushMicrotasks() {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
}

describe('patched Ledger DMK RN BLE transport', () => {
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

  it('keeps waiting when the Android RSSI probe fails without a disconnect error', async () => {
    const harness = createBleHarness();
    const transport = createTransport(harness.manager);
    const connectedDevice = await connectTransport(transport);
    harness.rejectRssiReads(202);

    try {
      let settled = false;
      const resultPromise = connectedDevice
        .sendApdu(Uint8Array.from([0xe0, 0x04, 0x00, 0x00, 0x00]))
        .finally(() => {
          settled = true;
        });

      await new Promise(resolve => setTimeout(resolve, 550));
      await flushMicrotasks();
      expect(harness.device.readRSSI).toHaveBeenCalledTimes(1);
      expect(settled).toBe(false);

      harness.respondToApdu();
      const result = await resultPromise;
      expect(result.isRight()).toBe(true);
    } finally {
      await transport.disconnect({ connectedDevice });
    }
  });
});
