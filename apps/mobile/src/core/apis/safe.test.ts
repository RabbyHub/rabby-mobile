const mockGetKeyring = jest.fn();
const mockTranslate = jest.fn((key: string) => `translated:${key}`);

jest.mock('../services/shared', () => ({
  keyringService: {
    getKeyringClassForType: jest.fn(),
    addNewAccount: jest.fn(),
    addKeyring: jest.fn(),
    persistKeyringsForKeyring: jest.fn(),
  },
  preferenceService: {
    getFallbackAccount: jest.fn(),
    initCurrentAccount: jest.fn(),
  },
}));

jest.mock('ethers', () => ({
  ethers: {
    providers: {
      Web3Provider: jest.fn().mockImplementation(provider => ({ provider })),
    },
  },
}));

jest.mock('@rabby-wallet/gnosis-sdk', () => {
  class MockSafe {
    static getSafeVersion = jest.fn();
    static getMessage = jest.fn();
  }

  return {
    __esModule: true,
    default: MockSafe,
  };
});

jest.mock('@/utils/chain', () => ({
  findChain: jest.fn(),
}));

jest.mock('i18next', () => ({
  t: (...args: unknown[]) => mockTranslate(...args),
}));

jest.mock('web3-utils', () => ({
  isAddress: jest.fn(() => true),
}));

jest.mock('./ethereumProvider', () => ({
  EthereumProvider: jest.fn().mockImplementation(() => ({})),
  builtinEthereumProvider: {},
}));

jest.mock('@rabby-wallet/keyring-utils', () => ({
  KEYRING_CLASS: {
    GNOSIS: 'GnosisKeyring',
  },
  KEYRING_TYPE: {
    GnosisKeyring: 'GnosisKeyring',
  },
}));

jest.mock('./keyring', () => ({
  getKeyring: (...args: unknown[]) => mockGetKeyring(...args),
}));

jest.mock('@rabby-wallet/eth-keyring-gnosis', () => ({
  GnosisKeyring: jest.fn(),
  TransactionBuiltEvent: 'TransactionBuilt',
  TransactionConfirmedEvent: 'TransactionConfirmed',
}));

jest.mock('@/utils/events', () => ({
  EVENTS: {
    broadcastToUI: 'broadcastToUI',
  },
  eventBus: {
    emit: jest.fn(),
  },
}));

jest.mock('@ethereumjs/util', () => ({
  toChecksumAddress: (address: string) => `checksum:${address}`,
}));

jest.mock(
  '@safe-global/protocol-kit/dist/src/utils/eip-712',
  () => ({
    hashSafeMessage: (message: unknown) => `hash:${JSON.stringify(message)}`,
  }),
  { virtual: true },
);

jest.mock('p-queue', () =>
  jest.fn().mockImplementation(() => ({
    add: (fn: () => unknown) => fn(),
  })),
);

jest.mock('@rabby-wallet/gnosis-sdk/dist/api', () => ({
  GNOSIS_SUPPORT_CHAINS: ['eth', 'bsc'],
}));

import { apisSafe } from './safe';

const createKeyring = () => ({
  networkIdsMap: {
    '0xabc': ['1', '56'],
  },
  currentTransaction: null as any,
  currentTransactionHash: '',
  currentSafeMessage: null as any,
  safeInstance: null as any,
  accounts: ['0xabc'],
  getTransactionHash: jest.fn(() => '0xhash'),
  postTransaction: jest.fn(() => '0xposted'),
  generateTypedData: jest.fn(() => ({ typed: true })),
  addConfirmation: jest.fn(),
  addPureSignature: jest.fn(),
  addSignature: jest.fn(),
  addMessage: jest.fn(),
  addMessageSignature: jest.fn(),
  addPureMessageSignature: jest.fn(),
});

describe('core/apis/safe state wrappers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetKeyring.mockResolvedValue(createKeyring());
  });

  it('reads gnosis network ids by lowercased address and throws when absent', async () => {
    const keyring = createKeyring();
    mockGetKeyring.mockResolvedValue(keyring);

    await expect(apisSafe.getGnosisNetworkIds('0xABC')).resolves.toEqual([
      '1',
      '56',
    ]);

    await expect(apisSafe.getGnosisNetworkIds('0xdef')).rejects.toThrow(
      'Address 0xdef is not in keyring"',
    );
  });

  it('reads and mutates the current gnosis transaction hash and signatures', async () => {
    const keyring = createKeyring();
    keyring.currentTransaction = {
      signatures: new Map([
        [
          '0xowner',
          {
            data: '0xsig',
            signer: '0xowner',
          },
        ],
      ]),
    };
    mockGetKeyring.mockResolvedValue(keyring);

    await expect(apisSafe.getGnosisTransactionHash()).resolves.toBe('0xhash');
    await expect(apisSafe.getGnosisTransactionSignatures()).resolves.toEqual([
      {
        data: '0xsig',
        signer: '0xowner',
      },
    ]);
    await apisSafe.setGnosisTransactionHash('0xnext');
    expect(keyring.currentTransactionHash).toBe('0xnext');
  });

  it('returns empty transaction state when no current transaction exists', async () => {
    const keyring = createKeyring();
    mockGetKeyring.mockResolvedValue(keyring);

    await expect(apisSafe.getGnosisTransactionHash()).resolves.toBeNull();
    await expect(apisSafe.getGnosisTransactionSignatures()).resolves.toEqual(
      [],
    );
  });

  it('requires a current transaction before posting or generating typed data', async () => {
    const keyring = createKeyring();
    mockGetKeyring.mockResolvedValue(keyring);

    await expect(apisSafe.postGnosisTransaction()).rejects.toThrow(
      'translated:background.error.notFoundTxGnosisKeyring',
    );
    await expect(apisSafe.gnosisGenerateTypedData()).rejects.toThrow(
      'translated:background.error.notFoundTxGnosisKeyring',
    );

    keyring.currentTransaction = {
      signatures: new Map(),
    };

    await expect(apisSafe.postGnosisTransaction()).resolves.toBe('0xposted');
    await expect(apisSafe.gnosisGenerateTypedData()).resolves.toEqual({
      typed: true,
    });
  });

  it('checks whether the current transaction has enough signatures to execute', async () => {
    const keyring = createKeyring();
    keyring.currentTransaction = {
      signatures: new Map([
        ['a', { data: '0xa', signer: '0xa' }],
        ['b', { data: '0xb', signer: '0xb' }],
      ]),
    };
    keyring.safeInstance = {
      getThreshold: jest.fn().mockResolvedValue(2),
    };
    mockGetKeyring.mockResolvedValue(keyring);

    await expect(apisSafe.checkGnosisTransactionCanExec()).resolves.toBe(true);

    keyring.safeInstance.getThreshold.mockResolvedValue(3);
    await expect(apisSafe.checkGnosisTransactionCanExec()).resolves.toBe(false);

    keyring.currentTransaction = null;
    await expect(apisSafe.checkGnosisTransactionCanExec()).resolves.toBe(false);
  });

  it('adds transaction confirmations and signatures only when a current transaction exists', async () => {
    const keyring = createKeyring();
    mockGetKeyring.mockResolvedValue(keyring);

    await expect(
      apisSafe.gnosisAddConfirmation('0xowner', '0xsig'),
    ).rejects.toThrow('translated:background.error.notFoundTxGnosisKeyring');

    keyring.currentTransaction = {
      signatures: new Map(),
    };
    await apisSafe.gnosisAddConfirmation('0xowner', '0xsig');
    await apisSafe.gnosisAddPureSignature('0xowner', '0xpure');
    await apisSafe.gnosisAddSignature('0xowner', '0xfull');

    expect(keyring.addConfirmation).toHaveBeenCalledWith('0xowner', '0xsig');
    expect(keyring.addPureSignature).toHaveBeenCalledWith('0xowner', '0xpure');
    expect(keyring.addSignature).toHaveBeenCalledWith('0xowner', '0xfull');
  });

  it('handles safe messages based on whether signatures already exist', async () => {
    const keyring = createKeyring();
    mockGetKeyring.mockResolvedValue(keyring);

    await expect(apisSafe.getGnosisMessageSignatures()).resolves.toEqual([]);
    await apisSafe.handleGnosisMessage({
      signerAddress: '0xowner',
      signature: '0xsig',
    });
    expect(keyring.addMessage).toHaveBeenCalledWith({
      signerAddress: '0xowner',
      signature: '0xsig',
    });
    expect(keyring.addMessageSignature).not.toHaveBeenCalled();

    keyring.currentSafeMessage = {
      signatures: new Map([
        [
          '0xowner',
          {
            data: '0xold',
            signer: '0xowner',
          },
        ],
      ]),
    };
    await expect(apisSafe.getGnosisMessageSignatures()).resolves.toEqual([
      {
        data: '0xold',
        signer: '0xowner',
      },
    ]);
    await apisSafe.handleGnosisMessage({
      signerAddress: '0xowner',
      signature: '0xnext',
    });

    expect(keyring.addMessageSignature).toHaveBeenCalledWith({
      signerAddress: '0xowner',
      signature: '0xnext',
    });
  });

  it('clears stored transaction and message state', async () => {
    const keyring = createKeyring();
    keyring.currentTransaction = {
      signatures: new Map(),
    };
    keyring.currentSafeMessage = {
      signatures: new Map(),
    };
    keyring.safeInstance = {
      safeAddress: '0xsafe',
    };
    mockGetKeyring.mockResolvedValue(keyring);

    await apisSafe.clearGnosisTransaction();
    expect(keyring.currentTransaction).toBeNull();
    expect(keyring.safeInstance).toBeNull();

    keyring.currentSafeMessage = {
      signatures: new Map(),
    };
    keyring.safeInstance = {
      safeAddress: '0xsafe',
    };
    await apisSafe.clearGnosisMessage();
    expect(keyring.currentSafeMessage).toBeNull();
    expect(keyring.safeInstance).toBeNull();
  });
});
