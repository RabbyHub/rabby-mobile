import { TransactionFactory } from '@ethereumjs/tx';
import * as sigUtil from 'eth-sig-util';
import * as ethUtil from 'ethereumjs-util';
import HDKey from 'hdkey';

import OneKeyKeyring from './eth-onekey-keyring';

const SIGNING_PRIVATE_KEY = Buffer.from('1'.repeat(64), 'hex');
const SIGNING_ADDRESS = ethUtil.toChecksumAddress(
  ethUtil.bufferToHex(ethUtil.privateToAddress(SIGNING_PRIVATE_KEY)),
);
const OTHER_ADDRESS = ethUtil.toChecksumAddress(
  ethUtil.bufferToHex(
    ethUtil.privateToAddress(Buffer.from('2'.repeat(64), 'hex')),
  ),
);
const SIGNING_PUBLIC_KEY = ethUtil
  .privateToPublic(SIGNING_PRIVATE_KEY)
  .toString('hex');
const OTHER_PUBLIC_KEY = ethUtil
  .privateToPublic(Buffer.from('2'.repeat(64), 'hex'))
  .toString('hex');

/**
 * Build a mocked OneKey bridge.
 *
 * @returns The mocked bridge.
 */
function createBridge() {
  return {
    init: jest.fn(),
    initSession: jest.fn(),
    evmSignTransaction: jest.fn(),
    evmSignMessage: jest.fn(),
    evmSignTypedData: jest.fn(),
    searchDevices: jest.fn(),
    getPassphraseState: jest.fn(),
    openWalletSession: undefined,
    evmGetPublicKey: jest.fn(),
    getDeviceState: jest.fn(),
    receivePin: jest.fn(),
    receivePassphrase: jest.fn(),
    cancel: jest.fn(),
    dispose: jest.fn(),
  } as any;
}

/**
 * Opt a mocked bridge into the optional wallet-session API.
 *
 * @param bridge - The mocked bridge.
 * @returns The session mock.
 */
function mockOpenWalletSession(bridge: ReturnType<typeof createBridge>) {
  // The bridge interface declares the session API as optional; tests opt in
  // per case so the legacy getPassphraseState fallback stays covered.
  // eslint-disable-next-line jest/prefer-spy-on
  bridge.openWalletSession = jest.fn();
  return bridge.openWalletSession as jest.Mock;
}

/**
 * Build typed data with a null domain field.
 *
 * @returns Invalid typed data.
 */
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

/**
 * Build valid EIP-712 typed data.
 *
 * @returns Typed data.
 */
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

/**
 * Strip a 0x prefix from a hex string.
 *
 * @param value - The hex string.
 * @returns The unprefixed hex.
 */
function stripHexPrefix(value: string) {
  return value.startsWith('0x') ? value.slice(2) : value;
}

/**
 * Prepare an already-unlocked keyring for signing tests.
 *
 * @param args - The test fixtures.
 * @param args.bridge - The mocked bridge.
 * @param args.address - The account address.
 * @returns The keyring.
 */
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

describe('OneKeyKeyring SDK error propagation', () => {
  it.each([
    {
      payload: { code: 105, error: 'Device not found' },
      message: 'Device not found',
    },
    { payload: { code: 0 }, message: 'searchDevices failed' },
  ])(
    'preserves searchDevices failure $payload',
    async ({ payload, message }) => {
      const bridge = createBridge();
      bridge.searchDevices.mockResolvedValue({ success: false, payload });
      const keyring = new OneKeyKeyring({ bridge });

      const failure = keyring.unlock();
      await expect(failure).rejects.toBeInstanceOf(Error);
      await expect(failure).rejects.toMatchObject({
        message,
        code: payload.code,
      });
    },
  );

  it.each([true, false])(
    'preserves getDeviceState failure with a preset connection: %s',
    async presetConnection => {
      const bridge = createBridge();
      bridge.searchDevices.mockResolvedValue({
        success: true,
        payload: [{ connectId: 'connect-id', deviceId: null }],
      });
      bridge.getDeviceState.mockResolvedValue({
        success: false,
        payload: { code: 117, error: 'Device busy' },
      });
      const keyring = new OneKeyKeyring({ bridge });
      if (presetConnection) {
        keyring.setDeviceConnectId('connect-id');
      }

      await expect(keyring.unlock()).rejects.toMatchObject({
        message: 'Device busy',
        code: 117,
      });
    },
  );

  it.each([
    {
      rejection: { message: 'Pairing failed', code: 709 },
      message: 'Pairing failed',
      code: 709,
    },
    {
      rejection: { message: 'Pairing failed', errorCode: 715 },
      message: 'Pairing failed',
      code: 715,
    },
    {
      rejection: { error: 'Pairing failed', code: 718 },
      message: '{"error":"Pairing failed","code":718}',
      code: 718,
    },
  ])(
    'preserves codes on rejected objects: $rejection',
    async ({ rejection, message, code }) => {
      const bridge = createBridge();
      bridge.init.mockRejectedValue(rejection);
      const keyring = new OneKeyKeyring({ bridge });

      const failure = keyring.unlock();
      await expect(failure).rejects.toBeInstanceOf(Error);
      await expect(failure).rejects.toMatchObject({ message, code });
    },
  );

  it('preserves evmSignTransaction failure through signTransaction', async () => {
    const bridge = createBridge();
    bridge.evmSignTransaction.mockResolvedValue({
      success: false,
      payload: { code: 801, error: 'PIN invalid' },
    });
    const keyring = prepareUnlockedKeyring({ bridge });

    await expect(
      keyring.signTransaction(
        SIGNING_ADDRESS,
        TransactionFactory.fromTxData({}),
      ),
    ).rejects.toMatchObject({ message: 'PIN invalid', code: 801 });
  });

  it('preserves evmSignMessage failure', async () => {
    const bridge = createBridge();
    bridge.evmSignMessage.mockResolvedValue({
      success: false,
      payload: { code: 802, error: 'Action cancelled' },
    });
    const keyring = prepareUnlockedKeyring({ bridge });

    await expect(
      keyring.signPersonalMessage(SIGNING_ADDRESS, '0x01'),
    ).rejects.toMatchObject({ message: 'Action cancelled', code: 802 });
  });

  it.each(['unlock', 'evmSignMessage', 'evmSignTypedData'])(
    'keeps a rejected Error with code from %s',
    async method => {
      const bridge = createBridge();
      const keyring = prepareUnlockedKeyring({ bridge });
      const error = Object.assign(new Error('Device busy'), { code: 117 });
      if (method === 'unlock') {
        jest.spyOn(keyring, 'unlock').mockRejectedValue(error);
      } else {
        bridge[method].mockRejectedValue(error);
      }

      const failure =
        method === 'evmSignTypedData'
          ? keyring.signTypedData(SIGNING_ADDRESS, createValidTypedData(), {
              version: 'V4',
            })
          : keyring.signPersonalMessage(SIGNING_ADDRESS, '0x01');
      await expect(failure).rejects.toBe(error);
    },
  );
});

describe('OneKeyKeyring signTypedData', () => {
  it('preserves ordinary SDK failures without EIP712 JSON wrapping', async () => {
    const bridge = createBridge();
    bridge.evmSignTypedData.mockResolvedValue({
      success: false,
      payload: { code: 803, error: 'Action cancelled by user' },
    });
    const keyring = prepareUnlockedKeyring({ bridge });

    await expect(
      keyring.signTypedData(SIGNING_ADDRESS, createValidTypedData(), {
        version: 'V4',
      }),
    ).rejects.toMatchObject({ message: 'Action cancelled by user', code: 803 });
  });

  it.each([
    {
      code: 1,
      error: 'EIP712Domain unsupported',
      expectedCode: 'EIP712_DOMAIN_NOT_SUPPORT',
      errorMsg: 'EIP712Domain unsupported',
    },
    {
      code: 1,
      error: 'EIP712 disabled',
      expectedCode: 'EIP712_BLIND_SIGN_DISABLED',
      errorMsg: 'EIP712 disabled',
    },
    {
      code: 'Failure_UnexpectedMessage',
      error: 'Unexpected message',
      expectedCode: 'EIP712_FIRMWARE_NOT_SUPPORT',
      errorMsg: 'Not supported on this device',
    },
  ])(
    'keeps the existing $expectedCode JSON message',
    async ({ code, error, expectedCode, errorMsg }) => {
      const bridge = createBridge();
      bridge.evmSignTypedData.mockResolvedValue({
        success: false,
        payload: { code, error },
      });
      const keyring = prepareUnlockedKeyring({ bridge });

      await expect(
        keyring.signTypedData(SIGNING_ADDRESS, createValidTypedData(), {
          version: 'V4',
        }),
      ).rejects.toMatchObject({
        message: JSON.stringify({ code: expectedCode, errorMsg }),
        code,
      });
    },
  );

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

    expect(await devicePromise).toStrictEqual({
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

      expect(await keyring.trySearchDevice()).toStrictEqual({
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

    expect(
      await keyring.signTypedData(SIGNING_ADDRESS, typedData, {
        version: 'V4',
      }),
    ).toBe(signature);
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
   * @param status.unlocked - Whether the device is unlocked.
   * @param status.unlockedAttachPin - Whether an attach PIN unlocked it.
   * @param options - Protocol and discovery identity overrides.
   * @param options.protocol - The protocol reported by getDeviceState.
   * @param options.deviceId - The identity returned by searchDevices.
   * @param options.deviceType - The model reported by getDeviceState.
   * @returns The mocked bridge and keyring.
   */
  function setup(
    passphraseState?: string,
    status?: {
      passphraseProtection?: boolean;
      unlocked?: boolean;
      unlockedAttachPin?: boolean;
    },
    options: {
      protocol?: 'V1' | 'V2';
      deviceId?: string | null;
      deviceType?: string;
    } = {},
  ) {
    const { protocol = 'V2', deviceId = null, deviceType } = options;
    const bridge = createBridge();
    bridge.init.mockResolvedValue(undefined);
    bridge.searchDevices.mockResolvedValue({
      success: true,
      payload: [{ connectId: 'connect-id', deviceId }],
    });
    bridge.getDeviceState.mockResolvedValue({
      success: true,
      payload: {
        protocol,
        identity: { deviceId: 'device-id', deviceType },
        features: { onekey_device_type: deviceType?.toUpperCase() },
        ...(status ? { status } : {}),
      },
    });
    bridge.getPassphraseState.mockImplementation(
      async (
        _connectId: string,
        params?: { useEmptyPassphrase?: boolean },
      ) => ({
        success: true,
        payload: params?.useEmptyPassphrase
          ? 'standard-wallet-id'
          : passphraseState,
      }),
    );
    bridge.evmGetPublicKey.mockResolvedValue({
      success: true,
      payload: { pub: publicKey, node: { chain_code: '11'.repeat(32) } },
    });
    const keyring = new OneKeyKeyring({ bridge });
    return { bridge, keyring };
  }

  /**
   * Build a successful openWalletSession response.
   *
   * @param walletType - The wallet selected by the user.
   * @param walletPassphraseState - The hidden wallet id.
   * @returns The mocked SDK response.
   */
  function createSession(
    walletType: 'standard' | 'hidden',
    walletPassphraseState: string | null,
  ) {
    return {
      success: true,
      payload: {
        protocol: 'V2',
        deviceId: 'device-id',
        resumed: false,
        walletType,
        passphraseState: walletPassphraseState,
      },
    };
  }

  it.each(['pro2', 'neo'])(
    'follows the original getPassphraseState flow on an unlocked V2 %s main wallet',
    async deviceType => {
      const { bridge, keyring } = setup(
        'hidden-wallet-token',
        {
          passphraseProtection: true,
          unlocked: true,
          unlockedAttachPin: false,
        },
        { deviceType },
      );
      mockOpenWalletSession(bridge).mockResolvedValue(
        createSession('hidden', 'hidden-wallet-token'),
      );

      expect(await keyring.unlock()).toBe('just unlocked');
      expect(bridge.openWalletSession).not.toHaveBeenCalled();
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
      expect(bridge.getPassphraseState).toHaveBeenCalledTimes(2);
      expect(keyring.passphraseState).toBe('hidden-wallet-token');
    },
  );

  it('treats an empty passphrase from the original flow as the standard wallet on V2', async () => {
    const { bridge, keyring } = setup('standard-wallet-id', {
      passphraseProtection: true,
      unlocked: true,
      unlockedAttachPin: false,
    });
    mockOpenWalletSession(bridge).mockResolvedValue(
      createSession('hidden', 'hidden-wallet-token'),
    );

    expect(await keyring.unlock()).toBe('just unlocked');
    expect(bridge.openWalletSession).not.toHaveBeenCalled();
    expect(keyring.passphraseState).toBeUndefined();
  });

  it.each(
    ['pro2', 'neo'].flatMap(deviceType => [
      { deviceType, label: 'locked', lockStatus: { unlocked: false } },
      {
        deviceType,
        label: 'unlocked with an attach PIN',
        lockStatus: { unlocked: true, unlockedAttachPin: true },
      },
      { deviceType, label: 'of unknown lock state', lockStatus: {} },
    ]),
  )(
    'opens the V2 $deviceType wallet with select-hidden when the device is $label',
    async ({ deviceType, lockStatus }) => {
      const { bridge, keyring } = setup(
        'hidden-wallet-token',
        {
          passphraseProtection: true,
          ...lockStatus,
        },
        { deviceType },
      );
      mockOpenWalletSession(bridge).mockResolvedValue(
        createSession('hidden', 'hidden-wallet-token'),
      );

      expect(await keyring.unlock()).toBe('just unlocked');
      expect(bridge.openWalletSession).toHaveBeenCalledTimes(1);
      expect(bridge.openWalletSession).toHaveBeenCalledWith('connect-id', {
        mode: 'select-hidden',
      });
      expect(bridge.getPassphraseState).not.toHaveBeenCalledWith(
        'connect-id',
        undefined,
      );
    },
  );

  it.each(
    ['pro2', 'neo'].flatMap(deviceType =>
      [true, false].map(unlockedAttachPin => ({
        deviceType,
        unlockedAttachPin,
      })),
    ),
  )(
    'refreshes the V2 $deviceType status after select-hidden with unlockedAttachPin=$unlockedAttachPin',
    async ({ deviceType, unlockedAttachPin }) => {
      const { bridge, keyring } = setup(
        undefined,
        { passphraseProtection: true, unlocked: false },
        { deviceType },
      );
      mockOpenWalletSession(bridge).mockImplementation(async () => {
        bridge.getDeviceState.mockResolvedValue({
          success: true,
          payload: { status: { unlocked: true, unlockedAttachPin } },
        });
        return createSession('hidden', 'hidden-wallet-token');
      });

      expect(await keyring.unlock()).toBe('just unlocked');
      expect(bridge.openWalletSession).toHaveBeenCalledTimes(1);
      expect(bridge.openWalletSession).toHaveBeenCalledWith('connect-id', {
        mode: 'select-hidden',
      });
      expect(bridge.getDeviceState).toHaveBeenCalledTimes(2);
      expect(bridge.getDeviceState).toHaveBeenNthCalledWith(2, 'connect-id');
      expect(bridge.getPassphraseState.mock.calls).toMatchObject(
        unlockedAttachPin ? [] : [['connect-id', { useEmptyPassphrase: true }]],
      );
      expect(keyring.passphraseState).toBe('hidden-wallet-token');
    },
  );

  it.each(
    ['pro2', 'neo'].flatMap(deviceType =>
      [false, true].flatMap(throws =>
        [822, 802, 803, undefined].map(code => ({ deviceType, throws, code })),
      ),
    ),
  )(
    'rejects a cancelled V2 $deviceType status refresh (throws=$throws, code=$code) without probing the standard wallet',
    async ({ deviceType, throws, code }) => {
      const message =
        code === undefined ? 'Action cancelled' : 'Refresh interrupted';
      const { bridge, keyring } = setup(
        undefined,
        { passphraseProtection: true, unlocked: false },
        { deviceType },
      );
      mockOpenWalletSession(bridge).mockImplementation(async () => {
        if (throws) {
          bridge.getDeviceState.mockRejectedValue(
            Object.assign(new Error(message), { code }),
          );
        } else {
          bridge.getDeviceState.mockResolvedValue({
            success: false,
            payload: { code, error: message },
          });
        }
        return createSession('hidden', 'hidden-wallet-token');
      });

      await expect(keyring.unlock()).rejects.toMatchObject({
        message,
        ...(code === undefined ? {} : { code }),
      });
      expect(bridge.getDeviceState).toHaveBeenCalledTimes(2);
      expect(bridge.getPassphraseState).not.toHaveBeenCalledWith('connect-id', {
        useEmptyPassphrase: true,
      });
      expect(bridge.evmGetPublicKey).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    'keeps the hidden wallet after a failed status refresh (throws=%p) and failed probe',
    async throws => {
      const { bridge, keyring } = setup(undefined, {
        passphraseProtection: true,
        unlocked: false,
      });
      mockOpenWalletSession(bridge).mockImplementation(async () => {
        if (throws) {
          bridge.getDeviceState.mockRejectedValue(new Error('refresh failed'));
        } else {
          bridge.getDeviceState.mockResolvedValue({
            success: false,
            payload: { code: 800, error: 'refresh failed' },
          });
        }
        return createSession('hidden', 'hidden-wallet-token');
      });
      bridge.getPassphraseState.mockRejectedValueOnce(
        new Error('probe failed'),
      );

      expect(await keyring.unlock()).toBe('just unlocked');
      expect(bridge.getDeviceState).toHaveBeenCalledTimes(2);
      expect(bridge.getPassphraseState).toHaveBeenCalledTimes(1);
      expect(bridge.getPassphraseState).toHaveBeenCalledWith('connect-id', {
        useEmptyPassphrase: true,
      });
      expect(keyring.passphraseState).toBe('hidden-wallet-token');
    },
  );

  it('does not store a passphrase state when openWalletSession opens the standard wallet', async () => {
    const { bridge, keyring } = setup(undefined, {
      passphraseProtection: true,
    });
    mockOpenWalletSession(bridge).mockResolvedValue(
      createSession('standard', null),
    );

    expect(await keyring.unlock()).toBe('just unlocked');
    expect(bridge.openWalletSession).toHaveBeenCalledWith('connect-id', {
      mode: 'select-hidden',
    });
    expect(bridge.getPassphraseState).not.toHaveBeenCalled();
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

  it('stores the hidden wallet passphrase state from openWalletSession', async () => {
    const { bridge, keyring } = setup(undefined, {
      passphraseProtection: true,
    });
    mockOpenWalletSession(bridge).mockResolvedValue(
      createSession('hidden', 'hidden-wallet-token'),
    );

    expect(await keyring.unlock()).toBe('just unlocked');
    expect(bridge.openWalletSession).toHaveBeenCalledWith('connect-id', {
      mode: 'select-hidden',
    });
    expect(bridge.getPassphraseState).toHaveBeenCalledWith('connect-id', {
      useEmptyPassphrase: true,
    });
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

  it('treats an empty passphrase in select-hidden as the standard wallet', async () => {
    const { bridge, keyring } = setup('standard-wallet-id', {
      passphraseProtection: true,
    });
    mockOpenWalletSession(bridge).mockResolvedValue(
      createSession('hidden', 'standard-wallet-id'),
    );

    expect(await keyring.unlock()).toBe('just unlocked');
    expect(bridge.openWalletSession).toHaveBeenCalledWith('connect-id', {
      mode: 'select-hidden',
    });
    expect(bridge.getPassphraseState).toHaveBeenCalledWith('connect-id', {
      useEmptyPassphrase: true,
    });
    expect(keyring.passphraseState).toBeUndefined();
    expect(bridge.evmGetPublicKey).toHaveBeenCalledWith(
      'connect-id',
      'device-id',
      expect.objectContaining({
        passphraseState: undefined,
        useEmptyPassphrase: true,
      }),
    );
  });

  it('keeps a real hidden wallet whose passphraseState differs from the standard identity', async () => {
    const { bridge, keyring } = setup('hidden-wallet-token', {
      passphraseProtection: true,
    });
    mockOpenWalletSession(bridge).mockResolvedValue(
      createSession('hidden', 'hidden-wallet-token'),
    );

    expect(await keyring.unlock()).toBe('just unlocked');
    expect(bridge.getPassphraseState).toHaveBeenCalledWith('connect-id', {
      useEmptyPassphrase: true,
    });
    expect(keyring.passphraseState).toBe('hidden-wallet-token');
  });

  it('keeps the hidden wallet when the standard-identity probe fails', async () => {
    const { bridge, keyring } = setup('hidden-wallet-token', {
      passphraseProtection: true,
    });
    mockOpenWalletSession(bridge).mockResolvedValue(
      createSession('hidden', 'hidden-wallet-token'),
    );
    bridge.getPassphraseState.mockRejectedValueOnce(new Error('probe failed'));

    expect(await keyring.unlock()).toBe('just unlocked');
    expect(keyring.passphraseState).toBe('hidden-wallet-token');
  });

  it.each([822, 802, 803, undefined])(
    'rejects a cancelled standard-identity probe (code %p)',
    async code => {
      const message =
        code === undefined ? 'Action cancelled' : 'Probe interrupted';
      for (const throws of [false, true]) {
        const { bridge, keyring } = setup('hidden-wallet-token', {
          passphraseProtection: true,
        });
        mockOpenWalletSession(bridge).mockResolvedValue(
          createSession('hidden', 'hidden-wallet-token'),
        );
        if (throws) {
          bridge.getPassphraseState.mockRejectedValueOnce(
            Object.assign(new Error(message), { code }),
          );
        } else {
          bridge.getPassphraseState.mockResolvedValueOnce({
            success: false,
            payload: { code, error: message },
          });
        }

        await expect(keyring.unlock()).rejects.toMatchObject({
          message,
          ...(code === undefined ? {} : { code }),
        });
        expect(bridge.evmGetPublicKey).not.toHaveBeenCalled();
      }
    },
  );

  it('keeps the hidden wallet when the standard-identity probe returns another failure', async () => {
    const { bridge, keyring } = setup('hidden-wallet-token', {
      passphraseProtection: true,
    });
    mockOpenWalletSession(bridge).mockResolvedValue(
      createSession('hidden', 'hidden-wallet-token'),
    );
    bridge.getPassphraseState.mockResolvedValueOnce({
      success: false,
      payload: { code: 800, error: 'probe failed' },
    });

    expect(await keyring.unlock()).toBe('just unlocked');
    expect(keyring.passphraseState).toBe('hidden-wallet-token');
  });

  it.each(['pro2', 'neo'])(
    'opens the %s standard wallet directly when passphrase protection is off',
    async deviceType => {
      const { bridge, keyring } = setup(
        undefined,
        {
          passphraseProtection: false,
        },
        { deviceType },
      );
      mockOpenWalletSession(bridge).mockResolvedValue(
        createSession('standard', null),
      );

      expect(await keyring.unlock()).toBe('just unlocked');
      expect(bridge.openWalletSession).toHaveBeenCalledTimes(1);
      expect(bridge.openWalletSession).toHaveBeenCalledWith('connect-id', {
        mode: 'standard',
      });
      expect(keyring.passphraseState).toBeUndefined();
    },
  );

  it.each(['pro2', 'neo'])(
    'imports BIP44 accounts from an attach-PIN-unlocked V2 %s and signs without reopening the session',
    async deviceType => {
      const { bridge, keyring } = setup(
        undefined,
        {
          passphraseProtection: true,
          unlocked: true,
          unlockedAttachPin: true,
        },
        { deviceType },
      );
      mockOpenWalletSession(bridge).mockResolvedValue(
        createSession('hidden', 'attach-pin-wallet-token'),
      );
      const wallet = HDKey.fromMasterSeed(
        Buffer.from('11'.repeat(32), 'hex'),
      ).derive("m/44'/60'/0'/0");
      bridge.evmGetPublicKey.mockResolvedValue({
        success: true,
        payload: {
          pub: wallet.publicKey.toString('hex'),
          node: { chain_code: wallet.chainCode.toString('hex') },
        },
      });

      const accounts: string[] = await keyring.addAccounts(2);
      expect(accounts).toStrictEqual(
        [0, 1].map(index =>
          ethUtil.toChecksumAddress(
            ethUtil.bufferToHex(
              ethUtil.publicToAddress(
                wallet.derive(`m/${index}`).publicKey,
                true,
              ),
            ),
          ),
        ),
      );
      for (const [index, address] of accounts.entries()) {
        expect(keyring.accountDetails[address]).toStrictEqual(
          expect.objectContaining({
            hdPath: `m/44'/60'/0'/0/${index}`,
            hdPathType: 'BIP44',
            index,
          }),
        );
      }
      expect(keyring.passphraseState).toBe('attach-pin-wallet-token');

      const signature = sigUtil.personalSign(wallet.derive('m/1').privateKey, {
        data: '0x01',
      });
      bridge.evmSignMessage.mockResolvedValue({
        success: true,
        payload: { address: accounts[1], signature: stripHexPrefix(signature) },
      });

      expect(await keyring.signPersonalMessage(accounts[1], '0x01')).toBe(
        signature,
      );
      expect(bridge.evmSignMessage).toHaveBeenCalledTimes(1);
      expect(bridge.evmSignMessage).toHaveBeenCalledWith(
        'connect-id',
        'device-id',
        {
          path: "m/44'/60'/0'/0/1",
          messageHex: '01',
          passphraseState: 'attach-pin-wallet-token',
          useEmptyPassphrase: false,
        },
      );
      expect(bridge.openWalletSession).toHaveBeenCalledTimes(1);
      expect(bridge.openWalletSession).toHaveBeenCalledWith('connect-id', {
        mode: 'select-hidden',
      });
      expect(bridge.initSession).not.toHaveBeenCalled();
      expect(bridge.getDeviceState).toHaveBeenCalledTimes(1);
      expect(bridge.getPassphraseState).not.toHaveBeenCalled();
      expect(bridge.evmGetPublicKey).toHaveBeenCalledTimes(1);
      expect(bridge.evmGetPublicKey).toHaveBeenCalledWith(
        'connect-id',
        'device-id',
        {
          path: "m/44'/60'/0'/0",
          showOnOneKey: false,
          chainId: 1,
          passphraseState: 'attach-pin-wallet-token',
          useEmptyPassphrase: false,
        },
      );
      expect(bridge.receivePin).not.toHaveBeenCalled();
      expect(bridge.receivePassphrase).not.toHaveBeenCalled();
      expect(keyring.passphraseState).toBe('attach-pin-wallet-token');
    },
  );

  it.each(['pro2', 'neo'])(
    'keeps the attach-PIN session on V2 %s without a standard-wallet probe when openWalletSession is unavailable',
    async deviceType => {
      const { bridge, keyring } = setup(
        'attach-pin-wallet-token',
        {
          passphraseProtection: true,
          unlocked: true,
          unlockedAttachPin: true,
        },
        { deviceType },
      );
      keyring.setDeviceConnectId('connect-id');

      expect(await keyring.unlock()).toBe('just unlocked');
      expect(bridge.getPassphraseState).toHaveBeenCalledTimes(1);
      expect(bridge.getPassphraseState).toHaveBeenCalledWith(
        'connect-id',
        undefined,
      );
      expect(keyring.passphraseState).toBe('attach-pin-wallet-token');
    },
  );

  it('retries openWalletSession with the standard wallet after a passphrase-disabled error', async () => {
    const { bridge, keyring } = setup(undefined, {
      passphraseProtection: true,
    });
    mockOpenWalletSession(bridge)
      .mockResolvedValueOnce({
        success: false,
        payload: { code: 113, error: 'Passphrase disabled' },
      })
      .mockResolvedValueOnce(createSession('standard', null));

    expect(await keyring.unlock()).toBe('just unlocked');
    expect(bridge.openWalletSession).toHaveBeenNthCalledWith(1, 'connect-id', {
      mode: 'select-hidden',
    });
    expect(bridge.openWalletSession).toHaveBeenNthCalledWith(2, 'connect-id', {
      mode: 'standard',
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

  it('rejects openWalletSession failures with the device error', async () => {
    const { bridge, keyring } = setup(undefined, {
      passphraseProtection: true,
    });
    mockOpenWalletSession(bridge).mockResolvedValue({
      success: false,
      payload: { code: 800, error: 'Device disconnected' },
    });

    await expect(keyring.unlock()).rejects.toMatchObject({
      message: 'Device disconnected',
      code: 800,
    });
    expect(bridge.evmGetPublicKey).not.toHaveBeenCalled();
  });

  it('preserves evmGetPublicKey failure during unlock', async () => {
    const { bridge, keyring } = setup();
    bridge.evmGetPublicKey.mockResolvedValue({
      success: false,
      payload: { code: 801, error: 'PIN invalid' },
    });

    await expect(keyring.unlock()).rejects.toMatchObject({
      message: 'PIN invalid',
      code: 801,
    });
  });

  it.each([
    [{ error: 'OneKey action not supported', code: 404 }],
    [{ error: 'Method not found', code: 'MethodNotAllowed' }],
  ])(
    'falls back to getPassphraseState when openWalletSession is unsupported (%p)',
    async failure => {
      const { bridge, keyring } = setup('hidden-wallet-token', {
        passphraseProtection: true,
      });
      mockOpenWalletSession(bridge).mockResolvedValue({
        success: false,
        payload: failure,
      });

      expect(await keyring.unlock()).toBe('just unlocked');
      expect(bridge.getPassphraseState).toHaveBeenCalledWith(
        'connect-id',
        undefined,
      );
      expect(keyring.passphraseState).toBe('hidden-wallet-token');
    },
  );

  it('falls back to getPassphraseState when openWalletSession throws unsupported', async () => {
    const { bridge, keyring } = setup('hidden-wallet-token', {
      passphraseProtection: true,
    });
    const unsupported = new Error('OneKey action not supported');
    (unsupported as { code?: string }).code = 'MethodNotAllowed';
    mockOpenWalletSession(bridge).mockRejectedValue(unsupported);

    expect(await keyring.unlock()).toBe('just unlocked');
    expect(bridge.getPassphraseState).toHaveBeenCalledWith(
      'connect-id',
      undefined,
    );
    expect(keyring.passphraseState).toBe('hidden-wallet-token');
  });

  it('keeps using getPassphraseState on Protocol V1 even when openWalletSession exists', async () => {
    const { bridge, keyring } = setup(
      'hidden-wallet-token',
      { passphraseProtection: true },
      { protocol: 'V1' },
    );
    mockOpenWalletSession(bridge);

    expect(await keyring.unlock()).toBe('just unlocked');
    expect(bridge.openWalletSession).not.toHaveBeenCalled();
    expect(bridge.getPassphraseState).toHaveBeenCalledWith(
      'connect-id',
      undefined,
    );
    expect(keyring.passphraseState).toBe('hidden-wallet-token');
  });

  it('reads passphrase protection when discovery already returned a deviceId', async () => {
    const { bridge, keyring } = setup(
      undefined,
      { passphraseProtection: false },
      { deviceId: 'device-id' },
    );
    mockOpenWalletSession(bridge).mockResolvedValue(
      createSession('standard', null),
    );

    expect(await keyring.unlock()).toBe('just unlocked');
    expect(bridge.getDeviceState).toHaveBeenCalledTimes(1);
    expect(bridge.openWalletSession).toHaveBeenCalledWith('connect-id', {
      mode: 'standard',
    });
    expect(keyring.passphraseState).toBeUndefined();
  });

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
    expect(error).toHaveProperty('code', 800);
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

describe('OneKeyKeyring signPersonalMessage', () => {
  it.each(['0x01', '00ff', '0xe4bda0e5a5bd'])(
    'accepts a lowercase SDK address and a signature over the exact bytes of %s',
    async message => {
      const bridge = createBridge();
      const signature = sigUtil.personalSign(SIGNING_PRIVATE_KEY, {
        data: ethUtil.addHexPrefix(message),
      });
      bridge.evmSignMessage.mockResolvedValue({
        success: true,
        payload: {
          address: SIGNING_ADDRESS.toLowerCase(),
          signature: stripHexPrefix(signature),
        },
      });
      const keyring = prepareUnlockedKeyring({ bridge });

      expect(await keyring.signPersonalMessage(SIGNING_ADDRESS, message)).toBe(
        signature,
      );
      expect(bridge.evmSignMessage.mock.calls[0][2].messageHex).toBe(
        stripHexPrefix(message),
      );
    },
  );

  it('rejects a different signer even when the SDK reports the expected address', async () => {
    const bridge = createBridge();
    const signature = sigUtil.personalSign(Buffer.from('2'.repeat(64), 'hex'), {
      data: '0x01',
    });
    bridge.evmSignMessage.mockResolvedValue({
      success: true,
      payload: {
        address: SIGNING_ADDRESS,
        signature: stripHexPrefix(signature),
      },
    });
    const keyring = prepareUnlockedKeyring({ bridge });

    await expect(
      keyring.signPersonalMessage(SIGNING_ADDRESS, '0x01'),
    ).rejects.toThrow('signature doesnt match the right address');
  });

  it('rejects a signature over different message bytes', async () => {
    const bridge = createBridge();
    const signature = sigUtil.personalSign(SIGNING_PRIVATE_KEY, {
      data: '0x02',
    });
    bridge.evmSignMessage.mockResolvedValue({
      success: true,
      payload: {
        address: SIGNING_ADDRESS,
        signature: stripHexPrefix(signature),
      },
    });
    const keyring = prepareUnlockedKeyring({ bridge });

    await expect(
      keyring.signPersonalMessage(SIGNING_ADDRESS, '0x01'),
    ).rejects.toThrow('signature doesnt match the right address');
  });

  it('rejects a signature from a different account', async () => {
    const bridge = createBridge();
    bridge.evmSignMessage.mockResolvedValue({
      success: true,
      payload: {
        address: OTHER_ADDRESS,
        signature: 'beef',
      },
    });
    const keyring = prepareUnlockedKeyring({ bridge });

    await expect(
      keyring.signPersonalMessage(SIGNING_ADDRESS, '0x01'),
    ).rejects.toThrow('signature doesnt match the right address');
  });
});

describe('OneKeyKeyring forgetDevice', () => {
  it('clears accounts and the stored device and wallet session', async () => {
    const keyring = prepareUnlockedKeyring({ bridge: createBridge() });
    keyring.connectId = 'connect-id';
    keyring._deviceConnectId = 'connect-id';
    keyring.deviceId = 'device-id';
    keyring.passphraseState = 'hidden-wallet-token';
    keyring.page = 2;
    keyring.unlockedAccount = 3;
    keyring.paths = { [SIGNING_ADDRESS]: 0 };
    keyring.hdk.publicKey = Buffer.from(`04${SIGNING_PUBLIC_KEY}`, 'hex');

    keyring.forgetDevice();

    expect(await keyring.getAccounts()).toStrictEqual([]);
    expect(keyring.accountDetails).toStrictEqual({});
    expect(keyring.paths).toStrictEqual({});
    expect(keyring.hdk.publicKey).toBeNull();
    expect(keyring.page).toBe(0);
    expect(keyring.unlockedAccount).toBe(0);
    expect(keyring.passphraseState).toBeUndefined();
    expect(keyring.deviceId).toBeNull();
    expect(keyring.connectId).toBeNull();
    expect(keyring._deviceConnectId).toBeUndefined();
  });
});

describe('OneKeyKeyring passphrase recovery on signing', () => {
  const disabled = {
    success: false,
    payload: { code: 113, error: 'Device not opened passphrase' },
  };

  /**
   * Prepare an unlocked keyring bound to a stale hidden-wallet session.
   *
   * @returns The mocked bridge and keyring.
   */
  function prepareStaleHiddenSession() {
    const bridge = createBridge();
    const keyring = prepareUnlockedKeyring({ bridge });
    keyring.connectId = 'connect-id';
    keyring.deviceId = 'device-id';
    keyring.passphraseState = 'stale-wallet-state';
    bridge.evmGetPublicKey.mockResolvedValue({
      success: true,
      payload: {
        pub: SIGNING_PUBLIC_KEY,
        node: { chain_code: '11'.repeat(32) },
      },
    });
    return { bridge, keyring };
  }

  it('retries personal-sign once with the standard wallet when it owns the account', async () => {
    const { bridge, keyring } = prepareStaleHiddenSession();
    const signature = sigUtil.personalSign(SIGNING_PRIVATE_KEY, {
      data: '0x01',
    });
    bridge.evmSignMessage
      .mockResolvedValueOnce(disabled)
      .mockResolvedValueOnce({
        success: true,
        payload: {
          address: SIGNING_ADDRESS,
          signature: stripHexPrefix(signature),
        },
      });

    expect(await keyring.signPersonalMessage(SIGNING_ADDRESS, '0x01')).toBe(
      signature,
    );

    expect(bridge.evmGetPublicKey).toHaveBeenCalledWith(
      'connect-id',
      'device-id',
      expect.objectContaining({
        path: "m/44'/60'/0'/0/0",
        showOnOneKey: false,
        chainId: 1,
        useEmptyPassphrase: true,
      }),
    );
    expect(bridge.evmSignMessage).toHaveBeenCalledTimes(2);
    expect(bridge.evmSignMessage.mock.calls[0][2]).toStrictEqual(
      expect.objectContaining({
        path: "m/44'/60'/0'/0/0",
        passphraseState: 'stale-wallet-state',
        useEmptyPassphrase: false,
      }),
    );
    expect(bridge.evmSignMessage.mock.calls[1][2]).toStrictEqual(
      expect.objectContaining({
        path: "m/44'/60'/0'/0/0",
        passphraseState: undefined,
        useEmptyPassphrase: true,
      }),
    );
    expect(keyring.passphraseState).toBeUndefined();
  });

  it('does not recover after the user cancels the signing request', async () => {
    const { bridge, keyring } = prepareStaleHiddenSession();
    bridge.evmSignMessage.mockResolvedValue({
      success: false,
      payload: { code: 803, error: 'Action cancelled by user' },
    });

    await expect(
      keyring.signPersonalMessage(SIGNING_ADDRESS, '0x01'),
    ).rejects.toThrow('Action cancelled by user');

    expect(bridge.evmGetPublicKey).not.toHaveBeenCalled();
    expect(bridge.evmSignMessage).toHaveBeenCalledTimes(1);
    expect(keyring.passphraseState).toBe('stale-wallet-state');
  });

  it('surfaces the original 113 error when a hidden wallet owns the account', async () => {
    const { bridge, keyring } = prepareStaleHiddenSession();
    bridge.evmGetPublicKey.mockResolvedValue({
      success: true,
      payload: {
        pub: OTHER_PUBLIC_KEY,
        node: { chain_code: '11'.repeat(32) },
      },
    });
    bridge.evmSignMessage.mockResolvedValue(disabled);

    await expect(
      keyring.signPersonalMessage(SIGNING_ADDRESS, '0x01'),
    ).rejects.toThrow('Device not opened passphrase');

    expect(bridge.evmSignMessage).toHaveBeenCalledTimes(1);
    expect(keyring.passphraseState).toBe('stale-wallet-state');
  });

  it('retries typed-data signing once with the standard wallet', async () => {
    const { bridge, keyring } = prepareStaleHiddenSession();
    const typedData = createValidTypedData();
    const signature = sigUtil.signTypedData_v4(SIGNING_PRIVATE_KEY, {
      data: typedData as any,
    });
    bridge.evmSignTypedData
      .mockResolvedValueOnce(disabled)
      .mockResolvedValueOnce({
        success: true,
        payload: { signature: stripHexPrefix(signature) },
      });

    expect(
      await keyring.signTypedData(SIGNING_ADDRESS, typedData, {
        version: 'V4',
      }),
    ).toBe(signature);

    expect(bridge.evmSignTypedData).toHaveBeenCalledTimes(2);
    expect(bridge.evmSignTypedData.mock.calls[1][2]).toStrictEqual(
      expect.objectContaining({
        passphraseState: undefined,
        useEmptyPassphrase: true,
      }),
    );
    expect(keyring.passphraseState).toBeUndefined();
  });

  it('retries transaction signing once with the standard wallet', async () => {
    const { bridge, keyring } = prepareStaleHiddenSession();
    const transaction = {
      getChainId: () => 1,
      to: Buffer.from('11'.repeat(20), 'hex'),
      value: Buffer.alloc(0),
      data: Buffer.alloc(0),
      nonce: Buffer.alloc(0),
      gasLimit: Buffer.from('5208', 'hex'),
      gasPrice: Buffer.from('01', 'hex'),
    };
    const signedTransaction = {
      getSenderAddress: () => Buffer.from(SIGNING_ADDRESS.slice(2), 'hex'),
    };
    const handleSigning = jest.fn().mockReturnValue(signedTransaction);
    bridge.evmSignTransaction
      .mockResolvedValueOnce(disabled)
      .mockResolvedValueOnce({
        success: true,
        payload: { v: '1b', r: '11', s: '22' },
      });

    expect(
      await keyring._signTransaction(
        SIGNING_ADDRESS,
        1,
        transaction,
        handleSigning,
      ),
    ).toBe(signedTransaction);

    expect(bridge.evmSignTransaction).toHaveBeenCalledTimes(2);
    expect(bridge.evmSignTransaction.mock.calls[1][2]).toStrictEqual(
      expect.objectContaining({
        passphraseState: undefined,
        useEmptyPassphrase: true,
      }),
    );
  });
});
