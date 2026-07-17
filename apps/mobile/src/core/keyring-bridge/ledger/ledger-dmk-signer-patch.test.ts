import {
  CommandResultFactory,
  DeviceActionStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
} from '@ledgerhq/device-management-kit';
import { SignTransactionDeviceAction } from '@ledgerhq/device-signer-kit-ethereum/internal/app-binder/device-action/SignTransaction/SignTransactionDeviceAction';
import { SignTypedDataDeviceAction } from '@ledgerhq/device-signer-kit-ethereum/internal/app-binder/device-action/SignTypedData/SignTypedDataDeviceAction';
import { TransactionType } from '@ledgerhq/device-signer-kit-ethereum/api/model/TransactionType';
import { lastValueFrom } from 'rxjs';

const createAction = (getAddress: jest.Mock) => {
  const action = new SignTransactionDeviceAction({
    input: {
      derivationPath: "44'/60'/0'/0/0",
      transaction: new Uint8Array(),
      options: { skipOpenApp: true },
      contextModule: {} as never,
      mapper: {} as never,
      parser: {} as never,
    },
  });

  jest.spyOn(action, 'extractDependencies').mockReturnValue({
    getAppConfig: jest.fn(async () =>
      CommandResultFactory({
        data: {
          blindSigningEnabled: false,
          web3ChecksEnabled: false,
          web3ChecksOptIn: false,
          version: '1.15.0',
        },
      }),
    ),
    web3CheckOptIn: jest.fn(),
    parseTransaction: jest.fn(async () => ({
      subset: {
        chainId: 1,
        data: '0x',
        selector: '0x',
        to: '0x',
        value: 0n,
      },
      type: TransactionType.EIP1559,
    })),
    getAddress,
    buildContexts: jest.fn(),
    provideContexts: jest.fn(),
    signTransaction: jest.fn(),
    detectBlindSigning: jest.fn(),
  } as never);

  return action;
};

const internalApi = {
  getDeviceSessionState: jest.fn(() => ({
    sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
    deviceStatus: DeviceStatus.CONNECTED,
    currentApp: { name: 'Ethereum', version: '1.15.0' },
  })),
  getDeviceModel: jest.fn(() => ({ id: DeviceModelId.FLEX })),
} as never;

const typedDataSignature = {
  v: 27,
  r: `0x${'1'.repeat(64)}`,
  s: `0x${'2'.repeat(64)}`,
};

const createTypedDataAction = (
  overrides: {
    getAddress?: jest.Mock;
    signTypedData?: jest.Mock;
  } = {},
) => {
  const action = new SignTypedDataDeviceAction({
    input: {
      derivationPath: "44'/60'/0'/0/0",
      data: {
        domain: { chainId: 1 },
        types: {},
        primaryType: 'Message',
        message: {},
      },
      contextModule: {} as never,
      parser: {} as never,
      transactionParser: {} as never,
      transactionMapper: {} as never,
      skipOpenApp: true,
    },
  });

  const dependencies = {
    getAppConfig: jest.fn(async () =>
      CommandResultFactory({
        data: {
          blindSigningEnabled: false,
          web3ChecksEnabled: false,
          web3ChecksOptIn: false,
          version: '1.15.0',
        },
      }),
    ),
    web3CheckOptIn: jest.fn(),
    getAddress:
      overrides.getAddress ??
      jest.fn(async () =>
        CommandResultFactory({
          data: { address: '0x0000000000000000000000000000000000000001' },
        }),
      ),
    buildContext: jest.fn(async () => ({
      clearSignContext: { isJust: () => false },
      clearSigningType: null,
      contextErrorCount: 0,
    })),
    provideContext: jest.fn(async () =>
      CommandResultFactory({ data: undefined }),
    ),
    signTypedData:
      overrides.signTypedData ??
      jest.fn(async () =>
        CommandResultFactory({ data: typedDataSignature as never }),
      ),
    signTypedDataLegacy: jest.fn(async () =>
      CommandResultFactory({ data: typedDataSignature as never }),
    ),
    detectBlindSigning: jest.fn(async () => ({ isBlindSign: false })),
  };

  jest
    .spyOn(action, 'extractDependencies')
    .mockReturnValue(dependencies as never);

  return { action, dependencies };
};

const expectNoTypedDataDownstream = (
  dependencies: ReturnType<typeof createTypedDataAction>['dependencies'],
) => {
  for (const dependency of [
    dependencies.buildContext,
    dependencies.provideContext,
    dependencies.signTypedData,
    dependencies.signTypedDataLegacy,
    dependencies.detectBlindSigning,
  ]) {
    expect(dependency).not.toHaveBeenCalled();
  }
};

describe('Ledger signer patch', () => {
  it('preserves a GetAddress transport rejection', async () => {
    const error = { _tag: 'DeviceDisconnectedWhileSendingError' };
    const getAddress = jest.fn(async () => Promise.reject(error));
    const action = createAction(getAddress);

    await expect(
      lastValueFrom(action._execute(internalApi).observable),
    ).resolves.toEqual({
      status: DeviceActionStatus.Error,
      error,
    });
    expect(getAddress).toHaveBeenCalledTimes(1);
  });

  it('preserves a GetAddress command error', async () => {
    const error = { _tag: 'DeviceDisconnectedWhileSendingError' };
    const getAddress = jest.fn(async () =>
      CommandResultFactory({ error: error as never }),
    );
    const action = createAction(getAddress);

    await expect(
      lastValueFrom(action._execute(internalApi).observable),
    ).resolves.toEqual({
      status: DeviceActionStatus.Error,
      error,
    });
    expect(getAddress).toHaveBeenCalledTimes(1);
  });

  it('does not retry typed-data signing after a 5501 rejection', async () => {
    const error = { errorCode: '5501', message: 'User refused' };
    const signTypedData = jest.fn(async () =>
      CommandResultFactory({ error: error as never }),
    );
    const { action, dependencies } = createTypedDataAction({ signTypedData });

    await expect(
      lastValueFrom(action._execute(internalApi).observable),
    ).resolves.toEqual({
      status: DeviceActionStatus.Error,
      error,
    });
    expect(signTypedData).toHaveBeenCalledTimes(1);
    expect(dependencies.signTypedDataLegacy).not.toHaveBeenCalled();
  });

  it('does not retry typed-data signing after a session error', async () => {
    const error = { _tag: 'DeviceDisconnectedWhileSendingError' };
    const signTypedData = jest.fn(async () =>
      CommandResultFactory({ error: error as never }),
    );
    const { action, dependencies } = createTypedDataAction({ signTypedData });

    await expect(
      lastValueFrom(action._execute(internalApi).observable),
    ).resolves.toEqual({
      status: DeviceActionStatus.Error,
      error,
    });
    expect(signTypedData).toHaveBeenCalledTimes(1);
    expect(dependencies.signTypedDataLegacy).not.toHaveBeenCalled();
  });

  it('preserves a typed-data GetAddress transport rejection', async () => {
    const error = { _tag: 'DeviceDisconnectedWhileSendingError' };
    const getAddress = jest.fn(async () => Promise.reject(error));
    const { action, dependencies } = createTypedDataAction({ getAddress });

    await expect(
      lastValueFrom(action._execute(internalApi).observable),
    ).resolves.toEqual({
      status: DeviceActionStatus.Error,
      error,
    });
    expect(getAddress).toHaveBeenCalledTimes(1);
    expectNoTypedDataDownstream(dependencies);
  });

  it('preserves a typed-data GetAddress command error', async () => {
    const error = { errorCode: '5515', message: 'Device is locked' };
    const getAddress = jest.fn(async () =>
      CommandResultFactory({ error: error as never }),
    );
    const { action, dependencies } = createTypedDataAction({ getAddress });

    await expect(
      lastValueFrom(action._execute(internalApi).observable),
    ).resolves.toEqual({
      status: DeviceActionStatus.Error,
      error,
    });
    expect(getAddress).toHaveBeenCalledTimes(1);
    expectNoTypedDataDownstream(dependencies);
  });
});
