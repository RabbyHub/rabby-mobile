import * as sigUtil from 'eth-sig-util';

import LedgerKeyring, {
  LedgerKeyringBusyError,
  type LedgerKeyringSession,
} from './LedgerKeyring';
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

  it('forwards app management and version reads to the DMK session', async () => {
    const openEthApp = jest.fn(async () => undefined);
    const quitApp = jest.fn(async () => undefined);
    const getAppAndVersion = jest.fn(async () => ({
      appName: 'Ethereum',
      version: '1.2.3',
    }));
    const session = {
      getAddress: jest.fn(),
      signTransaction: jest.fn(),
      signPersonalMessage: jest.fn(),
      signTypedData: jest.fn(),
      openEthApp,
      quitApp,
      getAppAndVersion,
    } as unknown as LedgerKeyringSession;
    const keyring = new LedgerKeyring({
      getLedgerSession: jest.fn(async () => session),
    });
    keyring.setDeviceId('ledger-device-id');

    await expect(keyring.openEthApp()).resolves.toEqual(Buffer.alloc(0));
    await expect(keyring.quitApp()).resolves.toEqual(Buffer.alloc(0));
    await expect(keyring.getAppAndVersion()).resolves.toEqual({
      appName: 'Ethereum',
      version: '1.2.3',
    });

    expect(openEthApp).toHaveBeenCalledTimes(1);
    expect(quitApp).toHaveBeenCalledTimes(1);
    expect(getAppAndVersion).toHaveBeenCalledTimes(1);
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

  it('keeps session initialization single-flight and discards a switched device', async () => {
    let resolveSessionA: (session: LedgerKeyringSession) => void = () =>
      undefined;
    let markSessionAStarted: () => void = () => undefined;
    const sessionAStarted = new Promise<void>(resolve => {
      markSessionAStarted = resolve;
    });
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
    const getLedgerSession = jest.fn((deviceId?: string) => {
      if (deviceId === 'device-a') {
        markSessionAStarted();
        return new Promise<LedgerKeyringSession>(resolve => {
          resolveSessionA = resolve;
        });
      }
      return Promise.resolve(sessionB);
    });
    const keyring = new LedgerKeyring({ getLedgerSession });

    keyring.setDeviceId('device-a');
    const firstA = keyring.makeApp();
    const secondA = keyring.makeApp();
    const firstARejected = expect(firstA).rejects.toThrow(
      'Ledger: Device changed while connecting',
    );
    const secondARejected = expect(secondA).rejects.toThrow(
      'Ledger: Device changed while connecting',
    );

    await sessionAStarted;
    expect(getLedgerSession).toHaveBeenCalledTimes(1);

    keyring.setDeviceId('device-b');
    const connectB = keyring.makeApp();
    resolveSessionA(sessionA);

    await firstARejected;
    await secondARejected;
    await connectB;

    expect(sessionA.close).toHaveBeenCalledTimes(1);
    expect(getLedgerSession).toHaveBeenCalledTimes(2);
    expect(getLedgerSession).toHaveBeenLastCalledWith('device-b');
    expect(keyring.session).toBe(sessionB);
    expect(keyring.sessionDeviceId).toBe('device-b');

    await keyring.cleanUp();
    expect(sessionB.close).toHaveBeenCalledTimes(1);
  });

  it('does not label an imported address with a device selected mid-read', async () => {
    let resolveAddress: (address: {
      address: string;
      publicKey: string;
      chainCode: string;
    }) => void = () => undefined;
    let markAddressStarted: () => void = () => undefined;
    const addressStarted = new Promise<void>(resolve => {
      markAddressStarted = resolve;
    });
    const session = {
      getAddress: jest.fn(() => {
        markAddressStarted();
        return new Promise(resolve => {
          resolveAddress = resolve;
        });
      }),
      signTransaction: jest.fn(),
      signPersonalMessage: jest.fn(),
      signTypedData: jest.fn(),
      close: jest.fn(),
    } as unknown as LedgerKeyringSession;
    const keyring = new LedgerKeyring({
      getLedgerSession: jest.fn(async () => session),
    });

    keyring.setDeviceId('device-a');
    const importing = keyring.addAccounts(1);

    await addressStarted;
    keyring.setDeviceId('device-b');
    resolveAddress({
      address: ADDRESS,
      publicKey: '04abcdef',
      chainCode: 'chain-code',
    });

    await expect(importing).rejects.toThrow(
      'Ledger: Device changed while importing accounts',
    );
    expect(keyring.accountDetails).toEqual({});

    await keyring.cleanUp();
  });

  it('does not persist an account when the device changes during its base-key read', async () => {
    let addressReadCount = 0;
    let resolveBaseKey: (address: {
      address: string;
      publicKey: string;
      chainCode: string;
    }) => void = () => undefined;
    let markBaseKeyStarted: () => void = () => undefined;
    const baseKeyStarted = new Promise<void>(resolve => {
      markBaseKeyStarted = resolve;
    });
    const resolvedAddress = {
      address: ADDRESS,
      publicKey: '04abcdef',
      chainCode: 'chain-code',
    };
    const session = {
      getAddress: jest.fn(() => {
        addressReadCount += 1;
        if (addressReadCount < 3) {
          return Promise.resolve(resolvedAddress);
        }

        markBaseKeyStarted();
        return new Promise(resolve => {
          resolveBaseKey = resolve;
        });
      }),
      signTransaction: jest.fn(),
      signPersonalMessage: jest.fn(),
      signTypedData: jest.fn(),
      close: jest.fn(),
    } as unknown as LedgerKeyringSession;
    const keyring = new LedgerKeyring({
      getLedgerSession: jest.fn(async () => session),
    });

    keyring.setDeviceId('device-a');
    const importing = keyring.addAccounts(1);

    await baseKeyStarted;
    keyring.setDeviceId('device-b');
    resolveBaseKey(resolvedAddress);

    await expect(importing).rejects.toThrow(
      'Ledger: Device changed while importing accounts',
    );
    expect(keyring.accountDetails).toEqual({});
    await expect(keyring.getAccounts()).resolves.toEqual([]);

    await keyring.cleanUp();
  });

  it('cleans up a stale session when transaction signing fails', async () => {
    const close = jest.fn(async () => {
      throw new Error('DeviceSessionNotFound while closing');
    });
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

  it('does not close the active session when a concurrent signature is rejected', async () => {
    let resolveSignature: (signature: {
      r: string;
      s: string;
      v: string;
    }) => void = () => undefined;
    let markSigningStarted: () => void = () => undefined;
    const signingStarted = new Promise<void>(resolve => {
      markSigningStarted = resolve;
    });
    const close = jest.fn();
    const session = {
      getAddress: jest.fn(),
      signTransaction: jest
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise(resolve => {
              resolveSignature = resolve;
              markSigningStarted();
            }),
        )
        .mockRejectedValueOnce(new LedgerKeyringBusyError()),
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
    const signedTx = {
      verifySignature: jest.fn(() => true),
      getSenderAddress: jest.fn(() => Buffer.from(ADDRESS.slice(2), 'hex')),
    };
    keyring.setDeviceId('ledger-device-id');

    const first = (keyring as any)._signTransaction(
      ADDRESS,
      '00',
      () => signedTx,
    );
    await signingStarted;

    await expect(
      (keyring as any)._signTransaction(ADDRESS, '00', () => signedTx),
    ).rejects.toThrow('Another request is awaiting confirmation');
    expect(close).not.toHaveBeenCalled();

    resolveSignature({ r: '0x1', s: '0x2', v: '0x1b' });
    await expect(first).resolves.toBe(signedTx);
    expect(close).not.toHaveBeenCalled();
  });

  it('does not close a replacement session when an old signature fails', async () => {
    let rejectOldSignature: (error: Error) => void = () => undefined;
    let markSigningStarted: () => void = () => undefined;
    const signingStarted = new Promise<void>(resolve => {
      markSigningStarted = resolve;
    });
    const sessionA = {
      getAddress: jest.fn(),
      signTransaction: jest.fn(
        () =>
          new Promise((_, reject) => {
            rejectOldSignature = reject;
            markSigningStarted();
          }),
      ),
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
      accounts: [ADDRESS.toLowerCase()],
      accountDetails: {
        [ADDRESS]: {
          hdPath: "m/44'/60'/0'/0/0",
          deviceId: 'device-a',
        },
      },
      getLedgerSession,
    });
    keyring.setDeviceId('device-a');

    const staleSigning = (keyring as any)._signTransaction(
      ADDRESS,
      '00',
      () => undefined,
    );
    const staleSigningRejected = expect(staleSigning).rejects.toThrow(
      'old signature failed',
    );
    await signingStarted;

    keyring.setDeviceId('device-b');
    await keyring.makeApp();
    expect(sessionA.close).toHaveBeenCalledTimes(1);

    rejectOldSignature(new Error('old signature failed'));
    await staleSigningRejected;

    expect(keyring.session).toBe(sessionB);
    expect(sessionB.close).not.toHaveBeenCalled();

    await keyring.cleanUp();
    expect(sessionB.close).toHaveBeenCalledTimes(1);
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
