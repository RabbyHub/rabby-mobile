import LedgerKeyring, { type LedgerKeyringSession } from './LedgerKeyring';
import { LedgerHDPathType } from './utils';

const ADDRESS = '0x0000000000000000000000000000000000000001';

describe('LedgerKeyring DMK session adapter', () => {
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
    expect(getAddress).toHaveBeenCalledWith("44'/60'/0'/0/0", {
      returnChainCode: true,
    });
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

  it('cleans up a stale session when transaction address verification fails', async () => {
    const close = jest.fn();
    const session = {
      getAddress: jest.fn(async () => {
        throw new Error('Ledger disconnected');
      }),
      signTransaction: jest.fn(),
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

  it('cleans up a stale session when typed-data address verification fails', async () => {
    const close = jest.fn();
    const session = {
      getAddress: jest.fn(async () => {
        throw new Error('Ledger disconnected');
      }),
      signTransaction: jest.fn(),
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
      keyring.signTypedData(ADDRESS, {}, { version: 'V4' }),
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
    expect(session.getAddress).toHaveBeenCalledWith("44'/60'/0'/0/0", {
      returnChainCode: true,
    });
    expect(close).toHaveBeenCalledTimes(1);
  });
});
