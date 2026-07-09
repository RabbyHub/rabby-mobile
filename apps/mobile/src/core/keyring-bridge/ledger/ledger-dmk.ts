import type * as LedgerContextModule from '@ledgerhq/context-module/lib/types';
import {
  DeviceActionStatus,
  DeviceManagementKitBuilder,
  DeviceStatus,
  GetAppAndVersionCommand,
  isSuccessCommandResult,
  type DeviceManagementKit,
  type DeviceSessionId,
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
const LEDGER_TIMING_PREFIX = '[DEBUG-ledger-timing]';
const LEDGER_ERROR_KEYS = [
  '_tag',
  'name',
  'message',
  'statusCode',
  'statusText',
  'errorCode',
  'reason',
  'code',
  'originalError',
  'cause',
];

let dmk: DeviceManagementKit | undefined;
let fullEthContextModule: LedgerContextModule.ContextModule | undefined;
let basicEthContextModule: LedgerContextModule.ContextModule | undefined;
const devicesById = new Map<string, LedgerDmkDevice>();
const sessionsByDeviceId = new Map<string, DeviceSessionId>();
const pendingConnections = new Map<string, Promise<DeviceSessionId>>();
const staleDeviceIds = new Set<string>();
// ponytail: keep Ledger telemetry off the signing critical path; add async app-owned reporting only if product needs it.
const noOpBlindSigningReporter = {
  report: async () => undefined,
} as unknown as LedgerContextModule.BlindSigningReporter;

export function getKnownLedgerDevice(deviceId: string): LedgerDmkDevice {
  // ponytail: DMK connect only reads id/transport; replace when DMK exposes stable BLE ids.
  return {
    id: deviceId,
    name: 'Ledger',
    transport: rnBleTransportIdentifier,
  } as LedgerDmkDevice;
}

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

  return preference?.ledgerDmkClearSigningEnabledV2 === true;
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
    value?.statusCode ??
      value?.errorCode ??
      value?.message?.statusCode ??
      value?.message?.errorCode ??
      value?.originalError?.statusCode ??
      value?.originalError?.errorCode,
  );

  if (code) {
    return code;
  }

  if (getDmkErrorTag(error) === 'RefusedByUserDAError') {
    return '6985';
  }

  return undefined;
}

function stringifyLedgerErrorValue(value: unknown, key?: string): string {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return key?.toLowerCase().includes('code')
      ? `0x${value.toString(16)}`
      : String(value);
  }

  if (typeof value === 'boolean') {
    return String(value);
  }

  if (value instanceof Error) {
    return value.message || value.name;
  }

  if (Array.isArray(value)) {
    return value
      .map(item => stringifyLedgerErrorValue(item))
      .filter(Boolean)
      .join(' ');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const parts = LEDGER_ERROR_KEYS.map(item =>
      stringifyLedgerErrorValue(record[item], item),
    ).filter(Boolean);

    if (parts.length) {
      return [...new Set(parts)].join(' ');
    }

    const message = String(value);
    if (message && message !== '[object Object]') {
      return message;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  return String(value);
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

function getDmkErrorMessage(error: unknown, fallback: string) {
  return appendStatusWord(
    stringifyLedgerErrorValue(error) || fallback,
    getDmkErrorCode(error),
  );
}

function toError(error: unknown) {
  const code = getDmkErrorCode(error);
  if (error instanceof Error) {
    const message = getDmkErrorMessage(error, error.message || error.name);
    const normalizedError =
      message === error.message ? error : new Error(message);

    return attachStatusWord(normalizedError, code);
  }

  return attachStatusWord(
    new Error(getDmkErrorMessage(error, 'Unknown Ledger DMK error')),
    code,
  );
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

  const cached = devicesById.get(deviceId);
  if (cached) {
    return connectLedgerDevice(cached);
  }

  try {
    return await connectLedgerDevice(getKnownLedgerDevice(deviceId));
  } catch {
    return connectLedgerDevice(await discoverLedgerDevice(deviceId));
  }
}

async function getSessionState(sessionId: DeviceSessionId) {
  return firstValueFrom(
    getDmk().getDeviceSessionState({ sessionId }).pipe(take(1)),
  );
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

export async function disconnectLedgerDevice(deviceId: string) {
  const sessionId =
    sessionsByDeviceId.get(deviceId) ?? getListedSessionId(deviceId);

  staleDeviceIds.delete(deviceId);
  sessionsByDeviceId.delete(deviceId);

  if (!sessionId) {
    return;
  }

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
  const runSignerAction = <T>(
    actionName: string,
    task: () => { observable: Observable<any>; cancel?: () => void },
  ) => resolveAction<T>(task(), { actionName });

  return {
    getAddress(path, options) {
      return runSignerAction('getAddress', () =>
        signer.getAddress(path, {
          checkOnDevice: options?.checkOnDevice,
          returnChainCode: options?.returnChainCode,
        }),
      );
    },
    signTransaction(path, rawTx) {
      return runSignerAction<Signature>('signTransaction', () =>
        signer.signTransaction(path, rawTx),
      );
    },
    signPersonalMessage(path, message) {
      return runSignerAction<Signature>('signPersonalMessage', () =>
        signer.signMessage(path, message),
      );
    },
    signTypedData(path, data) {
      return runSignerAction<Signature>('signTypedData', () =>
        signer.signTypedData(path, data as TypedData),
      );
    },
    getAppAndVersion() {
      return readAppAndVersion(sessionId);
    },
    close() {
      return disconnectLedgerDevice(deviceId);
    },
  };
}
