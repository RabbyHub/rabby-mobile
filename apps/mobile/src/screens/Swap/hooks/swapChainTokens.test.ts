jest.mock('@debank/common', () => ({
  CHAINS_ENUM: { ARBITRUM: 'ARBITRUM', ETH: 'ETH' },
}));

const mockNativeToken = (chain: string, symbol: string) => ({
  amount: 0,
  chain,
  decimals: 18,
  id: `${chain}-native`,
  symbol,
});
const mockUsdc = (chain: string) => ({
  amount: 0,
  chain,
  decimals: 6,
  id: `${chain}-usdc`,
  symbol: 'USDC',
});
const mockNativeTokens: Record<string, ReturnType<typeof mockNativeToken>> = {
  ETH: mockNativeToken('eth', 'ETH'),
  ARBITRUM: mockNativeToken('arb', 'ETH'),
};
const mockReceiveTokens: Record<string, ReturnType<typeof mockUsdc>> = {
  ETH: mockUsdc('eth'),
  ARBITRUM: mockUsdc('arb'),
};

jest.mock('@/constant/swap', () => ({
  getChainDefaultToken: (chain: string) => mockNativeTokens[chain],
  getDefaultSwapToTokenItem: (chain: string) => mockReceiveTokens[chain],
}));

const { CHAINS_ENUM } = require('@debank/common') as {
  CHAINS_ENUM: { ARBITRUM: string; ETH: string };
};
const { resolveSwapChainTokens } =
  require('./swapChainTokens') as typeof import('./swapChainTokens');

describe('resolveSwapChainTokens', () => {
  it('resolves the native pay token and default receive token in one pass', () => {
    expect(resolveSwapChainTokens({ chain: CHAINS_ENUM.ETH })).toMatchObject({
      payToken: { chain: 'eth', symbol: 'ETH' },
      receiveToken: { chain: 'eth', symbol: 'USDC' },
    });

    expect(
      resolveSwapChainTokens({ chain: CHAINS_ENUM.ARBITRUM }),
    ).toMatchObject({
      payToken: { chain: 'arb', symbol: 'ETH' },
      receiveToken: { chain: 'arb', symbol: 'USDC' },
    });
  });

  it('keeps an explicit pay token override', () => {
    expect(
      resolveSwapChainTokens({
        chain: CHAINS_ENUM.ETH,
        payTokenId: '0x1111111111111111111111111111111111111111',
      }).payToken.id,
    ).toBe('0x1111111111111111111111111111111111111111');
  });

  it('keeps the base token on both sides when requested', () => {
    const result = resolveSwapChainTokens({
      chain: CHAINS_ENUM.ETH,
      payUseBaseToken: true,
    });

    expect(result.receiveToken).toMatchObject({
      id: result.payToken.id,
      symbol: 'ETH',
    });
  });
});
