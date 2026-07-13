import * as sigUtil from 'eth-sig-util';

import LedgerKeyring, { type LedgerKeyringSession } from './LedgerKeyring';
import { LedgerHDPathType } from './utils';

const ADDRESS = '0x0000000000000000000000000000000000000001';
const TYPED_DATA = {
  domain: { name: 'Rabby' },
  types: {
    EIP712Domain: [{ name: 'name', type: 'string' }],
    Message: [{ name: 'contents', type: 'string' }],
  },
  primaryType: 'Message',
  message: { contents: 'hello' },
};

describe('LedgerKeyring DMK session adapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses device-scoped DMK sessions and sends Ledger paths without m prefix', async () => {
    const getAddress = jest.fn(async () => ({
      address: ADDRESS,
      publicKey: '04abcdef',
      chainCode: 'chain-code',
    }));
    const close = jest.fn();
    const session = {
      getAddress,
      signTransaction: jest.fn(),
      signPersonalMessage: jest.fn(),
      signTypedData: jest.fn(),
      close,
    } as unknown as LedgerKeyringSession;
    const getLedgerSession = jest.fn(async () => session);

    const keyring = new LedgerKeyring({
      getLedgerSession,
      transportType: 'ble',
    });
    keyring.setDeviceId('ledger-device-id');
    await keyring.setHDPathType(LedgerHDPathType.LedgerLive);

    const accounts = (await keyring.addAccounts(1)) as string[];

    expect(accounts).toEqual([ADDRESS.toLowerCase()]);
    expect(getLedgerSession).toHaveBeenCalledWith('ledger-device-id');
    expect(getAddress).toHaveBeenCalledWith("44'/60'/0'/0/0", {
      returnChainCode: true,
    });
    expect(getAddress).not.toHaveBeenCalledWith(
      "m/44'/60'/0'/0/0",
      expect.anything(),
    );
    expect(keyring.getAccountInfo(ADDRESS)).toMatchObject({
      deviceId: 'ledger-device-id',
      hdPathBasePublicKey: '04abcdef',
      hdPathType: LedgerHDPathType.LedgerLive,
      index: 1,
    });

    await keyring.cleanUp();

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('keeps the DMK session open after a successful transaction signature', async () => {
    const getAddress = jest.fn(async () => ({
      address: ADDRESS,
      publicKey: '04abcdef',
    }));
    const close = jest.fn();
    const session = {
      getAddress,
      signTransaction: jest.fn(async () => ({
        r: '0x1',
        s: '0x2',
        v: '0x1b',
      })),
      signPersonalMessage: jest.fn(),
      signTypedData: jest.fn(),
      close,
    } as unknown as LedgerKeyringSession;
    const getLedgerSession = jest.fn(async () => session);
    const signedTx = {
      verifySignature: jest.fn(() => true),
      getSenderAddress: jest.fn(() => Buffer.from(ADDRESS.slice(2), 'hex')),
    };

    const keyring = new LedgerKeyring({
      accounts: [ADDRESS.toLowerCase()],
      accountDetails: {
        [ADDRESS]: {
          hdPath: "m/44'/60'/0'/0/0",
          deviceId: 'ledger-device-id',
        },
      },
      getLedgerSession,
    });
    keyring.setDeviceId('ledger-device-id');

    await (keyring as any)._signTransaction(ADDRESS, '00', () => signedTx);

    expect(session.signTransaction).toHaveBeenCalledWith(
      "44'/60'/0'/0/0",
      Buffer.from('00', 'hex'),
    );
    expect(getAddress).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();

    await keyring.cleanUp();

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('reuses a DMK session only for the same device id', async () => {
    const sessionA = {
      getAddress: jest.fn(),
      signTransaction: jest.fn(),
      signPersonalMessage: jest.fn(),
      signTypedData: jest.fn(),
      close: jest.fn(),
    } as unknown as LedgerKeyringSession;
    const sessionB = {
      getAddress: jest.fn(),
      signTransaction: jest.fn(),
      signPersonalMessage: jest.fn(),
      signTypedData: jest.fn(),
      close: jest.fn(),
    } as unknown as LedgerKeyringSession;
    const getLedgerSession = jest
      .fn()
      .mockResolvedValueOnce(sessionA)
      .mockResolvedValueOnce(sessionB);
    const keyring = new LedgerKeyring({
      getLedgerSession,
      transportType: 'ble',
    });

    keyring.setDeviceId('device-a');
    await keyring.makeApp();
    await keyring.makeApp();

    expect(getLedgerSession).toHaveBeenCalledTimes(1);
    expect(getLedgerSession).toHaveBeenCalledWith('device-a');

    keyring.setDeviceId('device-b');
    await keyring.makeApp();

    expect(sessionA.close).toHaveBeenCalledTimes(1);
    expect(getLedgerSession).toHaveBeenCalledTimes(2);
    expect(getLedgerSession).toHaveBeenLastCalledWith('device-b');

    await keyring.cleanUp();

    expect(sessionB.close).toHaveBeenCalledTimes(1);
  });

  it('cleans up a stale session when transaction signing fails', async () => {
    const close = jest.fn();
    const session = {
      getAddress: jest.fn(),
      signTransaction: jest.fn(async () => {
        throw new Error('Ledger disconnected');
      }),
      signPersonalMessage: jest.fn(),
      signTypedData: jest.fn(),
      close,
    } as unknown as LedgerKeyringSession;
    const keyring = new LedgerKeyring({
      accounts: [ADDRESS.toLowerCase()],
      accountDetails: {
        [ADDRESS]: {
          hdPath: "m/44'/60'/0'/0/0",
          deviceId: 'ledger-device-id',
        },
      },
      getLedgerSession: jest.fn(async () => session),
    });
    keyring.setDeviceId('ledger-device-id');

    await expect(
      (keyring as any)._signTransaction(ADDRESS, '00', () => undefined),
    ).rejects.toThrow('Ledger disconnected');

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('cleans up a stale session when typed-data signing fails', async () => {
    const close = jest.fn();
    const session = {
      getAddress: jest.fn(),
      signTransaction: jest.fn(),
      signPersonalMessage: jest.fn(),
      signTypedData: jest.fn(async () => {
        throw new Error('Ledger disconnected');
      }),
      close,
    } as unknown as LedgerKeyringSession;
    const keyring = new LedgerKeyring({
      accounts: [ADDRESS.toLowerCase()],
      accountDetails: {
        [ADDRESS]: {
          hdPath: "m/44'/60'/0'/0/0",
          deviceId: 'ledger-device-id',
        },
      },
      getLedgerSession: jest.fn(async () => session),
    });
    keyring.setDeviceId('ledger-device-id');

    await expect(
      keyring.signTypedData(ADDRESS, TYPED_DATA, { version: 'V4' }),
    ).rejects.toThrow('Ledger disconnected');

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('rejects a transaction signature from a different address', async () => {
    const close = jest.fn();
    const session = {
      getAddress: jest.fn(async () => ({
        address: ADDRESS,
        publicKey: '04abcdef',
      })),
      signTransaction: jest.fn(async () => ({
        r: '0x1',
        s: '0x2',
        v: '0x1b',
      })),
      signPersonalMessage: jest.fn(),
      signTypedData: jest.fn(),
      close,
    } as unknown as LedgerKeyringSession;
    const keyring = new LedgerKeyring({
      accounts: [ADDRESS.toLowerCase()],
      accountDetails: {
        [ADDRESS]: {
          hdPath: "m/44'/60'/0'/0/0",
        },
      },
      getLedgerSession: jest.fn(async () => session),
    });
    const signedTx = {
      verifySignature: jest.fn(() => true),
      getSenderAddress: jest.fn(() =>
        Buffer.from('0000000000000000000000000000000000000002', 'hex'),
      ),
    };

    await expect(
      (keyring as any)._signTransaction(ADDRESS, '00', () => signedTx),
    ).rejects.toThrow("signature doesn't match the right address");
    expect(session.getAddress).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('preserves personal_sign hex payload semantics and verifies the recovered signer', async () => {
    const recoverPersonalSignature = jest
      .spyOn(sigUtil, 'recoverPersonalSignature')
      .mockReturnValue(ADDRESS);
    const close = jest.fn();
    const session = {
      getAddress: jest.fn(async () => ({
        address: ADDRESS,
        publicKey: '04abcdef',
      })),
      signTransaction: jest.fn(),
      signPersonalMessage: jest.fn(async () => ({
        r: '0x1',
        s: '0x2',
        v: 27,
      })),
      signTypedData: jest.fn(),
      close,
    } as unknown as LedgerKeyringSession;
    const keyring = new LedgerKeyring({
      accounts: [ADDRESS.toLowerCase()],
      accountDetails: {
        [ADDRESS]: {
          hdPath: "m/44'/60'/0'/0/0",
          deviceId: 'ledger-device-id',
        },
      },
      getLedgerSession: jest.fn(async () => session),
    });
    keyring.setDeviceId('ledger-device-id');

    const signature = await keyring.signPersonalMessage(
      ADDRESS,
      '0x68656c6c6f',
    );

    expect(signature).toBe(
      `0x${'1'.padStart(64, '0')}${'2'.padStart(64, '0')}1b`,
    );
    expect(session.signPersonalMessage).toHaveBeenCalledWith(
      "44'/60'/0'/0/0",
      Buffer.from('68656c6c6f', 'hex'),
    );
    expect(session.getAddress).not.toHaveBeenCalled();
    expect(recoverPersonalSignature).toHaveBeenCalledWith({
      data: '0x68656c6c6f',
      sig: signature,
    });
    expect(close).not.toHaveBeenCalled();
  });

  it('cleans up when personal_sign recovers a different address', async () => {
    jest
      .spyOn(sigUtil, 'recoverPersonalSignature')
      .mockReturnValue('0x0000000000000000000000000000000000000002');
    const close = jest.fn();
    const session = {
      getAddress: jest.fn(async () => ({
        address: ADDRESS,
        publicKey: '04abcdef',
      })),
      signTransaction: jest.fn(),
      signPersonalMessage: jest.fn(async () => ({
        r: '0x1',
        s: '0x2',
        v: 27,
      })),
      signTypedData: jest.fn(),
      close,
    } as unknown as LedgerKeyringSession;
    const keyring = new LedgerKeyring({
      accounts: [ADDRESS.toLowerCase()],
      accountDetails: {
        [ADDRESS]: {
          hdPath: "m/44'/60'/0'/0/0",
          deviceId: 'ledger-device-id',
        },
      },
      getLedgerSession: jest.fn(async () => session),
    });
    keyring.setDeviceId('ledger-device-id');

    await expect(
      keyring.signPersonalMessage(ADDRESS, '0x68656c6c6f'),
    ).rejects.toThrow("signature doesn't match the right address");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('signs typed-data V4 through the session adapter and verifies the recovered signer', async () => {
    const recoverTypedSignature = jest
      .spyOn(sigUtil, 'recoverTypedSignature_v4')
      .mockReturnValue(ADDRESS);
    const close = jest.fn();
    const session = {
      getAddress: jest.fn(async () => ({
        address: ADDRESS,
        publicKey: '04abcdef',
      })),
      signTransaction: jest.fn(),
      signPersonalMessage: jest.fn(),
      signTypedData: jest.fn(async () => ({
        r: '0x3',
        s: '0x4',
        v: '0x1c',
      })),
      close,
    } as unknown as LedgerKeyringSession;
    const keyring = new LedgerKeyring({
      accounts: [ADDRESS.toLowerCase()],
      accountDetails: {
        [ADDRESS]: {
          hdPath: "m/44'/60'/0'/0/0",
          deviceId: 'ledger-device-id',
        },
      },
      getLedgerSession: jest.fn(async () => session),
    });
    keyring.setDeviceId('ledger-device-id');

    const signature = await keyring.signTypedData(ADDRESS, TYPED_DATA, {
      version: 'V4',
    });

    expect(signature).toBe(
      `0x${'3'.padStart(64, '0')}${'4'.padStart(64, '0')}1c`,
    );
    expect(session.signTypedData).toHaveBeenCalledWith(
      "44'/60'/0'/0/0",
      TYPED_DATA,
    );
    expect(session.getAddress).not.toHaveBeenCalled();
    expect(recoverTypedSignature).toHaveBeenCalledWith({
      data: TYPED_DATA,
      sig: signature,
    });
    expect(close).not.toHaveBeenCalled();
  });

  it('rejects non-V4 typed-data before opening a Ledger session', async () => {
    const getLedgerSession = jest.fn();
    const keyring = new LedgerKeyring({
      getLedgerSession,
    });

    await expect(
      keyring.signTypedData(ADDRESS, {}, { version: 'V1' }),
    ).rejects.toThrow('Only version 4');
    await expect(
      keyring.signTypedData(ADDRESS, {}, { version: 'V3' }),
    ).rejects.toThrow('Only version 4');
    expect(getLedgerSession).not.toHaveBeenCalled();
  });

  it('rejects incomplete typed-data before opening a Ledger session', async () => {
    const getLedgerSession = jest.fn();
    const keyring = new LedgerKeyring({
      getLedgerSession,
    });

    await expect(
      keyring.signTypedData(ADDRESS, {}, { version: 'V4' }),
    ).rejects.toThrow('Typed data payload is incomplete');
    expect(getLedgerSession).not.toHaveBeenCalled();
  });
});
