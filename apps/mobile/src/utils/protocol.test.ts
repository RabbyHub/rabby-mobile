const mockJsonStringToObj = jest.fn();

function loadProtocolModule() {
  jest.resetModules();

  jest.doMock('@/databases/entities/_helpers', () => ({
    columnConverter: {
      jsonStringToObj: (value: string) => mockJsonStringToObj(value),
    },
  }));

  jest.doMock('@/databases/entities/portocolItem', () => ({
    ProtocolItemEntity: class ProtocolItemEntity {},
  }));

  return require('./protocol') as typeof import('./protocol');
}

describe('protocol utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('portfolioToIProtocolPortfolio sums token worth and signed real usd value', () => {
    const { portfolioToIProtocolPortfolio } = loadProtocolModule();

    expect(
      portfolioToIProtocolPortfolio({
        pool: { id: 'pool-1' },
        position_index: '',
        name: 'Portfolio',
        asset_token_list: [
          { price: 2, amount: 3 },
          { price: 1, amount: -4 },
        ],
        stats: null,
      } as any),
    ).toMatchObject({
      id: 'pool-1',
      name: 'Portfolio',
      _sumTokenRealUsdValue: 2,
      netWorth: 10,
    });
  });

  it('protocolEntity2IProtocolItem converts and sorts portfolios by net worth', () => {
    mockJsonStringToObj.mockReturnValue([
      {
        pool: { id: 'p-small' },
        name: 'Small',
        asset_token_list: [{ price: 1, amount: 1 }],
      },
      {
        pool: { id: 'p-large' },
        name: 'Large',
        asset_token_list: [{ price: 5, amount: 2 }],
      },
    ]);
    const { protocolEntity2IProtocolItem } = loadProtocolModule();

    const result = protocolEntity2IProtocolItem({
      id: 'protocol-1',
      name: 'Aave',
      logo_url: 'logo',
      chain: 'eth',
      site_url: 'site',
      owner_addr: '0xabc',
      portfolio_item_list: 'raw-json',
    } as any);

    expect(mockJsonStringToObj).toHaveBeenCalledWith('raw-json');
    expect(result.netWorth).toBe(11);
    expect(result._portfolios.map(item => item.id)).toEqual([
      'p-large',
      'p-small',
    ]);
  });

  it('complexProtocol2ProtocolItem preserves owner address and sums sorted portfolios', () => {
    const { complexProtocol2ProtocolItem } = loadProtocolModule();

    const result = complexProtocol2ProtocolItem(
      {
        id: 'protocol-2',
        name: 'Compound',
        logo_url: 'logo',
        chain: 'eth',
        site_url: 'site',
        portfolio_item_list: [
          {
            pool: { id: 'p1' },
            name: 'P1',
            asset_token_list: [{ price: 3, amount: 1 }],
          },
          {
            pool: { id: 'p2' },
            name: 'P2',
            asset_token_list: [{ price: 1, amount: 1 }],
          },
        ],
      } as any,
      '0xowner',
    );

    expect(result.owner_addr).toBe('0xowner');
    expect(result.netWorth).toBe(4);
    expect(result._portfolios.map(item => item.id)).toEqual(['p1', 'p2']);
  });
});
