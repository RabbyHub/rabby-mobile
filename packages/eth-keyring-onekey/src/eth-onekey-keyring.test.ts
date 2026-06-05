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
    getFeatures: jest.fn(),
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
