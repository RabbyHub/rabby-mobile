const mockHyperliquidSDK = jest.fn();
const mockDisconnect = jest.fn();
const mockPerpsService = {
  createAgentWallet: jest.fn(),
  setCurrentAccount: jest.fn(),
  getCurrentAccount: jest.fn(),
  getLastUsedAccount: jest.fn(),
  getAgentWalletPreference: jest.fn(),
  updateAgentWalletPreference: jest.fn(),
  setSendApproveAfterDeposit: jest.fn(),
  getSendApproveAfterDeposit: jest.fn(),
  setHasDoneNewUserProcess: jest.fn(),
  getHasDoneNewUserProcess: jest.fn(),
  setHasShownPerpsGuidePopup: jest.fn(),
  getHasShownPerpsGuidePopup: jest.fn(),
  setHasClosedLearnMoreCard: jest.fn(),
  getHasClosedLearnMoreCard: jest.fn(),
  setSelectedKlineInterval: jest.fn(),
  getSelectedKlineInterval: jest.fn(),
  getAgentWallet: jest.fn(),
};

const loadPerpsModule = () => {
  jest.resetModules();

  mockHyperliquidSDK.mockImplementation(options => ({
    options,
    ws: {
      disconnect: mockDisconnect,
    },
  }));

  jest.doMock('@rabby-wallet/hyperliquid-sdk', () => ({
    HyperliquidSDK: (...args: unknown[]) => mockHyperliquidSDK(...args),
  }));

  jest.doMock('../services', () => ({
    perpsService: mockPerpsService,
  }));

  jest.doMock('@/utils/walletUnlockGuard', () => ({
    withWalletUnlock: (fn: (...args: unknown[]) => unknown) => fn,
  }));

  return require('./perps') as typeof import('./perps');
};

describe('core/apis/perps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPerpsService.createAgentWallet.mockResolvedValue({
      vault: 'created-vault',
      agentAddress: '0xcreated',
    });
    mockPerpsService.getAgentWallet.mockResolvedValue(undefined);
  });

  it('creates one Hyperliquid SDK instance and disconnects it on destroy', () => {
    const { apisPerps } = loadPerpsModule();

    const first = apisPerps.getPerpsSDK();
    const second = apisPerps.getPerpsSDK();

    expect(first).toBe(second);
    expect(mockHyperliquidSDK).toHaveBeenCalledTimes(1);
    expect(mockHyperliquidSDK).toHaveBeenCalledWith({
      isTestnet: false,
      timeout: 10000,
    });

    apisPerps.destroyPerpsSDK();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);

    const next = apisPerps.getPerpsSDK();
    expect(next).not.toBe(first);
    expect(mockHyperliquidSDK).toHaveBeenCalledTimes(2);
  });

  it('creates an agent wallet when none exists', async () => {
    const { apisPerps } = loadPerpsModule();

    await expect(
      apisPerps.getOrCreatePerpsAgentWallet('0xmaster'),
    ).resolves.toEqual({
      vault: 'created-vault',
      agentAddress: '0xcreated',
    });

    expect(mockPerpsService.getAgentWallet).toHaveBeenCalledWith('0xmaster');
    expect(mockPerpsService.createAgentWallet).toHaveBeenCalledWith('0xmaster');
  });

  it('returns existing agent wallet preference without creating a new one', async () => {
    const { apisPerps } = loadPerpsModule();
    mockPerpsService.getAgentWallet.mockResolvedValue({
      vault: 'existing-vault',
      preference: {
        agentAddress: '0xexisting',
      },
    });

    await expect(
      apisPerps.getOrCreatePerpsAgentWallet('0xmaster'),
    ).resolves.toEqual({
      vault: 'existing-vault',
      agentAddress: '0xexisting',
    });

    expect(mockPerpsService.createAgentWallet).not.toHaveBeenCalled();
  });

  it('delegates agent wallet and preference helpers to perps service', async () => {
    const { apisPerps } = loadPerpsModule();
    mockPerpsService.getAgentWalletPreference.mockResolvedValue({
      agentAddress: '0xagent',
    });
    mockPerpsService.getSendApproveAfterDeposit.mockResolvedValue(true);

    await expect(apisPerps.createPerpsAgentWallet('0xmaster')).resolves.toEqual(
      {
        vault: 'created-vault',
        agentAddress: '0xcreated',
      },
    );
    await expect(
      apisPerps.getAgentWalletPreference('0xmaster'),
    ).resolves.toEqual({
      agentAddress: '0xagent',
    });
    await expect(
      apisPerps.getSendApproveAfterDeposit('0xmaster'),
    ).resolves.toBe(true);

    expect(mockPerpsService.createAgentWallet).toHaveBeenCalledWith('0xmaster');
    expect(mockPerpsService.getAgentWalletPreference).toHaveBeenCalledWith(
      '0xmaster',
    );
    expect(mockPerpsService.getSendApproveAfterDeposit).toHaveBeenCalledWith(
      '0xmaster',
    );
  });
});
