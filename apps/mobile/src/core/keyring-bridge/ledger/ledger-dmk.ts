import type * as LedgerContextModule from '@ledgerhq/context-module/lib/types';
import {
  CloseAppCommand,
  DeviceActionStatus,
  DeviceLockedError,
  OpenAppCommand,
  UserInteractionRequired,
  isSuccessCommandResult,
  type DeviceActionIntermediateValue,
  type DeviceActionState,
  type DeviceManagementKit,
  type DeviceSessionId,
  type DmkError,
  type ExecuteDeviceActionReturnType,
} from '@ledgerhq/device-management-kit';
import {
  SignerEthBuilder,
  type Signature,
  type TypedData,
} from '@ledgerhq/device-signer-kit-ethereum';
import {
  LedgerKeyringBusyError,
  type LedgerKeyringSession,
} from '@rabby-wallet/eth-keyring-ledger';
import { filter, firstValueFrom, take, tap } from 'rxjs';
import {
  connectLedgerDeviceById,
  disconnectLedgerDevice,
  getDmk,
  probeLedgerDeviceSession,
  readLedgerAppAndVersion,
} from './ledger-dmk-session';
import { toLedgerDmkError } from './ledger-dmk-error';

export {
  connectKnownLedgerDeviceById,
  connectLedgerDevice,
  connectLedgerDeviceById,
  disconnectLedgerDevice,
  getKnownLedgerDevice,
  getLedgerAppAndVersion,
  getLedgerDeviceSessionState,
  resetLedgerDeviceSession,
  subscribeLedgerDevices,
  type LedgerDmkDevice,
} from './ledger-dmk-session';

const {
  ContextModuleBuilder,
  ContextModuleChainID,
}: Pick<
  typeof LedgerContextModule,
  'ContextModuleBuilder' | 'ContextModuleChainID'
> = require('@ledgerhq/context-module');

const LEDGER_TIMING_PREFIX = '[DEBUG-ledger-timing]';
const LEDGER_CLEAR_SIGNING_NETWORK_TIMEOUT = 2000;
// GetAppAndVersion is a single APDU. Bound stale BLE detection without
// timing out user confirmation.
const LEDGER_SIGNER_SESSION_PROBE_TIMEOUT = 2000;

// ponytail: keep Ledger telemetry off the signing critical path; add async app-owned reporting only if product needs it.
const noOpBlindSigningReporter = {
  report: async () => undefined,
} as unknown as LedgerContextModule.BlindSigningReporter;

function getEthContextModule(sdk: DeviceManagementKit) {
  return new ContextModuleBuilder({
    loggerFactory: tag => sdk.getLoggerFactory()(['ContextModule', tag]),
    networkTimeoutMs: LEDGER_CLEAR_SIGNING_NETWORK_TIMEOUT,
  })
    .setChain(ContextModuleChainID.Ethereum)
    .setBlindSigningReporter(noOpBlindSigningReporter)
    .build();
}

function buildEthSigner({
  sdk,
  sessionId,
}: {
  sdk: DeviceManagementKit;
  sessionId: DeviceSessionId;
}) {
  return new SignerEthBuilder({ dmk: sdk, sessionId })
    .withContextModule(getEthContextModule(sdk))
    .build();
}

function logLedgerTiming(
  startedAt: number,
  label: string,
  detail?: Record<string, unknown>,
) {
  if (!__DEV__) {
    return;
  }

  const timestampMs = Date.now();
  console.log(LEDGER_TIMING_PREFIX, label, {
    timestampMs,
    elapsedMs: timestampMs - startedAt,
    ...detail,
  });
}

type LedgerActionIntermediateValue = DeviceActionIntermediateValue & {
  readonly step?: string;
};

type LedgerActionState<T> = DeviceActionState<
  T,
  DmkError,
  LedgerActionIntermediateValue
>;

type LedgerAction<T> = ExecuteDeviceActionReturnType<
  T,
  DmkError,
  LedgerActionIntermediateValue
>;

function getActionStateLabel<T>(state: LedgerActionState<T>) {
  if (state.status !== DeviceActionStatus.Pending) {
    return '';
  }

  const { step, requiredUserInteraction } = state.intermediateValue;

  return [step, requiredUserInteraction]
    .filter(value => typeof value === 'string' && value.length > 0)
    .join('/');
}

function shouldStopWaitingForAction<T>(state: LedgerActionState<T>) {
  return (
    (state.status === DeviceActionStatus.Pending &&
      state.intermediateValue?.requiredUserInteraction ===
        UserInteractionRequired.UnlockDevice) ||
    state.status === DeviceActionStatus.Completed ||
    state.status === DeviceActionStatus.Error ||
    state.status === DeviceActionStatus.Stopped
  );
}

async function resolveAction<T>(
  action: LedgerAction<T>,
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

  let state: LedgerActionState<T>;
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
        filter(shouldStopWaitingForAction),
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

    const err = toLedgerDmkError(error);
    logLedgerTiming(startedAt, 'dmk-action:observable-error', {
      actionName: options?.actionName,
      message: err.message,
    });
    throw err;
  }

  if (state.status === DeviceActionStatus.Pending) {
    action.cancel();
    throw toLedgerDmkError(new DeviceLockedError());
  }

  if (state.status === DeviceActionStatus.Completed) {
    logLedgerTiming(startedAt, 'dmk-action:completed', {
      actionName: options?.actionName,
    });
    return state.output;
  }

  if (state.status === DeviceActionStatus.Error) {
    const error = toLedgerDmkError(state.error);
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

export async function getLedgerDmkSession(
  deviceId?: string,
): Promise<LedgerKeyringSession> {
  if (!deviceId) {
    throw new Error('Ledger: Device id is not set');
  }

  await connectLedgerDeviceById(deviceId);
  let isDeviceActionActive = false;
  const runDeviceAction = async <T>(task: () => Promise<T>) => {
    if (isDeviceActionActive) {
      throw new LedgerKeyringBusyError();
    }

    isDeviceActionActive = true;
    try {
      return await task();
    } finally {
      isDeviceActionActive = false;
    }
  };
  const runSignerAction = async <T>(
    actionName: string,
    task: (currentSigner: ReturnType<typeof buildEthSigner>) => LedgerAction<T>,
  ) =>
    runDeviceAction(async () => {
      const sessionId = await connectLedgerDeviceById(deviceId);
      await probeLedgerDeviceSession(
        deviceId,
        sessionId,
        LEDGER_SIGNER_SESSION_PROBE_TIMEOUT,
      );
      const signer = buildEthSigner({ sdk: getDmk(), sessionId });
      return await resolveAction<T>(task(signer), { actionName });
    });

  return {
    getAddress(path, options) {
      return runSignerAction('getAddress', currentSigner =>
        currentSigner.getAddress(path, {
          checkOnDevice: options?.checkOnDevice,
          returnChainCode: options?.returnChainCode,
        }),
      );
    },
    signTransaction(path, rawTx) {
      return runSignerAction<Signature>('signTransaction', currentSigner =>
        currentSigner.signTransaction(path, rawTx),
      );
    },
    signPersonalMessage(path, message) {
      return runSignerAction<Signature>('signPersonalMessage', currentSigner =>
        currentSigner.signMessage(path, message),
      );
    },
    signTypedData(path, data) {
      return runSignerAction<Signature>('signTypedData', currentSigner =>
        currentSigner.signTypedData(path, data as TypedData),
      );
    },
    openEthApp() {
      return runDeviceAction(async () => {
        const sessionId = await connectLedgerDeviceById(deviceId);
        const result = await getDmk().sendCommand({
          sessionId,
          command: new OpenAppCommand({ appName: 'Ethereum' }),
        });
        if (!isSuccessCommandResult(result)) {
          throw toLedgerDmkError(result.error);
        }
      });
    },
    quitApp() {
      return runDeviceAction(async () => {
        const sessionId = await connectLedgerDeviceById(deviceId);
        const result = await getDmk().sendCommand({
          sessionId,
          command: new CloseAppCommand(),
        });
        if (!isSuccessCommandResult(result)) {
          throw toLedgerDmkError(result.error);
        }
      });
    },
    getAppAndVersion() {
      return runDeviceAction(async () => {
        const sessionId = await connectLedgerDeviceById(deviceId);
        return readLedgerAppAndVersion(sessionId);
      });
    },
    close() {
      return disconnectLedgerDevice(deviceId);
    },
  };
}
