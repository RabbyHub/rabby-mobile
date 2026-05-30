const mockEthRpc = jest.fn();
const mockEthSendTransaction = jest.fn();
const mockPersonalSign = jest.fn();
const mockDefaultEthRPC = jest.fn();
const mockRemoveSigningTx = jest.fn();
const mockGasMarketV2 = jest.fn();
const mockFindChain = jest.fn();
const mockTranslate = jest.fn((key: string) => `translated:${key}`);
const mockEncodeFunctionCall = jest.fn();
const mockIsValidAddress = jest.fn();
const mockGetRecommendNonce = jest.fn();
const mockEncodeFunctionData = jest.fn();

const mockProviderController = {
  ethRpc: (...args: unknown[]) => mockEthRpc(...args),
  ethSendTransaction: (...args: unknown[]) => mockEthSendTransaction(...args),
  personalSign: (...args: unknown[]) => mockPersonalSign(...args),
};
const mockNotificationService = {
  currentMiniApproval: null as null | {
    signingTxId?: string;
  },
};
const mockPreferenceService = {
  getFallbackAccount: jest.fn(),
};
const mockTransactionHistoryService = {
  removeSigningTx: (...args: unknown[]) => mockRemoveSigningTx(...args),
};

const loadProviderModule = () => {
  jest.resetModules();

  jest.doMock('ethers', () => ({
    ethers: {
      utils: {
        Interface: jest.fn().mockImplementation(() => ({
          encodeFunctionData: (...args: unknown[]) =>
            mockEncodeFunctionData(...args),
        })),
      },
    },
  }));

  jest.doMock('@ethereumjs/common', () => ({
    Common: {
      custom: jest.fn(() => ({ common: true })),
    },
    Hardfork: {
      SpuriousDragon: 'SpuriousDragon',
    },
  }));

  jest.doMock('@ethereumjs/tx', () => ({
    TransactionFactory: {
      fromTxData: jest.fn(() => ({
        serialize: () => new Uint8Array([1, 2, 3]),
      })),
    },
  }));

  jest.doMock('@ethereumjs/util', () => ({
    bytesToHex: (bytes: Uint8Array) =>
      `0x${Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('')}`,
    isValidAddress: (...args: unknown[]) => mockIsValidAddress(...args),
    toChecksumAddress: (address: string) => `checksum:${address}`,
  }));

  jest.doMock('@eth-optimism/contracts-ts', () => ({
    addresses: {
      GasPriceOracle: {
        420: '0xgas-oracle',
      },
    },
    abis: {
      GasPriceOracle: [],
    },
  }));

  jest.doMock('@/constant/chains', () => ({
    CHAINS_ENUM: {
      LINEA: 'linea',
      OP: 'op',
      SCRL: 'scrl',
    },
  }));

  jest.doMock('@/constant', () => ({
    INTERNAL_REQUEST_SESSION: 'internal-request-session',
  }));

  jest.doMock('../controllers/provider', () => ({
    __esModule: true,
    default: mockProviderController,
  }));

  jest.doMock('./sendRequest', () => ({
    sendRequest: jest.fn(),
  }));

  jest.doMock('@/core/services', () => ({
    customRPCService: {
      defaultEthRPC: (...args: unknown[]) => mockDefaultEthRPC(...args),
    },
    notificationService: mockNotificationService,
    preferenceService: mockPreferenceService,
    transactionHistoryService: mockTransactionHistoryService,
  }));

  jest.doMock('@/constant/gas', () => ({
    OP_STACK_ENUMS: ['op', 'base'],
  }));

  jest.doMock('@/core/request', () => ({
    openapi: {
      gasMarketV2: (...args: unknown[]) => mockGasMarketV2(...args),
    },
  }));

  jest.doMock('i18next', () => ({
    t: (...args: unknown[]) => mockTranslate(...args),
  }));

  jest.doMock('web3-eth-abi', () => ({
    __esModule: true,
    default: {
      encodeFunctionCall: (...args: unknown[]) =>
        mockEncodeFunctionCall(...args),
    },
  }));

  jest.doMock('@/utils/chain', () => ({
    findChain: (...args: unknown[]) => mockFindChain(...args),
  }));

  jest.doMock('./recommendNonce', () => ({
    getRecommendNonce: (...args: unknown[]) => mockGetRecommendNonce(...args),
  }));

  return require('./provider') as typeof import('./provider');
};

const account = {
  address: '0xabc',
  type: 'SimpleKeyring',
  brandName: 'SimpleKeyring',
};

describe('core/apis/provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationService.currentMiniApproval = null;
    mockEthRpc.mockResolvedValue('0xrpc');
    mockEthSendTransaction.mockResolvedValue('0xtx');
    mockPersonalSign.mockResolvedValue('0xsig');
    mockGasMarketV2.mockResolvedValue({ normal: 'gas' });
    mockFindChain.mockReturnValue({
      id: 1,
      serverId: 'eth',
    });
    mockEncodeFunctionCall.mockReturnValue('0xencodedCall');
    mockIsValidAddress.mockReturnValue(true);
    mockGetRecommendNonce.mockResolvedValue('0x5');
  });

  it('wraps ETH RPC calls with the internal session and account context', async () => {
    const { requestETHRpc } = loadProviderModule();

    await expect(
      requestETHRpc(
        {
          method: 'eth_chainId',
          params: [],
        },
        'eth',
        account as never,
      ),
    ).resolves.toBe('0xrpc');

    expect(mockEthRpc).toHaveBeenCalledWith(
      {
        data: {
          method: 'eth_chainId',
          params: [],
        },
        session: 'internal-request-session',
        account,
      },
      'eth',
    );
  });

  it('rejects allowance lookups without an account or known chain', async () => {
    const { getERC20Allowance } = loadProviderModule();

    await expect(
      getERC20Allowance(
        'eth',
        '0xtoken',
        '0xspender',
        '0xowner',
        null as never,
      ),
    ).rejects.toThrow('translated:background.error.noCurrentAccount');

    mockFindChain.mockReturnValue(undefined);
    await expect(
      getERC20Allowance(
        'unknown',
        '0xtoken',
        '0xspender',
        '0xowner',
        account as never,
      ),
    ).rejects.toThrow('translated:background.error.invalidChainId');
  });

  it('encodes ERC20 allowance calls and returns the RPC value as a string', async () => {
    const { getERC20Allowance } = loadProviderModule();
    mockEthRpc.mockResolvedValue({
      toString: () => '16',
    });

    await expect(
      getERC20Allowance(
        'eth',
        '0xtoken',
        '0xspender',
        '0xowner',
        account as never,
      ),
    ).resolves.toBe('16');

    expect(mockEncodeFunctionCall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'allowance',
      }),
      ['checksum:0xowner', 'checksum:0xspender'],
    );
    expect(mockEthRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          method: 'eth_call',
          params: [{ to: '0xtoken', data: '0xencodedCall' }, 'latest'],
        },
      }),
      'eth',
    );
  });

  it('generates approve transaction payloads with checksum spender and empty hex value', () => {
    const { generateApproveTokenTx } = loadProviderModule();

    expect(
      generateApproveTokenTx({
        from: '0xfrom',
        to: '0xtoken',
        chainId: 1,
        spender: '0xspender',
        amount: '100',
      }),
    ).toEqual({
      from: '0xfrom',
      to: '0xtoken',
      chainId: 1,
      value: '0x',
      data: '0xencodedCall',
    });
    expect(mockEncodeFunctionCall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'approve',
      }),
      ['checksum:0xspender', '100'],
    );
  });

  it('tracks mini approval signing id and removes signing tx on send failure', async () => {
    const { ethSendTransaction } = loadProviderModule();
    const request = {
      approvalRes: {
        signingTxId: 'signing-1',
      },
    };

    await expect(ethSendTransaction(request as never)).resolves.toBe('0xtx');
    expect(mockNotificationService.currentMiniApproval).toEqual({
      signingTxId: 'signing-1',
    });
    expect(mockRemoveSigningTx).not.toHaveBeenCalled();

    const error = new Error('user rejected');
    mockEthSendTransaction.mockRejectedValue(error);
    await expect(ethSendTransaction(request as never)).rejects.toBe(error);
    expect(mockRemoveSigningTx).toHaveBeenCalledWith('signing-1');
  });

  it('delegates personal sign requests to provider controller', async () => {
    const { ethPersonalSign } = loadProviderModule();
    const request = {
      data: {
        method: 'personal_sign',
      },
    };

    await expect(ethPersonalSign(request as never)).resolves.toBe('0xsig');
    expect(mockPersonalSign).toHaveBeenCalledWith(request);
  });

  it('normalizes Linea tx fields and invalid recipient before gas market lookup', async () => {
    const { gasMarketV2 } = loadProviderModule();
    mockIsValidAddress.mockReturnValue(false);
    const params = {
      customGas: 120,
      chain: {
        enum: 'linea',
        serverId: 'linea',
        id: 59144,
      },
      tx: {
        chainId: 59144,
        data: '',
        from: '0xfrom',
        gas: '',
        gasPrice: '',
        to: 'not-an-address',
        value: '0x0',
      },
    };

    await expect(
      gasMarketV2(params as never, account as never),
    ).resolves.toEqual({
      normal: 'gas',
    });

    expect(mockGetRecommendNonce).toHaveBeenCalledWith({
      from: '0xfrom',
      chainId: 59144,
      account,
    });
    expect(mockGasMarketV2).toHaveBeenCalledWith({
      customGas: 120,
      chainId: 'linea',
      tx: {
        chainId: 59144,
        data: '0x',
        from: '0xfrom',
        gas: '0x0',
        gasPrice: '0x0',
        nonce: '0x5',
        to: '0x0000000000000000000000000000000000000000',
        value: '0x0',
      },
    });
    expect(params.tx).not.toHaveProperty('nonce');
  });

  it('passes simple chain gas market requests without tx metadata', async () => {
    const { gasMarketV2 } = loadProviderModule();

    await gasMarketV2(
      {
        chainId: 'eth',
        customGas: 88,
      },
      null,
    );

    expect(mockGasMarketV2).toHaveBeenCalledWith({
      customGas: 88,
      chainId: 'eth',
      tx: undefined,
    });
    expect(mockGetRecommendNonce).not.toHaveBeenCalled();
  });
});
