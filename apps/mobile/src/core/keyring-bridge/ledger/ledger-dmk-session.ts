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
import {
  isDeviceSessionNotFound,
  isLedgerDmkSessionUnavailableError,
  toLedgerDmkError,
} from './ledger-dmk-error';

export type LedgerDmkDevice = DiscoveredDevice;

const CONNECT_TIMEOUT_MS = 10000;
const CONNECT_DRAIN_TIMEOUT_MS = 10000;
const DEVICE_RESPONSE_TIMEOUT_MS = 15000;
const LEGACY_DASHBOARD_STATUS_CODE = '6e00';
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
const connectionDrains = new Map<string, Promise<void>>();
const pendingTeardowns = new Map<string, Promise<void>>();
const connectionVersionsByDeviceId = new Map<string, number>();
const deferredSessionDisconnects = new Map<string, Set<DeviceSessionId>>();

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

function queueLedgerDeviceTeardown(
  deviceId: string,
  teardown: () => Promise<void>,
) {
  const previous = pendingTeardowns.get(deviceId);
  let tracked: Promise<void>;
  tracked = (previous ? previous.catch(() => {}) : Promise.resolve())
    .then(teardown)
    .finally(() => {
      if (pendingTeardowns.get(deviceId) === tracked) {
        pendingTeardowns.delete(deviceId);
      }
    });
  pendingTeardowns.set(deviceId, tracked);
  return tracked;
}

function disconnectLedgerSession(deviceId: string, sessionId: DeviceSessionId) {
  return queueLedgerDeviceTeardown(deviceId, () =>
    getDmk().disconnect({ sessionId }),
  );
}

function deferLedgerSessionDisconnect(
  deviceId: string,
  sessionId: DeviceSessionId,
) {
  const sessions =
    deferredSessionDisconnects.get(deviceId) ?? new Set<DeviceSessionId>();
  sessions.add(sessionId);
  deferredSessionDisconnects.set(deviceId, sessions);
}

async function disconnectUnownedLedgerSession(
  deviceId: string,
  sessionId: DeviceSessionId,
) {
  if (sessionsByDeviceId.get(deviceId) === sessionId) {
    return;
  }

  if (pendingConnections.has(deviceId)) {
    deferLedgerSessionDisconnect(deviceId, sessionId);
    return;
  }

  await disconnectLedgerSession(deviceId, sessionId).catch(() => {});
}

async function flushDeferredSessionDisconnects(deviceId: string) {
  if (pendingConnections.has(deviceId)) {
    return;
  }

  const deferred = deferredSessionDisconnects.get(deviceId);
  if (!deferred) {
    return;
  }

  deferredSessionDisconnects.delete(deviceId);
  const currentSessionId = sessionsByDeviceId.get(deviceId);
  for (const sessionId of deferred) {
    if (sessionId !== currentSessionId) {
      await disconnectLedgerSession(deviceId, sessionId).catch(() => {});
    }
  }
}

async function clearLedgerDeviceSession(
  deviceId: string,
  expected?: {
    sessionId: DeviceSessionId;
    connectionVersion: number;
  },
) {
  const sessionId =
    sessionsByDeviceId.get(deviceId) ?? getListedSessionId(deviceId);

  if (
    expected &&
    (expected.connectionVersion !== getConnectionVersion(deviceId) ||
      sessionId !== expected.sessionId)
  ) {
    return false;
  }

  if (sessionsByDeviceId.get(deviceId) === sessionId) {
    sessionsByDeviceId.delete(deviceId);
  }

  if (sessionId) {
    await disconnectLedgerSession(deviceId, sessionId).catch(() => {});
  }

  return true;
}

function getConnectionVersion(deviceId: string) {
  return connectionVersionsByDeviceId.get(deviceId) ?? 0;
}

function advanceConnectionVersion(deviceId: string) {
  connectionVersionsByDeviceId.set(
    deviceId,
    getConnectionVersion(deviceId) + 1,
  );
}

function invalidatePendingConnection(deviceId: string) {
  advanceConnectionVersion(deviceId);
  pendingConnections.delete(deviceId);
}

export function resetLedgerDeviceSession(deviceId: string) {
  invalidatePendingConnection(deviceId);
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
  onTimeout?: () => void | Promise<void>;
  errorMessage: string;
}) {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      void Promise.resolve(onTimeout?.())
        .catch(() => {})
        .then(() => reject(new Error(errorMessage)));
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

  return async () => {
    subscription.unsubscribe();
    await sdk.stopDiscovering().catch(() => {});
  };
}

async function connectLedgerDeviceInternal(
  device: LedgerDmkDevice,
  connectionVersion: number,
) {
  const blockers = [
    connectionDrains.get(device.id),
    pendingTeardowns.get(device.id),
  ].filter((blocker): blocker is Promise<void> => Boolean(blocker));
  if (blockers.length > 0) {
    await Promise.all(blockers.map(blocker => blocker.catch(() => {})));
    if (connectionVersion !== getConnectionVersion(device.id)) {
      throw new Error('Ledger: Device connection cancelled');
    }
  }

  const existing = getConnectedSession(device.id);
  if (existing && (await getLedgerDeviceSessionState(device.id))) {
    if (connectionVersion !== getConnectionVersion(device.id)) {
      throw new Error('Ledger: Device connection cancelled');
    }
    return existing;
  }

  if (connectionVersion !== getConnectionVersion(device.id)) {
    throw new Error('Ledger: Device connection cancelled');
  }

  devicesById.set(device.id, device);

  let publicSettled = false;
  let drainFinished = false;
  let drainTimeout: ReturnType<typeof setTimeout> | undefined;
  let finishDrain = () => {};
  const rawConnects = new Set<Promise<void>>();
  const drain = new Promise<void>(resolve => {
    finishDrain = resolve;
  });
  connectionDrains.set(device.id, drain);

  const finishConnectionDrain = () => {
    if (drainFinished) {
      return;
    }
    drainFinished = true;
    if (drainTimeout) {
      clearTimeout(drainTimeout);
    }
    if (connectionDrains.get(device.id) === drain) {
      connectionDrains.delete(device.id);
    }
    finishDrain();
  };

  const maybeFinishDrain = () => {
    if (!publicSettled) {
      return;
    }
    if (rawConnects.size === 0) {
      finishConnectionDrain();
      return;
    }
    drainTimeout ??= setTimeout(
      finishConnectionDrain,
      CONNECT_DRAIN_TIMEOUT_MS,
    );
  };

  const trackRawConnect = <T>(rawConnect: Promise<T>) => {
    let tracked: Promise<void>;
    tracked = rawConnect
      .then(
        () => undefined,
        () => undefined,
      )
      .finally(() => {
        rawConnects.delete(tracked);
        maybeFinishDrain();
      });
    rawConnects.add(tracked);
    return rawConnect;
  };

  const connectOnce = () => {
    let timedOut = false;
    const rawConnect = trackRawConnect(
      getDmk()
        .connect({
          device,
          sessionRefresherOptions: { isRefresherDisabled: false },
        })
        .then(async sessionId => {
          if (
            timedOut ||
            connectionVersion !== getConnectionVersion(device.id)
          ) {
            await disconnectUnownedLedgerSession(device.id, sessionId);
            throw new Error(
              timedOut
                ? 'Ledger: Device connection timeout'
                : 'Ledger: Device connection cancelled',
            );
          }

          return sessionId;
        }),
    );

    return withConnectTimeout({
      promise: rawConnect,
      timeoutMs: CONNECT_TIMEOUT_MS,
      onTimeout: async () => {
        timedOut = true;
        if (connectionVersion !== getConnectionVersion(device.id)) {
          return;
        }
        advanceConnectionVersion(device.id);
        devicesById.delete(device.id);
        await clearLedgerDeviceSession(device.id);
      },
      errorMessage: 'Ledger: Device connection timeout',
    });
  };

  return connectOnce()
    .catch(async error => {
      if (!isDeviceSessionNotFound(error)) {
        throw error;
      }

      await clearLedgerDeviceSession(device.id);
      if (connectionVersion !== getConnectionVersion(device.id)) {
        throw new Error('Ledger: Device connection cancelled');
      }
      return connectOnce();
    })
    .then(async sessionId => {
      if (connectionVersion !== getConnectionVersion(device.id)) {
        await disconnectUnownedLedgerSession(device.id, sessionId);
        throw new Error('Ledger: Device connection cancelled');
      }

      devicesById.set(device.id, device);
      sessionsByDeviceId.set(device.id, sessionId);
      return sessionId;
    })
    .catch(async error => {
      if (connectionVersion !== getConnectionVersion(device.id)) {
        throw toLedgerDmkError(error);
      }

      await clearLedgerDeviceSession(device.id);
      if (connectionVersion === getConnectionVersion(device.id)) {
        devicesById.delete(device.id);
      }
      throw toLedgerDmkError(error);
    })
    .finally(() => {
      publicSettled = true;
      maybeFinishDrain();
    });
}

export function connectLedgerDevice(device: LedgerDmkDevice) {
  const pending = pendingConnections.get(device.id);
  if (pending) {
    return pending;
  }

  const connectionVersion = getConnectionVersion(device.id);
  let connection: Promise<DeviceSessionId>;
  connection = connectLedgerDeviceInternal(device, connectionVersion).finally(
    () => {
      if (pendingConnections.get(device.id) === connection) {
        pendingConnections.delete(device.id);
      }
      void flushDeferredSessionDisconnects(device.id);
    },
  );

  pendingConnections.set(device.id, connection);
  return connection;
}

export async function connectKnownLedgerDeviceById(deviceId: string) {
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

function sendLedgerAppAndVersionCommand(
  sessionId: DeviceSessionId,
  abortTimeout?: number,
) {
  return getDmk().sendCommand({
    sessionId,
    command: new GetAppAndVersionCommand(),
    ...(abortTimeout ? { abortTimeout } : {}),
  });
}

export async function readLedgerAppAndVersion(
  sessionId: DeviceSessionId,
  abortTimeout?: number,
) {
  const result = await sendLedgerAppAndVersionCommand(sessionId, abortTimeout);

  if (!isSuccessCommandResult(result)) {
    if (
      'errorCode' in result.error &&
      result.error.errorCode === LEGACY_DASHBOARD_STATUS_CODE
    ) {
      return { appName: 'BOLOS', version: '0.0.0' };
    }

    throw toLedgerDmkError(result.error);
  }

  return {
    appName: result.data.name,
    version: result.data.version,
  };
}

export async function probeLedgerDeviceSession(
  deviceId: string,
  sessionId: DeviceSessionId,
  abortTimeout: number,
) {
  const expectedSession = {
    sessionId,
    connectionVersion: getConnectionVersion(deviceId),
  };

  try {
    await sendLedgerAppAndVersionCommand(sessionId, abortTimeout);
    if (
      expectedSession.connectionVersion !== getConnectionVersion(deviceId) ||
      sessionsByDeviceId.get(deviceId) !== sessionId
    ) {
      throw new Error('Ledger: Device connection cancelled');
    }
  } catch (error) {
    if (isLedgerDmkSessionUnavailableError(error)) {
      if (!(await clearLedgerDeviceSession(deviceId, expectedSession))) {
        throw new Error('Ledger: Device connection cancelled');
      }
    }
    throw toLedgerDmkError(error);
  }
}

export async function getLedgerAppAndVersion(
  deviceId: string,
  abortTimeout = DEVICE_RESPONSE_TIMEOUT_MS,
) {
  let probedSession:
    | {
        sessionId: DeviceSessionId;
        connectionVersion: number;
      }
    | undefined;
  const readAppAndVersion = async () => {
    const sessionId = await connectKnownLedgerDeviceById(deviceId);
    probedSession = {
      sessionId,
      connectionVersion: getConnectionVersion(deviceId),
    };
    return readLedgerAppAndVersion(sessionId, abortTimeout);
  };

  try {
    return await readAppAndVersion();
  } catch (error) {
    if (!isDeviceSessionNotFound(error)) {
      throw error;
    }

    if (
      !probedSession ||
      !(await clearLedgerDeviceSession(deviceId, probedSession)) ||
      probedSession.connectionVersion !== getConnectionVersion(deviceId)
    ) {
      throw new Error('Ledger: Device connection cancelled');
    }
    return readAppAndVersion();
  }
}

export async function getLedgerDeviceSessionState(deviceId: string) {
  const sessionId = getConnectedSession(deviceId);

  if (!sessionId) {
    return undefined;
  }

  const connectionVersion = getConnectionVersion(deviceId);
  const expectedSession = { sessionId, connectionVersion };

  try {
    const state = await getSessionState(sessionId);

    if (
      connectionVersion !== getConnectionVersion(deviceId) ||
      sessionsByDeviceId.get(deviceId) !== sessionId
    ) {
      return undefined;
    }

    if (state.deviceStatus === DeviceStatus.NOT_CONNECTED) {
      await clearLedgerDeviceSession(deviceId, expectedSession);
      return undefined;
    }

    return state;
  } catch {
    await clearLedgerDeviceSession(deviceId, expectedSession);
    return undefined;
  }
}

export async function disconnectLedgerDevice(deviceId: string) {
  invalidatePendingConnection(deviceId);
  const sessionId =
    sessionsByDeviceId.get(deviceId) ?? getListedSessionId(deviceId);

  sessionsByDeviceId.delete(deviceId);

  if (!sessionId) {
    return;
  }

  await disconnectLedgerSession(deviceId, sessionId);
}
