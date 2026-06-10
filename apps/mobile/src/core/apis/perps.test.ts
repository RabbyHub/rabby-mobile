import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

function loadPerpsModule({ isUnlocked = true }: { isUnlocked?: boolean } = {}) {
  jest.resetModules();

  const mockCreateAgentWallet = jest.fn();
  const mockDisconnect = jest.fn();
  const mockGetAgentWallet = jest.fn();
  const mockGetAgentWalletPreference = jest.fn();
  const mockGetCurrentAccount = jest.fn();
  const mockGetHasClosedLearnMoreCard = jest.fn();
  const mockGetHasDoneNewUserProcess = jest.fn();
  const mockGetHasShownPerpsGuidePopup = jest.fn();
  const mockGetLastUsedAccount = jest.fn();
  const mockGetSelectedKlineInterval = jest.fn();
  const mockGetSendApproveAfterDeposit = jest.fn();
  const mockHyperliquidSDK = jest.fn().mockImplementation(params => ({
    params,
    ws: {
      disconnect: mockDisconnect,
    },
  }));
  const mockIsUnlocked = jest.fn(() => isUnlocked);
  const mockSetCurrentAccount = jest.fn();
  const mockSetHasClosedLearnMoreCard = jest.fn();
  const mockSetHasDoneNewUserProcess = jest.fn();
  const mockSetHasShownPerpsGuidePopup = jest.fn();
  const mockSetSelectedKlineInterval = jest.fn();
  const mockSetSendApproveAfterDeposit = jest.fn();
  const mockUpdateAgentWalletPreference = jest.fn();

  jest.doMock('@rabby-wallet/hyperliquid-sdk', () => ({
    HyperliquidSDK: mockHyperliquidSDK,
  }));
  jest.doMock('@/core/apis/lock', () => ({
    isUnlocked: (...args: unknown[]) => mockIsUnlocked(...args),
  }));
  jest.doMock('../services', () => ({
    perpsService: {
      createAgentWallet: mockCreateAgentWallet,
      getAgentWallet: mockGetAgentWallet,
      getAgentWalletPreference: mockGetAgentWalletPreference,
      getCurrentAccount: mockGetCurrentAccount,
      getHasClosedLearnMoreCard: mockGetHasClosedLearnMoreCard,
      getHasDoneNewUserProcess: mockGetHasDoneNewUserProcess,
      getHasShownPerpsGuidePopup: mockGetHasShownPerpsGuidePopup,
      getLastUsedAccount: mockGetLastUsedAccount,
      getSelectedKlineInterval: mockGetSelectedKlineInterval,
      getSendApproveAfterDeposit: mockGetSendApproveAfterDeposit,
      setCurrentAccount: mockSetCurrentAccount,
      setHasClosedLearnMoreCard: mockSetHasClosedLearnMoreCard,
      setHasDoneNewUserProcess: mockSetHasDoneNewUserProcess,
      setHasShownPerpsGuidePopup: mockSetHasShownPerpsGuidePopup,
      setSelectedKlineInterval: mockSetSelectedKlineInterval,
      setSendApproveAfterDeposit: mockSetSendApproveAfterDeposit,
      updateAgentWalletPreference: mockUpdateAgentWalletPreference,
    },
  }));
  jest.doMock('./keyring', () => ({
    apisKeyring: { signTypedData: jest.fn() },
  }));

  const { apisPerps } = require('./perps') as typeof import('./perps');

  return {
    apisPerps,
    mocks: {
      mockCreateAgentWallet,
      mockDisconnect,
      mockGetAgentWallet,
      mockHyperliquidSDK,
      mockIsUnlocked,
    },
  };
}

describe('core/apis/perps', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('lazily creates, reuses, and destroys the Hyperliquid SDK singleton', () => {
    const { apisPerps, mocks } = loadPerpsModule();

    const firstSDK = apisPerps.getPerpsSDK();
    const secondSDK = apisPerps.getPerpsSDK();

    expect(secondSDK).toBe(firstSDK);
    expect(mocks.mockHyperliquidSDK).toHaveBeenCalledTimes(1);
    expect(mocks.mockHyperliquidSDK).toHaveBeenCalledWith({
      isTestnet: false,
      timeout: 10000,
    });

    apisPerps.destroyPerpsSDK();
    expect(mocks.mockDisconnect).toHaveBeenCalledTimes(1);

    const recreatedSDK = apisPerps.getPerpsSDK();
    expect(recreatedSDK).not.toBe(firstSDK);
    expect(mocks.mockHyperliquidSDK).toHaveBeenCalledTimes(2);
  });

  it('requires an unlocked wallet before creating an agent wallet', async () => {
    const unlocked = loadPerpsModule({
      isUnlocked: true,
    });
    unlocked.mocks.mockCreateAgentWallet.mockResolvedValue({
      agentAddress: '0xagent',
      vault: '0xvault',
    });

    await expect(
      unlocked.apisPerps.createPerpsAgentWallet('0xmaster'),
    ).resolves.toEqual({
      agentAddress: '0xagent',
      vault: '0xvault',
    });
    expect(unlocked.mocks.mockCreateAgentWallet).toHaveBeenCalledWith(
      '0xmaster',
    );

    const locked = loadPerpsModule({
      isUnlocked: false,
    });
    await expect(
      locked.apisPerps.createPerpsAgentWallet('0xmaster'),
    ).rejects.toThrow('background.error.unlock');
    expect(locked.mocks.mockCreateAgentWallet).not.toHaveBeenCalled();
  });

  it('returns an existing agent wallet preference without creating a new wallet', async () => {
    const { apisPerps, mocks } = loadPerpsModule();
    mocks.mockGetAgentWallet.mockResolvedValue({
      preference: {
        agentAddress: '0xexisting-agent',
      },
      vault: '0xexisting-vault',
    });

    await expect(
      apisPerps.getOrCreatePerpsAgentWallet('0xmaster'),
    ).resolves.toEqual({
      agentAddress: '0xexisting-agent',
      vault: '0xexisting-vault',
      isCreate: false,
    });

    expect(mocks.mockGetAgentWallet).toHaveBeenCalledWith('0xmaster');
    expect(mocks.mockCreateAgentWallet).not.toHaveBeenCalled();
  });

  it('creates an agent wallet when no existing perps wallet is stored', async () => {
    const { apisPerps, mocks } = loadPerpsModule();
    mocks.mockGetAgentWallet.mockResolvedValue(null);
    mocks.mockCreateAgentWallet.mockResolvedValue({
      agentAddress: '0xnew-agent',
      vault: '0xnew-vault',
    });

    await expect(
      apisPerps.getOrCreatePerpsAgentWallet('0xmaster'),
    ).resolves.toEqual({
      agentAddress: '0xnew-agent',
      vault: '0xnew-vault',
      isCreate: true,
    });

    expect(mocks.mockGetAgentWallet).toHaveBeenCalledWith('0xmaster');
    expect(mocks.mockCreateAgentWallet).toHaveBeenCalledWith('0xmaster');
  });

  it('isSelfSignPerpsAccount: true for private-key & mnemonic, false otherwise', () => {
    const { apisPerps } = loadPerpsModule();
    expect(apisPerps.isSelfSignPerpsAccount(KEYRING_CLASS.PRIVATE_KEY)).toBe(
      true,
    );
    expect(apisPerps.isSelfSignPerpsAccount(KEYRING_CLASS.MNEMONIC)).toBe(true);
    expect(
      apisPerps.isSelfSignPerpsAccount(KEYRING_CLASS.HARDWARE.LEDGER),
    ).toBe(false);
    expect(apisPerps.isSelfSignPerpsAccount('WalletConnect')).toBe(false);
    expect(apisPerps.isSelfSignPerpsAccount(undefined)).toBe(false);
  });
});
