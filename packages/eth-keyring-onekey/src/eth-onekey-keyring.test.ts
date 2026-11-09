import OneKeyKeyring from './eth-onekey-keyring';
import * as sigUtil from 'eth-sig-util';
import * as ethUtil from 'ethereumjs-util';

const SIGNING_PRIVATE_KEY = Buffer.from('1'.repeat(64), 'hex');
const SIGNING_ADDRESS = ethUtil.toChecksumAddress(
  ethUtil.bufferToHex(ethUtil.privateToAddress(SIGNING_PRIVATE_KEY)),
);
const OTHER_ADDRESS = ethUtil.toChecksumAddress(
  ethUtil.bufferToHex(
    ethUtil.privateToAddress(Buffer.from('2'.repeat(64), 'hex')),
  ),
);

function createBridge() {
  return {
    init: jest.fn(),
    evmSignTransaction: jest.fn(),
    evmSignMessage: jest.fn(),
    evmSignTypedData: jest.fn(),
    searchDevices: jest.fn(),
    getPassphraseState: jest.fn(),
    evmGetPublicKey: jest.fn(),
    getDeviceState: jest.fn(),
    receivePin: jest.fn(),
    receivePassphrase: jest.fn(),
    cancel: jest.fn(),
    dispose: jest.fn(),
  } as any;
}

function createTypedDataWithNullDomainValue() {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Person: [
        { name: 'name', type: 'string' },
        { name: 'wallet', type: 'address' },
      ],
      Mail: [
        { name: 'from', type: 'Person' },
        { name: 'to', type: 'Person' },
        { name: 'contents', type: 'string' },
      ],
    },
    primaryType: 'Mail',
    domain: {
      name: 'Ether Mail',
      version: '1',
      chainId: 1,
      verifyingContract: null,
    },
    message: {
      from: {
        name: 'Cow',
        wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
      },
      to: {
        name: 'Bob',
        wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
      },
      contents: 'Hello, Bob!',
    },
  };
}

function createValidTypedData() {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'chainId', type: 'uint256' },
      ],
      Order: [
        { name: 'collection', type: 'address' },
        { name: 'assetType', type: 'uint8' },
        { name: 'expirationTime', type: 'uint256' },
      ],
    },
    primaryType: 'Order',
    domain: {
      name: 'Blur',
      chainId: 1,
    },
    message: {
      collection: '0xb2ecfe4e4d61f8790bbb9de2d1259b9e2410cea5',
      assetType: '0',
      expirationTime: '1739484503',
    },
  };
}

function stripHexPrefix(value: string) {
  return value.startsWith('0x') ? value.slice(2) : value;
}

function prepareUnlockedKeyring({
  bridge,
  address = SIGNING_ADDRESS,
}: {
  bridge: ReturnType<typeof createBridge>;
  address?: string;
}) {
  const keyring = new OneKeyKeyring({
    bridge,
    accounts: [address],
    accountDetails: {
      [ethUtil.toChecksumAddress(address)]: {
        hdPath: "m/44'/60'/0'/0/0",
        hdPathBasePublicKey: 'base-public-key',
        hdPathType: 'BIP44',
        index: 0,
      },
    },
  });

  jest.spyOn(keyring, 'unlock').mockResolvedValue('already unlocked');

  return keyring;
}

describe('OneKeyKeyring signTypedData', () => {
  it('waits for bridge initialization before probing a device', async () => {
    const bridge = createBridge();
    let resolveInit!: () => void;
    const initPromise = new Promise<void>(resolve => {
      resolveInit = resolve;
    });
    bridge.init.mockReturnValue(initPromise);
    bridge.getDeviceState.mockResolvedValue({
      success: true,
      payload: {
        identity: { deviceId: 'device-id' },
      },
    });
    const keyring = new OneKeyKeyring({ bridge });
    keyring.setDeviceConnectId('connect-id');

    const devicePromise = keyring.trySearchDevice();
    await Promise.resolve();

    expect(bridge.getDeviceState).not.toHaveBeenCalled();

    resolveInit();

    await expect(devicePromise).resolves.toEqual({
      connectId: 'connect-id',
      deviceId: 'device-id',
    });
    expect(bridge.getDeviceState).toHaveBeenCalledWith('connect-id');
  });

  it.each(['V1', 'V2'])(
    'initializes a discovered %s device before requiring its identity',
    async protocol => {
      const bridge = createBridge();
      bridge.searchDevices.mockResolvedValue({
        success: true,
        payload: [{ connectId: 'connect-id', deviceId: null }],
      });
      bridge.getDeviceState.mockResolvedValue({
        success: true,
        payload: { protocol, identity: { deviceId: 'device-id' } },
      });
      const keyring = new OneKeyKeyring({ bridge });

      await expect(keyring.trySearchDevice()).resolves.toEqual({
        connectId: 'connect-id',
        deviceId: 'device-id',
      });
    },
  );

  it('rejects a failed identity read instead of using the connection id as device identity', async () => {
    const bridge = createBridge();
    bridge.searchDevices.mockResolvedValue({
      success: true,
      payload: [{ connectId: 'connect-id', deviceId: null }],
    });
    bridge.getDeviceState.mockResolvedValue({
      success: false,
      payload: { error: 'Device disconnected' },
    });
    const keyring = new OneKeyKeyring({ bridge });

    await expect(keyring.trySearchDevice()).rejects.toThrow(
      'Device disconnected',
    );
  });

  it('rejects null typed-data fields with a readable error before hardware signing', async () => {
    const bridge = createBridge();
    const keyring = new OneKeyKeyring({ bridge });

    await expect(
      keyring.signTypedData(
        '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        createTypedDataWithNullDomainValue(),
        { version: 'V4' },
      ),
    ).rejects.toThrow(
      'Invalid EIP-712 typed data: null is not a valid value for typed signing',
    );

    expect(bridge.evmSignTypedData).not.toHaveBeenCalled();
  });

  it('verifies typed-data signatures by the recovered signer instead of SDK payload address casing', async () => {
    const bridge = createBridge();
    const typedData = createValidTypedData();
    const signature = sigUtil.signTypedData_v4(SIGNING_PRIVATE_KEY, {
      data: typedData as any,
    });
    bridge.evmSignTypedData.mockResolvedValue({
      success: true,
      payload: {
        address: SIGNING_ADDRESS.toLowerCase(),
        signature: stripHexPrefix(signature),
      },
    });
    const keyring = prepareUnlockedKeyring({ bridge });

    await expect(
      keyring.signTypedData(SIGNING_ADDRESS, typedData, { version: 'V4' }),
    ).resolves.toBe(signature);
  });

  it('rejects typed-data signatures recovered from a different account', async () => {
    const bridge = createBridge();
    const typedData = createValidTypedData();
    const signature = sigUtil.signTypedData_v4(
      Buffer.from('2'.repeat(64), 'hex'),
      {
        data: typedData as any,
      },
    );
    bridge.evmSignTypedData.mockResolvedValue({
      success: true,
      payload: {
        address: OTHER_ADDRESS,
        signature: stripHexPrefix(signature),
      },
    });
    const keyring = prepareUnlockedKeyring({ bridge });

    await expect(
      keyring.signTypedData(SIGNING_ADDRESS, typedData, { version: 'V4' }),
    ).rejects.toThrow('signature doesnt match the right address');
  });
});

describe('OneKeyKeyring unlock wallet selection', () => {
  const publicKey =
    '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

  /**
   * Create a keyring backed by a mocked V2 bridge.
   *
   * @param passphraseState - The wallet id returned by getPassphraseState.
   * @param status - The device status returned by getDeviceState.
   * @param status.passphraseProtection - Whether passphrase protection is on.
   * @returns The mocked bridge and keyring.
   */
  function setup(
    passphraseState?: string,
    status?: { passphraseProtection?: boolean },
  ) {
    const bridge = createBridge();
    bridge.init.mockResolvedValue(undefined);
    bridge.searchDevices.mockResolvedValue({
      success: true,
      payload: [{ connectId: 'connect-id', deviceId: null }],
    });
    bridge.getDeviceState.mockResolvedValue({
      success: true,
      payload: {
        protocol: 'V2',
        identity: { deviceId: 'device-id' },
        ...(status ? { status } : {}),
      },
    });
    bridge.getPassphraseState.mockResolvedValue({
      success: true,
      payload: passphraseState,
    });
    bridge.evmGetPublicKey.mockResolvedValue({
      success: true,
      payload: { pub: publicKey, node: { chain_code: '11'.repeat(32) } },
    });
    const keyring = new OneKeyKeyring({ bridge });
    return { bridge, keyring };
  }

  it('selects the standard wallet on a V2 device with passphrase protection off', async () => {
    // Real Pro 2 firmware returns the standard-wallet session id
    // (btc_test_address) even when passphrase protection is off.
    const { bridge, keyring } = setup('bc1q-standard-wallet-session', {
      passphraseProtection: false,
    });

    expect(await keyring.unlock()).toBe('just unlocked');
    expect(bridge.getPassphraseState).toHaveBeenCalledTimes(1);
    expect(bridge.getPassphraseState).toHaveBeenCalledWith('connect-id', {
      useEmptyPassphrase: true,
    });
    expect(bridge.evmGetPublicKey).toHaveBeenCalledWith(
      'connect-id',
      'device-id',
      expect.objectContaining({
        passphraseState: undefined,
        useEmptyPassphrase: true,
      }),
    );
    expect(keyring.passphraseState).toBeUndefined();
  });

  it.each([
    [{ error: 'Passphrase disabled', code: 999 }],
    [{ error: 'Device not opened passphrase', code: 113 }],
  ])(
    'retries with the standard wallet when wallet selection fails with %p',
    async failure => {
      const { bridge, keyring } = setup('bc1q-standard-wallet-session');
      bridge.getPassphraseState
        .mockResolvedValueOnce({ success: false, payload: failure })
        .mockResolvedValueOnce({
          success: true,
          payload: 'bc1q-standard-wallet-session',
        });

      expect(await keyring.unlock()).toBe('just unlocked');
      expect(bridge.getPassphraseState).toHaveBeenNthCalledWith(
        1,
        'connect-id',
        undefined,
      );
      expect(bridge.getPassphraseState).toHaveBeenNthCalledWith(
        2,
        'connect-id',
        { useEmptyPassphrase: true },
      );
      expect(bridge.evmGetPublicKey).toHaveBeenCalledWith(
        'connect-id',
        'device-id',
        expect.objectContaining({
          passphraseState: undefined,
          useEmptyPassphrase: true,
        }),
      );
    },
  );

  it('keeps the hidden wallet passphraseState when passphrase protection is on', async () => {
    const { bridge, keyring } = setup('hidden-wallet-token', {
      passphraseProtection: true,
    });

    expect(await keyring.unlock()).toBe('just unlocked');
    expect(bridge.getPassphraseState).toHaveBeenCalledWith(
      'connect-id',
      undefined,
    );
    expect(bridge.evmGetPublicKey).toHaveBeenCalledWith(
      'connect-id',
      'device-id',
      expect.objectContaining({
        passphraseState: 'hidden-wallet-token',
        useEmptyPassphrase: false,
      }),
    );
    expect(keyring.passphraseState).toBe('hidden-wallet-token');
  });

  it('rejects unlock failures with an Error that carries the device message', async () => {
    const { bridge, keyring } = setup();
    bridge.getPassphraseState.mockResolvedValue({
      success: false,
      payload: { error: 'Some wallet session failure', code: 800 },
    });

    const error = await keyring.unlock().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Some wallet session failure');
    expect(bridge.evmGetPublicKey).not.toHaveBeenCalled();
  });

  it('signs with the standard wallet after a passphrase-off unlock', async () => {
    const { bridge, keyring } = setup('bc1q-standard-wallet-session', {
      passphraseProtection: false,
    });
    await keyring.unlock();
    const address = keyring._addressFromIndex('m', 0);
    bridge.evmSignMessage.mockResolvedValue({
      success: false,
      payload: { error: 'stop here' },
    });

    await expect(keyring.signPersonalMessage(address, '0x01')).rejects.toThrow(
      'stop here',
    );
    expect(bridge.evmSignMessage).toHaveBeenCalledWith(
      'connect-id',
      'device-id',
      expect.objectContaining({
        passphraseState: undefined,
        useEmptyPassphrase: true,
      }),
    );
  });
});
