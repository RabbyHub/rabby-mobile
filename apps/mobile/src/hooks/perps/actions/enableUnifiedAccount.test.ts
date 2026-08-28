const mockPrepare = jest.fn();
const mockSend = jest.fn();
const mockInvalidateUserAbstractionCache = jest.fn(async () => undefined);
const mockFetchUserAbstraction = jest.fn(async () => {
  mockState.userAbstraction = 'unifiedAccount';
});
const mockSignActions = jest.fn(async actions => {
  actions.forEach((item: { signature: string }) => {
    item.signature = '0xmaster-signature';
  });
});

const mockAccount = {
  address: '0x0000000000000000000000000000000000000001',
  type: 'PrivateKeyring',
} as const;

const mockState = {
  currentPerpsAccount: mockAccount,
  ready: true,
  userAbstraction: 'default',
};

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => ({
      exchange: {
        prepareUserSetAbstraction: mockPrepare,
        sendUserSetAbstraction: mockSend,
      },
    }),
  },
}));

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  fetchUserAbstraction: (...args: unknown[]) =>
    mockFetchUserAbstraction(...args),
  invalidateUserAbstractionCache: (...args: unknown[]) =>
    mockInvalidateUserAbstractionCache(...args),
  getPerpsAccountRuntimeContext: () => ({
    account: mockState.currentPerpsAccount,
    generation: 7,
  }),
  isPerpsUserAbstractionReadyForAccount: () => mockState.ready,
  perpsStore: { getState: () => mockState },
}));

jest.mock('./perpsTypedDataSignatures', () => ({
  signPerpsTypedDataActions: (...args: unknown[]) => mockSignActions(...args),
}));

jest.mock('@/utils/async', () => ({ sleep: jest.fn(async () => undefined) }));

import {
  executeEnablePerpsUnifiedAccount,
  isPerpsUnifiedCollateralMode,
} from './enableUnifiedAccount';

describe('executeEnablePerpsUnifiedAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.currentPerpsAccount = mockAccount;
    mockState.ready = true;
    mockState.userAbstraction = 'default';
    mockPrepare.mockReturnValue({
      domain: { name: 'Exchange' },
      message: { type: 'userSetAbstraction' },
      nonce: 9,
      primaryType: 'HyperliquidTransaction:UserSetAbstraction',
      types: { EIP712Domain: [] },
    });
    mockSend.mockResolvedValue({ status: 'ok' });
  });

  it('uses the master typed-data signer and verifies the refreshed abstraction', async () => {
    await executeEnablePerpsUnifiedAccount(mockAccount as never);

    expect(mockPrepare).toHaveBeenCalledWith({
      abstraction: 'unifiedAccount',
      user: mockAccount.address,
    });
    expect(mockSignActions).toHaveBeenCalledWith(
      [
        {
          action: {
            domain: { name: 'Exchange' },
            message: { type: 'userSetAbstraction' },
            primaryType: 'HyperliquidTransaction:UserSetAbstraction',
            types: { EIP712Domain: [] },
          },
          signature: '0xmaster-signature',
        },
      ],
      mockAccount,
    );
    expect(mockSend).toHaveBeenCalledWith({
      action: { type: 'userSetAbstraction' },
      nonce: 9,
      signature: '0xmaster-signature',
    });
    expect(mockInvalidateUserAbstractionCache).toHaveBeenCalledWith(
      mockAccount.address,
    );
    expect(
      isPerpsUnifiedCollateralMode(mockState.userAbstraction as never),
    ).toBe(true);
  });

  it('retries a transient abstraction refresh failure after the mutation is accepted', async () => {
    mockFetchUserAbstraction
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockImplementationOnce(async () => {
        mockState.userAbstraction = 'unifiedAccount';
      });

    await executeEnablePerpsUnifiedAccount(mockAccount as never);

    expect(mockFetchUserAbstraction).toHaveBeenCalledTimes(2);
  });
});
