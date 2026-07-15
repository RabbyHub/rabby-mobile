import type * as LedgerContextModule from '@ledgerhq/context-module/lib/types';
import {
  DeviceActionStatus,
  DeviceLockedError,
  UserInteractionRequired,
  type DeviceManagementKit,
  type DeviceSessionId,
} from '@ledgerhq/device-management-kit';
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
import {
  connectLedgerDeviceById,
  disconnectLedgerDevice,
  getDmk,
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

let fullEthContextModule: LedgerContextModule.ContextModule | undefined;
let basicEthContextModule: LedgerContextModule.ContextModule | undefined;
// ponytail: keep Ledger telemetry off the signing critical path; add async app-owned reporting only if product needs it.
const noOpBlindSigningReporter = {
  report: async () => undefined,
} as unknown as LedgerContextModule.BlindSigningReporter;
const noOpTypedDataLoader: LedgerContextModule.TypedDataContextLoader = {
  load: async () => ({
    type: 'error',
    error: new Error('Ledger typed data clear signing disabled'),
  }),
};

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
    builder.addTypedDataLoader(noOpTypedDataLoader);
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

function getActionStateLabel(state: any) {
  const { step, requiredUserInteraction } = state?.intermediateValue ?? {};

  return [step, requiredUserInteraction]
    .filter(value => typeof value === 'string' && value.length > 0)
    .join('/');
}

function shouldStopWaitingForAction(state: any) {
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
    action.cancel?.();
    throw toLedgerDmkError(new DeviceLockedError());
  }

  if (state.status === DeviceActionStatus.Completed) {
    logLedgerTiming(startedAt, 'dmk-action:completed', {
      actionName: options?.actionName,
    });
    return state.output as T;
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

  let sessionId = await connectLedgerDeviceById(deviceId);
  let signer = buildEthSigner({ sdk: getDmk(), sessionId });
  const refreshSignerSession = async () => {
    const currentSessionId = await connectLedgerDeviceById(deviceId);

    if (currentSessionId !== sessionId) {
      sessionId = currentSessionId;
      signer = buildEthSigner({ sdk: getDmk(), sessionId });
    }

    return currentSessionId;
  };
  let isDeviceActionActive = false;
  const runDeviceAction = async <T>(task: () => Promise<T>) => {
    if (isDeviceActionActive) {
      throw new Error(
        'Ledger: Another request is awaiting confirmation. Finish or cancel it, then try again.',
      );
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
    task: (currentSigner: ReturnType<typeof buildEthSigner>) => {
      observable: Observable<any>;
      cancel?: () => void;
    },
  ) =>
    runDeviceAction(async () => {
      await refreshSignerSession();
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
    getAppAndVersion() {
      return runDeviceAction(async () => {
        const currentSessionId = await refreshSignerSession();
        return readLedgerAppAndVersion(currentSessionId);
      });
    },
    close() {
      return disconnectLedgerDevice(deviceId);
    },
  };
}
