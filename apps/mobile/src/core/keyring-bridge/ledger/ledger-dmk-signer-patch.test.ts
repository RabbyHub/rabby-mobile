import {
  CommandResultFactory,
  DeviceActionStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
} from '@ledgerhq/device-management-kit';
import { SignTransactionDeviceAction } from '@ledgerhq/device-signer-kit-ethereum/internal/app-binder/device-action/SignTransaction/SignTransactionDeviceAction';
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
});
