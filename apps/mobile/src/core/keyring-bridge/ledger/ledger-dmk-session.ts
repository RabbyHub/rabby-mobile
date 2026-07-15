import {
  DeviceManagementKitBuilder,
  DeviceStatus,
  GetAppAndVersionCommand,
  LogLevel,
  isSuccessCommandResult,
  type DeviceManagementKit,
  type DeviceSessionId,
  type DiscoveredDevice,
  type LoggerSubscriberService,
} from '@ledgerhq/device-management-kit';
import {
  RNBleTransportFactory,
  rnBleTransportIdentifier,
} from '@ledgerhq/device-transport-kit-react-native-ble';
import { firstValueFrom, take } from 'rxjs';
import { isDeviceSessionNotFound, toLedgerDmkError } from './ledger-dmk-error';

export type LedgerDmkDevice = DiscoveredDevice;

const CONNECT_TIMEOUT_MS = 10000;
const LEDGER_DMK_SDK_LOG_PREFIX = '[DEBUG-ledger-dmk-sdk]';
const LEDGER_DMK_SDK_LOG_TAGS = [
  'ReactNativeBleTransport',
  'RNBleApduSender',
  'DeviceConnectionStateMachine',
];

const ledgerDmkSdkLogger: LoggerSubscriberService = {
  log(level, message, options) {
    if (!__DEV__) {
      return;
    }

    if (!LEDGER_DMK_SDK_LOG_TAGS.some(tag => options.tag.includes(tag))) {
      return;
    }

    console.log(LEDGER_DMK_SDK_LOG_PREFIX, message, {
      timestampMs: Date.now(),
      level: LogLevel[level] ?? level,
      tag: options.tag,
      data: options.data,
    });
  },
};

let dmk: DeviceManagementKit | undefined;
const devicesById = new Map<string, LedgerDmkDevice>();
const sessionsByDeviceId = new Map<string, DeviceSessionId>();
const pendingConnections = new Map<string, Promise<DeviceSessionId>>();

export function getDmk() {
  if (!dmk) {
    const builder = new DeviceManagementKitBuilder().addTransport(
      RNBleTransportFactory,
    );

    if (__DEV__) {
      builder.addLogger(ledgerDmkSdkLogger);
    }

    dmk = builder.build();
  }

  return dmk;
}

export function getKnownLedgerDevice(deviceId: string): LedgerDmkDevice {
  // ponytail: DMK connect only reads id/transport; replace when DMK exposes stable BLE ids.
  return {
    id: deviceId,
    name: 'Ledger',
    transport: rnBleTransportIdentifier,
  } as LedgerDmkDevice;
}

function getListedSessionId(deviceId: string) {
  return getDmk()
    .listConnectedDevices()
    .find(device => device.id === deviceId)?.sessionId;
}

async function clearLedgerDeviceSession(deviceId: string) {
  const sessionId =
    sessionsByDeviceId.get(deviceId) ?? getListedSessionId(deviceId);

  sessionsByDeviceId.delete(deviceId);

  if (sessionId) {
    await getDmk()
      .disconnect({ sessionId })
      .catch(() => {});
  }
}

export function resetLedgerDeviceSession(deviceId: string) {
  pendingConnections.delete(deviceId);
  devicesById.delete(deviceId);
  return clearLedgerDeviceSession(deviceId);
}

function withConnectTimeout<T>({
  promise,
  timeoutMs,
  onTimeout,
  errorMessage,
}: {
  promise: Promise<T>;
  timeoutMs: number;
  onTimeout?: () => void;
  errorMessage: string;
}) {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      onTimeout?.();
      reject(new Error(errorMessage));
    }, timeoutMs);

    promise.then(
      result => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        resolve(result);
      },
      error => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function getConnectedSession(deviceId: string) {
  const sessionId =
    sessionsByDeviceId.get(deviceId) ?? getListedSessionId(deviceId);

  if (sessionId) {
    sessionsByDeviceId.set(deviceId, sessionId);
    return sessionId;
  }

  sessionsByDeviceId.delete(deviceId);
  return undefined;
}

export function subscribeLedgerDevices({
  next,
  error,
}: {
  next(device: LedgerDmkDevice): void;
  error(error: Error): void;
}) {
  const sdk = getDmk();
  devicesById.clear();
  const subscription = sdk
    .listenToAvailableDevices({ transport: rnBleTransportIdentifier })
    .subscribe({
      next: devices => {
        for (const device of devices) {
          devicesById.set(device.id, device);
          next(device);
        }
      },
      error: err => error(toLedgerDmkError(err)),
    });

  return () => {
    subscription.unsubscribe();
    sdk.stopDiscovering().catch(() => {});
  };
}

export async function connectLedgerDevice(device: LedgerDmkDevice) {
  const existing = getConnectedSession(device.id);
  if (existing && (await getLedgerDeviceSessionState(device.id))) {
    return existing;
  }

  const pending = pendingConnections.get(device.id);
  if (pending) {
    return pending;
  }

  devicesById.set(device.id, device);

  const connectOnce = () => {
    let timedOut = false;
    const rawConnect = getDmk()
      .connect({
        device,
        sessionRefresherOptions: { isRefresherDisabled: false },
      })
      .then(sessionId => {
        if (timedOut) {
          getDmk()
            .disconnect({ sessionId })
            .catch(() => {});
          throw new Error('Ledger: Device connection timeout');
        }

        return sessionId;
      });

    return withConnectTimeout({
      promise: rawConnect,
      timeoutMs: CONNECT_TIMEOUT_MS,
      onTimeout: () => {
        timedOut = true;
        void clearLedgerDeviceSession(device.id);
        devicesById.delete(device.id);
      },
      errorMessage: 'Ledger: Device connection timeout',
    });
  };

  const promise = connectOnce()
    .catch(async error => {
      if (!isDeviceSessionNotFound(error)) {
        throw error;
      }

      await clearLedgerDeviceSession(device.id);
      return connectOnce();
    })
    .then(sessionId => {
      devicesById.set(device.id, device);
      sessionsByDeviceId.set(device.id, sessionId);
      return sessionId;
    })
    .catch(async error => {
      await clearLedgerDeviceSession(device.id);
      devicesById.delete(device.id);
      throw error;
    })
    .finally(() => {
      pendingConnections.delete(device.id);
    });

  pendingConnections.set(device.id, promise);
  return promise;
}

export async function connectKnownLedgerDeviceById(deviceId: string) {
  const existing = getConnectedSession(deviceId);
  if (existing && (await getLedgerDeviceSessionState(deviceId))) {
    return existing;
  }

  const cached = devicesById.get(deviceId);
  if (cached) {
    return connectLedgerDevice(cached);
  }

  return connectLedgerDevice(getKnownLedgerDevice(deviceId));
}

export async function connectLedgerDeviceById(deviceId: string) {
  return connectKnownLedgerDeviceById(deviceId);
}

async function getSessionState(sessionId: DeviceSessionId) {
  return firstValueFrom(
    getDmk().getDeviceSessionState({ sessionId }).pipe(take(1)),
  );
}

export async function readLedgerAppAndVersion(
  sessionId: DeviceSessionId,
  abortTimeout?: number,
) {
  const result = await getDmk().sendCommand({
    sessionId,
    command: new GetAppAndVersionCommand(),
    ...(abortTimeout ? { abortTimeout } : {}),
  });

  if (!isSuccessCommandResult(result)) {
    throw toLedgerDmkError(result.error);
  }

  return {
    appName: result.data.name,
    version: result.data.version,
  };
}

export async function getLedgerAppAndVersion(deviceId: string) {
  const readAppAndVersion = async () => {
    const sessionId = await connectKnownLedgerDeviceById(deviceId);
    return readLedgerAppAndVersion(sessionId);
  };

  try {
    return await readAppAndVersion();
  } catch (error) {
    if (!isDeviceSessionNotFound(error)) {
      throw error;
    }

    await clearLedgerDeviceSession(deviceId);
    return readAppAndVersion();
  }
}

export async function getLedgerDeviceSessionState(deviceId: string) {
  const sessionId = getConnectedSession(deviceId);

  if (!sessionId) {
    return undefined;
  }

  try {
    const state = await getSessionState(sessionId);

    if (state.deviceStatus === DeviceStatus.NOT_CONNECTED) {
      await clearLedgerDeviceSession(deviceId);
      return undefined;
    }

    return state;
  } catch {
    await clearLedgerDeviceSession(deviceId);
    return undefined;
  }
}

export async function disconnectLedgerDevice(deviceId: string) {
  const sessionId =
    sessionsByDeviceId.get(deviceId) ?? getListedSessionId(deviceId);

  sessionsByDeviceId.delete(deviceId);

  if (!sessionId) {
    return;
  }

  await getDmk().disconnect({ sessionId });
}
