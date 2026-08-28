const mockExtraAgents = jest.fn();
const mockGetMaxBuilderFee = jest.fn();
const mockPrepareApproveAgent = jest.fn(() => ({
  message: { type: 'approveAgent' },
  nonce: 1,
}));
const mockPrepareApproveBuilderFee = jest.fn(() => ({
  message: { type: 'approveBuilderFee' },
  nonce: 2,
}));
const mockSendApproveAgent = jest.fn(async () => ({ status: 'ok' }));
const mockSendApproveBuilderFee = jest.fn(async () => ({ status: 'ok' }));
const mockSetReferrer = jest.fn(async () => ({ status: 'ok' }));
const mockApplyPerpsSigner = jest.fn();
const mockCreatePerpsAgentWallet = jest.fn();
const mockInitPerpsAgentAccount = jest.fn();
const mockSignActions = jest.fn(async actions => {
  actions.forEach((item: { signature: string }) => {
    item.signature = '0xsigned';
  });
});
const mockSetApproveAgent = jest.fn();
const mockSetApproveBuilderFee = jest.fn();

const mockAccount = {
  address: '0x0000000000000000000000000000000000000001',
  type: 'WatchAddressKeyring',
} as const;

const mockState = {
  accountNeedApproveAgent: false,
  accountNeedApproveBuilderFee: false,
  currentPerpsAccount: mockAccount,
};

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    applyPerpsSigner: (...args: unknown[]) => mockApplyPerpsSigner(...args),
    createPerpsAgentWallet: (...args: unknown[]) =>
      mockCreatePerpsAgentWallet(...args),
    getPerpsSDK: () => ({
      exchange: {
        prepareApproveAgent: mockPrepareApproveAgent,
        prepareApproveBuilderFee: mockPrepareApproveBuilderFee,
        sendApproveAgent: mockSendApproveAgent,
        sendApproveBuilderFee: mockSendApproveBuilderFee,
        setReferrer: mockSetReferrer,
      },
      info: {
        extraAgents: mockExtraAgents,
        getMaxBuilderFee: mockGetMaxBuilderFee,
      },
    }),
    initPerpsAgentAccount: (...args: unknown[]) =>
      mockInitPerpsAgentAccount(...args),
  },
}));

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  fetchUserAbstraction: jest.fn(async () => undefined),
  perpsStore: { getState: () => mockState },
  setAccountNeedApproveAgent: (...args: unknown[]) =>
    mockSetApproveAgent(...args),
  setAccountNeedApproveBuilderFee: (...args: unknown[]) =>
    mockSetApproveBuilderFee(...args),
}));

jest.mock('@/utils/async', () => ({ sleep: jest.fn(async () => undefined) }));

jest.mock('@rabby-wallet/base-utils/dist/isomorphic/address', () => ({
  isSameAddress: (left: string, right: string) =>
    left.toLowerCase() === right.toLowerCase(),
}));

jest.mock('./perpsTypedDataSignatures', () => ({
  signPerpsTypedDataActions: (...args: unknown[]) => mockSignActions(...args),
}));

jest.mock('./setAgentUnifiedAccount', () => ({
  setPerpsAgentUnifiedAccount: jest.fn(async () => undefined),
}));

import {
  ensurePerpsActionApproval,
  invalidatePerpsActionApprovalCache,
} from './perpsActionApproval';

describe('ensurePerpsActionApproval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidatePerpsActionApprovalCache();
    mockState.accountNeedApproveAgent = false;
    mockState.accountNeedApproveBuilderFee = false;
    mockApplyPerpsSigner.mockResolvedValue({
      agentAddress: '0x0000000000000000000000000000000000000002',
      isCreate: false,
      isSelfSign: false,
    });
    mockExtraAgents.mockResolvedValue([
      {
        address: '0x0000000000000000000000000000000000000002',
        name: 'rabby-mobile',
        validUntil: Date.now() + 48 * 60 * 60 * 1000,
      },
    ]);
    mockGetMaxBuilderFee.mockResolvedValue(10);
  });

  it('does not request a signature when remote agent and builder approvals are current', async () => {
    await ensurePerpsActionApproval(mockAccount as never);

    expect(mockExtraAgents).toHaveBeenCalledWith(mockAccount.address);
    expect(mockGetMaxBuilderFee).toHaveBeenCalled();
    expect(mockSignActions).not.toHaveBeenCalled();
  });

  it('rotates and signs a remotely expired agent before the action continues', async () => {
    mockExtraAgents.mockResolvedValue([
      {
        address: '0x0000000000000000000000000000000000000002',
        name: 'rabby-mobile',
        validUntil: Date.now() - 1,
      },
    ]);
    mockCreatePerpsAgentWallet.mockResolvedValue({
      agentAddress: '0x0000000000000000000000000000000000000003',
      vault: 'encrypted-vault',
    });

    await ensurePerpsActionApproval(mockAccount as never, {
      forceRemoteCheck: true,
    });

    expect(mockCreatePerpsAgentWallet).toHaveBeenCalledWith(
      mockAccount.address,
    );
    expect(mockInitPerpsAgentAccount).toHaveBeenCalledWith(
      mockAccount.address,
      'encrypted-vault',
      '0x0000000000000000000000000000000000000003',
    );
    expect(mockSignActions).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          action: expect.objectContaining({
            message: { type: 'approveAgent' },
          }),
          type: 'approveAgent',
        }),
      ],
      mockAccount,
    );
    expect(mockSendApproveAgent).toHaveBeenCalledWith({
      action: { type: 'approveAgent' },
      nonce: 1,
      signature: '0xsigned',
    });
  });

  it('checks only the agent for commands that do not carry a builder fee', async () => {
    await ensurePerpsActionApproval(mockAccount as never, {
      builderFee: false,
    });

    expect(mockExtraAgents).toHaveBeenCalledWith(mockAccount.address);
    expect(mockGetMaxBuilderFee).not.toHaveBeenCalled();
    expect(mockPrepareApproveBuilderFee).not.toHaveBeenCalled();
  });
});
