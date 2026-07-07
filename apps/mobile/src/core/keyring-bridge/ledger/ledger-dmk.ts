import type * as LedgerContextModule from '@ledgerhq/context-module/lib/types';
import {
  DeviceActionStatus,
  DeviceManagementKitBuilder,
  DeviceStatus,
  GetAppAndVersionCommand,
  OpenAppDeviceAction,
  isSuccessCommandResult,
  type DeviceManagementKit,
  type DeviceSessionId,
  type DeviceSessionState,
  type DiscoveredDevice,
} from '@ledgerhq/device-management-kit';
import {
  RNBleTransportFactory,
  rnBleTransportIdentifier,
} from '@ledgerhq/device-transport-kit-react-native-ble';
import {
  SignerEthBuilder,
  type Signature,
  type TypedData,
} from '@ledgerhq/device-signer-kit-ethereum';
import type { LedgerKeyringSession } from '@rabby-wallet/eth-keyring-ledger';
import { filter, firstValueFrom, take, tap, type Observable } from 'rxjs';
import { appStorage } from '@/core/storage/mmkv';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import type { PreferenceStore } from '@/core/services/preference';

const {
  ContextModuleBuilder,
  ContextModuleChainID,
}: Pick<
  typeof LedgerContextModule,
  'ContextModuleBuilder' | 'ContextModuleChainID'
> = require('@ledgerhq/context-module');

export type LedgerDmkDevice = DiscoveredDevice;

const CONNECT_TIMEOUT_MS = 10000;
const ETH_APP_NAME = 'Ethereum';
const LEDGER_TIMING_PREFIX = '[DEBUG-ledger-timing]';
const RETRY_OPEN_ETH_APP_ERROR_CODES = new Set([
  '6d00',
  '6e00',
  '6d02',
  '650f',
]);

let dmk: DeviceManagementKit | undefined;
let fullEthContextModule: LedgerContextModule.ContextModule | undefined;
let basicEthContextModule: LedgerContextModule.ContextModule | undefined;
const devicesById = new Map<string, LedgerDmkDevice>();
const sessionsByDeviceId = new Map<string, DeviceSessionId>();
const pendingConnections = new Map<string, Promise<DeviceSessionId>>();
const actionQueuesBySessionId = new Map<DeviceSessionId, Promise<unknown>>();
const staleDeviceIds = new Set<string>();
// ponytail: keep Ledger telemetry off the signing critical path; add async app-owned reporting only if product needs it.
const noOpBlindSigningReporter = {
  report: async () => undefined,
} as unknown as LedgerContextModule.BlindSigningReporter;

function getDmk() {
  if (!dmk) {
    dmk = new DeviceManagementKitBuilder()
      .addTransport(RNBleTransportFactory)
      .build();
  }

  return dmk;
}

function createEthContextModule({
  sdk,
  defaultLoaders,
}: {
  sdk: DeviceManagementKit;
  defaultLoaders: boolean;
}) {
  const builder = new ContextModuleBuilder({
    loggerFactory: tag => sdk.getLoggerFactory()(['ContextModule', tag]),
  })
    .setChain(ContextModuleChainID.Ethereum)
    .setBlindSigningReporter(noOpBlindSigningReporter);

  if (!defaultLoaders) {
    builder.removeDefaultLoaders();
  }

  return builder.build();
}

function getFullEthContextModule(sdk: DeviceManagementKit) {
  if (!fullEthContextModule) {
    fullEthContextModule = createEthContextModule({
      sdk,
      defaultLoaders: true,
    });
  }

  return fullEthContextModule;
}

function getBasicEthContextModule(sdk: DeviceManagementKit) {
  if (!basicEthContextModule) {
    basicEthContextModule = createEthContextModule({
      sdk,
      defaultLoaders: false,
    });
  }

  return basicEthContextModule;
}

function isLedgerDmkClearSigningEnabled() {
  const preference = appStorage.getItem(
    APP_STORE_NAMES.preference,
  ) as Partial<PreferenceStore> | null;

  return preference?.ledgerDmkClearSigningEnabled !== false;
}

function buildEthSigner({
  sdk,
  sessionId,
}: {
  sdk: DeviceManagementKit;
  sessionId: DeviceSessionId;
}) {
  const builder = new SignerEthBuilder({ dmk: sdk, sessionId });

  if (isLedgerDmkClearSigningEnabled()) {
    return builder.withContextModule(getFullEthContextModule(sdk)).build();
  }

  return builder.withContextModule(getBasicEthContextModule(sdk)).build();
}

function normalizeStatusWord(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const normalized = String(value).replace(/^0x/iu, '').toLowerCase();
  return normalized || undefined;
}

function getDmkErrorTag(error: unknown) {
  const tag = (error as any)?._tag;

  return typeof tag === 'string' ? tag : undefined;
}

function getDmkErrorCode(error: unknown) {
  const value = error as any;
  const code = normalizeStatusWord(
    value?.errorCode ?? value?.originalError?.errorCode,
  );

  if (code) {
    return code;
  }

  return getDmkErrorTag(error) === 'RefusedByUserDAError' ? '6985' : undefined;
}

function appendStatusWord(message: string, code?: string) {
  if (!code || message.includes(`0x${code}`)) {
    return message;
  }

  return `${message} 0x${code}`;
}

function attachStatusWord(error: Error, code?: string) {
  if (code) {
    (error as Error & { errorCode?: string }).errorCode = code;
  }

  return error;
}

function toError(error: unknown) {
  const code = getDmkErrorCode(error);
  if (error instanceof Error) {
    const message = appendStatusWord(error.message, code);
    const normalizedError =
      message === error.message ? error : new Error(message);

    return attachStatusWord(normalizedError, code);
  }

  const value = error as any;
  const tag = getDmkErrorTag(error);
  const message =
    value?.message || tag || value?.name || 'Unknown Ledger DMK error';

  return attachStatusWord(new Error(appendStatusWord(message, code)), code);
}

function getListedSessionId(deviceId: string) {
  return getDmk()
    .listConnectedDevices()
    .find(device => device.id === deviceId)?.sessionId;
}

function markDeviceSessionStale(deviceId: string) {
  const sessionId =
    sessionsByDeviceId.get(deviceId) ?? getListedSessionId(deviceId);

  staleDeviceIds.add(deviceId);
  sessionsByDeviceId.delete(deviceId);

  if (sessionId) {
    actionQueuesBySessionId.delete(sessionId);
    getDmk()
      .disconnect({ sessionId })
      .catch(() => {});
  }
}

function logLedgerTiming(
  startedAt: number,
  label: string,
  detail?: Record<string, unknown>,
) {
  if (!__DEV__) {
    return;
  }

  console.log(LEDGER_TIMING_PREFIX, label, {
    elapsedMs: Date.now() - startedAt,
    ...detail,
  });
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

function enqueueSessionAction<T>(
  sessionId: DeviceSessionId,
  task: () => Promise<T>,
) {
  const previous = actionQueuesBySessionId.get(sessionId);
  const action = previous
    ? previous.then(task, task)
    : Promise.resolve().then(task);
  const trackedAction = action.catch(() => undefined);

  actionQueuesBySessionId.set(sessionId, trackedAction);
  trackedAction.then(() => {
    if (actionQueuesBySessionId.get(sessionId) === trackedAction) {
      actionQueuesBySessionId.delete(sessionId);
    }
  });

  return action;
}

function getActionStateLabel(state: any) {
  const { step, requiredUserInteraction } = state?.intermediateValue ?? {};

  return [step, requiredUserInteraction]
    .filter(value => typeof value === 'string' && value.length > 0)
    .join('/');
}

function isTerminalActionState(state: any) {
  return (
    state.status === DeviceActionStatus.Completed ||
    state.status === DeviceActionStatus.Error ||
    state.status === DeviceActionStatus.Stopped
  );
}

async function resolveAction<T>(
  action: { observable: Observable<any>; cancel?: () => void },
  options?: {
    actionName?: string;
  },
) {
  const startedAt = Date.now();
  let lastLoggedStateLabel = '';
  let lastLoggedStatus = '';

  logLedgerTiming(startedAt, 'dmk-action:start', {
    actionName: options?.actionName,
  });

  let state: any;
  try {
    state = await firstValueFrom(
      action.observable.pipe(
        tap(state => {
          const status = String(state.status ?? '');
          const stateLabel = getActionStateLabel(state);

          if (
            status !== lastLoggedStatus ||
            stateLabel !== lastLoggedStateLabel
          ) {
            lastLoggedStatus = status;
            lastLoggedStateLabel = stateLabel;
            logLedgerTiming(startedAt, 'dmk-action:state', {
              actionName: options?.actionName,
              status,
              state: stateLabel,
            });
          }
        }),
        filter(isTerminalActionState),
        take(1),
      ),
    );
  } catch (error) {
    if ((error as Error)?.name === 'EmptyError') {
      logLedgerTiming(startedAt, 'dmk-action:completed-empty', {
        actionName: options?.actionName,
      });
      throw new Error('Ledger: Action completed empty');
    }

    const err = toError(error);
    logLedgerTiming(startedAt, 'dmk-action:observable-error', {
      actionName: options?.actionName,
      message: err.message,
    });
    throw err;
  }

  if (state.status === DeviceActionStatus.Completed) {
    logLedgerTiming(startedAt, 'dmk-action:completed', {
      actionName: options?.actionName,
    });
    return state.output as T;
  }

  if (state.status === DeviceActionStatus.Error) {
    const error = toError(state.error);
    logLedgerTiming(startedAt, 'dmk-action:error', {
      actionName: options?.actionName,
      message: error.message,
    });
    throw error;
  }

  logLedgerTiming(startedAt, 'dmk-action:stopped', {
    actionName: options?.actionName,
  });
  throw new Error('Ledger: Action stopped');
}

function getConnectedSession(deviceId: string) {
  if (staleDeviceIds.has(deviceId)) {
    sessionsByDeviceId.delete(deviceId);
    return undefined;
  }

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
  const subscription = sdk
    .listenToAvailableDevices({ transport: rnBleTransportIdentifier })
    .subscribe({
      next: devices => {
        for (const device of devices) {
          devicesById.set(device.id, device);
          next(device);
        }
      },
      error: err => error(toError(err)),
    });

  return () => {
    subscription.unsubscribe();
    sdk.stopDiscovering().catch(() => {});
  };
}

function discoverLedgerDevice(deviceId: string) {
  const cached = devicesById.get(deviceId);
  if (cached) {
    return Promise.resolve(cached);
  }

  return new Promise<LedgerDmkDevice>((resolve, reject) => {
    let stop = () => {};
    const timeout = setTimeout(() => {
      stop();
      reject(new Error('Ledger: Device not found'));
    }, CONNECT_TIMEOUT_MS);

    const finish = (fn: () => void) => {
      clearTimeout(timeout);
      stop();
      fn();
    };

    stop = subscribeLedgerDevices({
      next: device => {
        if (device.id === deviceId) {
          finish(() => resolve(device));
        }
      },
      error: err => {
        finish(() => reject(err));
      },
    });
  });
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

  let timedOut = false;
  const rawConnect = getDmk()
    .connect({
      device,
      sessionRefresherOptions: { isRefresherDisabled: true },
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

  const promise = withConnectTimeout({
    promise: rawConnect,
    timeoutMs: CONNECT_TIMEOUT_MS,
    onTimeout: () => {
      timedOut = true;
      markDeviceSessionStale(device.id);
      devicesById.delete(device.id);
    },
    errorMessage: 'Ledger: Device connection timeout',
  })
    .then(sessionId => {
      staleDeviceIds.delete(device.id);
      devicesById.set(device.id, device);
      sessionsByDeviceId.set(device.id, sessionId);
      return sessionId;
    })
    .catch(error => {
      markDeviceSessionStale(device.id);
      devicesById.delete(device.id);
      throw error;
    })
    .finally(() => {
      pendingConnections.delete(device.id);
    });

  pendingConnections.set(device.id, promise);
  return promise;
}

export async function connectLedgerDeviceById(deviceId: string) {
  const existing = getConnectedSession(deviceId);
  if (existing && (await getLedgerDeviceSessionState(deviceId))) {
    return existing;
  }

  return connectLedgerDevice(await discoverLedgerDevice(deviceId));
}

async function getSessionState(sessionId: DeviceSessionId) {
  return firstValueFrom(
    getDmk().getDeviceSessionState({ sessionId }).pipe(take(1)),
  );
}

function assertDeviceReady(state: DeviceSessionState) {
  switch (state.deviceStatus) {
    case DeviceStatus.CONNECTED:
      return state;
    case DeviceStatus.LOCKED:
      throw new Error('Ledger: Device is locked 0x5515');
    case DeviceStatus.NOT_CONNECTED:
      throw new Error('Ledger: Device disconnected');
    case DeviceStatus.BUSY:
      throw new Error('Ledger: Device busy');
    default:
      throw new Error('Ledger: Unexpected device state');
  }
}

function getCurrentAppName(state: DeviceSessionState) {
  return 'currentApp' in state ? state.currentApp.name : undefined;
}

function shouldRetryOpenEthApp(error: unknown) {
  const code = getDmkErrorCode(error);

  return Boolean(code && RETRY_OPEN_ETH_APP_ERROR_CODES.has(code));
}

async function readAppAndVersion(
  sessionId: DeviceSessionId,
  abortTimeout?: number,
) {
  const result = await getDmk().sendCommand({
    sessionId,
    command: new GetAppAndVersionCommand(),
    ...(abortTimeout ? { abortTimeout } : {}),
  });

  if (!isSuccessCommandResult(result)) {
    throw toError(result.error);
  }

  return {
    appName: result.data.name,
    version: result.data.version,
  };
}

export async function getLedgerDeviceSessionState(deviceId: string) {
  const sessionId = getConnectedSession(deviceId);

  if (!sessionId) {
    return undefined;
  }

  try {
    const state = await getSessionState(sessionId);

    if (state.deviceStatus === DeviceStatus.NOT_CONNECTED) {
      markDeviceSessionStale(deviceId);
      return undefined;
    }

    return state;
  } catch {
    markDeviceSessionStale(deviceId);
    return undefined;
  }
}

async function ensureEthApp(sessionId: DeviceSessionId, force = false) {
  const state = assertDeviceReady(await getSessionState(sessionId));
  if (!force && getCurrentAppName(state) === ETH_APP_NAME) {
    return;
  }

  await resolveAction<void>(
    getDmk().executeDeviceAction({
      sessionId,
      deviceAction: new OpenAppDeviceAction({
        input: { appName: ETH_APP_NAME },
      }),
    }),
    { actionName: 'openEthApp' },
  );
}

export async function disconnectLedgerDevice(deviceId: string) {
  const sessionId =
    sessionsByDeviceId.get(deviceId) ?? getListedSessionId(deviceId);

  staleDeviceIds.delete(deviceId);
  sessionsByDeviceId.delete(deviceId);

  if (!sessionId) {
    return;
  }

  actionQueuesBySessionId.delete(sessionId);
  await getDmk().disconnect({ sessionId });
}

export async function getLedgerDmkSession(
  deviceId?: string,
): Promise<LedgerKeyringSession> {
  if (!deviceId) {
    throw new Error('Ledger: Device id is not set');
  }

  const sessionId = await connectLedgerDeviceById(deviceId);
  const signer = buildEthSigner({ sdk: getDmk(), sessionId });
  const withEthApp = <T>(
    actionName: string,
    task: () => { observable: Observable<any>; cancel?: () => void },
  ) =>
    enqueueSessionAction(sessionId, async () => {
      await ensureEthApp(sessionId);
      try {
        return await resolveAction<T>(task(), { actionName });
      } catch (error) {
        if (!shouldRetryOpenEthApp(error)) {
          throw error;
        }

        await ensureEthApp(sessionId, true);
        return resolveAction<T>(task(), { actionName });
      }
    });

  return {
    getAddress(path, options) {
      return withEthApp('getAddress', () =>
        signer.getAddress(path, {
          checkOnDevice: options?.checkOnDevice,
          returnChainCode: options?.returnChainCode,
          skipOpenApp: true,
        }),
      );
    },
    signTransaction(path, rawTx) {
      return withEthApp<Signature>('signTransaction', () =>
        signer.signTransaction(path, rawTx, { skipOpenApp: true }),
      );
    },
    signPersonalMessage(path, message) {
      return withEthApp<Signature>('signPersonalMessage', () =>
        signer.signMessage(path, message, { skipOpenApp: true }),
      );
    },
    signTypedData(path, data) {
      return withEthApp<Signature>('signTypedData', () =>
        signer.signTypedData(path, data as TypedData, { skipOpenApp: true }),
      );
    },
    getAppAndVersion() {
      return enqueueSessionAction(sessionId, () =>
        readAppAndVersion(sessionId),
      );
    },
    close() {
      return disconnectLedgerDevice(deviceId);
    },
  };
}
