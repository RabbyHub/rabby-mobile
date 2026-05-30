const mockSecurityEngineService = {
  getRules: jest.fn(),
  getUserData: jest.fn(),
  execute: jest.fn(),
  updateUserData: jest.fn(),
  removeContractBlacklistFromAllChains: jest.fn(),
  addContractWhitelist: jest.fn(),
  removeContractWhitelist: jest.fn(),
  addContractBlacklist: jest.fn(),
  removeAddressBlacklist: jest.fn(),
  addAddressWhitelist: jest.fn(),
  removeAddressWhitelist: jest.fn(),
  addAddressBlacklist: jest.fn(),
  removeOriginBlacklist: jest.fn(),
  addOriginWhitelist: jest.fn(),
  removeOriginWhitelist: jest.fn(),
  addOriginBlacklist: jest.fn(),
  enableRule: jest.fn(),
  disableRule: jest.fn(),
};

const loadSecurityEngineModule = () => {
  jest.resetModules();
  jest.doMock('../services', () => ({
    securityEngineService: mockSecurityEngineService,
  }));

  return require('./securityEngine') as typeof import('./securityEngine');
};

const expectCalledBefore = (first: jest.Mock, second: jest.Mock) => {
  expect(first.mock.invocationCallOrder[0]).toBeLessThan(
    second.mock.invocationCallOrder[0],
  );
};

describe('core/apis/securityEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates read, execute, and user-data update calls to the service', () => {
    const {
      executeSecurityEngine,
      getSecurityEngineRules,
      getSecurityEngineUserData,
      updateUserData,
    } = loadSecurityEngineModule();
    const rules = [{ id: 'rule-1' }];
    const userData = { addressWhitelist: [] };
    const actionData = { type: 'transfer' };
    mockSecurityEngineService.getRules.mockReturnValue(rules);
    mockSecurityEngineService.getUserData.mockReturnValue(userData);
    mockSecurityEngineService.execute.mockReturnValue({ decision: 'pass' });

    expect(getSecurityEngineRules()).toBe(rules);
    expect(getSecurityEngineUserData()).toBe(userData);
    expect(executeSecurityEngine(actionData as never)).toEqual({
      decision: 'pass',
    });
    updateUserData(userData as never);

    expect(mockSecurityEngineService.execute).toHaveBeenCalledWith(actionData);
    expect(mockSecurityEngineService.updateUserData).toHaveBeenCalledWith(
      userData,
    );
  });

  it('keeps contract whitelist and blacklist mutually exclusive', () => {
    const { addContractBlacklist, addContractWhitelist } =
      loadSecurityEngineModule();
    const contract = {
      chainId: 1,
      address: '0xcontract',
    };

    addContractWhitelist(contract as never);
    expect(
      mockSecurityEngineService.removeContractBlacklistFromAllChains,
    ).toHaveBeenCalledWith(contract);
    expect(mockSecurityEngineService.addContractWhitelist).toHaveBeenCalledWith(
      contract,
    );
    expectCalledBefore(
      mockSecurityEngineService.removeContractBlacklistFromAllChains,
      mockSecurityEngineService.addContractWhitelist,
    );

    addContractBlacklist(contract as never);
    expect(
      mockSecurityEngineService.removeContractWhitelist,
    ).toHaveBeenCalledWith(contract);
    expect(mockSecurityEngineService.addContractBlacklist).toHaveBeenCalledWith(
      contract,
    );
    expectCalledBefore(
      mockSecurityEngineService.removeContractWhitelist,
      mockSecurityEngineService.addContractBlacklist,
    );
  });

  it('keeps address whitelist and blacklist mutually exclusive', () => {
    const { addAddressBlacklist, addAddressWhitelist } =
      loadSecurityEngineModule();

    addAddressWhitelist('0xabc');
    expect(
      mockSecurityEngineService.removeAddressBlacklist,
    ).toHaveBeenCalledWith('0xabc');
    expect(mockSecurityEngineService.addAddressWhitelist).toHaveBeenCalledWith(
      '0xabc',
    );
    expectCalledBefore(
      mockSecurityEngineService.removeAddressBlacklist,
      mockSecurityEngineService.addAddressWhitelist,
    );

    addAddressBlacklist('0xdef');
    expect(
      mockSecurityEngineService.removeAddressWhitelist,
    ).toHaveBeenCalledWith('0xdef');
    expect(mockSecurityEngineService.addAddressBlacklist).toHaveBeenCalledWith(
      '0xdef',
    );
    expectCalledBefore(
      mockSecurityEngineService.removeAddressWhitelist,
      mockSecurityEngineService.addAddressBlacklist,
    );
  });

  it('keeps origin whitelist and blacklist mutually exclusive', () => {
    const { addOriginBlacklist, addOriginWhitelist } =
      loadSecurityEngineModule();

    addOriginWhitelist('https://safe.example');
    expect(
      mockSecurityEngineService.removeOriginBlacklist,
    ).toHaveBeenCalledWith('https://safe.example');
    expect(mockSecurityEngineService.addOriginWhitelist).toHaveBeenCalledWith(
      'https://safe.example',
    );

    addOriginBlacklist('https://risk.example');
    expect(
      mockSecurityEngineService.removeOriginWhitelist,
    ).toHaveBeenCalledWith('https://risk.example');
    expect(mockSecurityEngineService.addOriginBlacklist).toHaveBeenCalledWith(
      'https://risk.example',
    );
  });

  it('delegates remove operations to the matching service methods', () => {
    const {
      removeAddressBlacklist,
      removeAddressWhitelist,
      removeContractBlacklist,
      removeContractWhitelist,
      removeOriginBlacklist,
      removeOriginWhitelist,
    } = loadSecurityEngineModule();
    const contract = {
      chainId: 1,
      address: '0xcontract',
    };

    removeContractWhitelist(contract as never);
    removeContractBlacklist(contract as never);
    removeAddressWhitelist('0xabc');
    removeAddressBlacklist('0xdef');
    removeOriginWhitelist('https://safe.example');
    removeOriginBlacklist('https://risk.example');

    expect(
      mockSecurityEngineService.removeContractWhitelist,
    ).toHaveBeenCalledWith(contract);
    expect(
      mockSecurityEngineService.removeContractBlacklistFromAllChains,
    ).toHaveBeenCalledWith(contract);
    expect(
      mockSecurityEngineService.removeAddressWhitelist,
    ).toHaveBeenCalledWith('0xabc');
    expect(
      mockSecurityEngineService.removeAddressBlacklist,
    ).toHaveBeenCalledWith('0xdef');
    expect(
      mockSecurityEngineService.removeOriginWhitelist,
    ).toHaveBeenCalledWith('https://safe.example');
    expect(
      mockSecurityEngineService.removeOriginBlacklist,
    ).toHaveBeenCalledWith('https://risk.example');
  });

  it('routes rule status changes to enable or disable operations', () => {
    const { ruleEnableStatusChange } = loadSecurityEngineModule();

    ruleEnableStatusChange('rule-a', true);
    ruleEnableStatusChange('rule-b', false);

    expect(mockSecurityEngineService.enableRule).toHaveBeenCalledWith('rule-a');
    expect(mockSecurityEngineService.disableRule).toHaveBeenCalledWith(
      'rule-b',
    );
  });
});
