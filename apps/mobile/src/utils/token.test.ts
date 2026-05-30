jest.mock('./chain', () => ({
  findChain: jest.fn(),
}));

jest.mock('@/constant/gas', () => ({
  MINIMUM_GAS_LIMIT: 21000,
}));

jest.mock('@/utils/number', () => ({
  formatAmount: (value: number) => `${value}`,
  formatUsdValue: (value: number) => `$${value}`,
}));

jest.mock('@rabby-wallet/biz-utils', () => ({
  bizNumberUtils: {
    formatPrice: (value: number) => `$${value}`,
  },
}));

import type {
  GasLevel,
  MemeItem,
  PortfolioItemToken,
  TokenItem,
  TokenItemWithEntity,
  TokenMarketTokenItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { findChain } from './chain';
import {
  DisplayedToken,
  DisplayedTokenWithOwner,
  SMALL_TOKEN_ID,
  abstractTokenToTokenItem,
  checkIfTokenBalanceEnough,
  customTestnetTokenToTokenItem,
  ellipsisTokenSymbol,
  getTokenSymbol,
  isSameTestnetToken,
  isTestnetTokenItem,
  isTokenMarketClosed,
  memeItemToITokenItem,
  scamTokenFilter,
  tokenItem2AbstractTokenWithOwner,
  tokenItemEntityToTokenItem,
  tokenItemToITokenItem,
} from './token';

const mockFindChain = findChain as jest.MockedFunction<typeof findChain>;

const portfolioToken = (
  overrides: Partial<PortfolioItemToken> = {},
): PortfolioItemToken =>
  ({
    id: '0xtoken',
    chain: 'eth',
    amount: 2,
    raw_amount: 2_000_000,
    raw_amount_hex_str: '0x1e8480',
    decimals: 6,
    display_symbol: 'USDC',
    is_core: true,
    is_verified: true,
    is_wallet: true,
    is_scam: false,
    is_suspicious: false,
    logo_url: 'https://assets.example/usdc.png',
    name: 'USD Coin',
    optimized_symbol: 'USDC',
    price: 3,
    symbol: 'USDC',
    time_at: 1,
    price_24h_change: 0.1,
    low_credit_score: false,
    credit_score: 100,
    cex_ids: ['binance'],
    fdv: 123,
    support_market_data: true,
    ...overrides,
  } as PortfolioItemToken);

const tokenItem = (overrides: Partial<TokenItem> = {}): TokenItem =>
  ({
    amount: 2,
    chain: 'eth',
    decimals: 6,
    display_symbol: 'USDC',
    id: '0xtoken',
    is_core: true,
    is_verified: true,
    is_wallet: true,
    logo_url: '',
    name: 'USD Coin',
    optimized_symbol: 'USDC',
    price: 3,
    raw_amount: '2000000',
    raw_amount_hex_str: '0x1e8480',
    symbol: 'USDC',
    time_at: 1,
    usd_value: 6,
    ...overrides,
  } as TokenItem);

describe('token display helpers', () => {
  it('ellipsizes long token symbols after the requested prefix length', () => {
    expect(ellipsisTokenSymbol('USDC')).toBe('USDC');
    expect(ellipsisTokenSymbol('VERYLONGSYMBOL', 4)).toBe('VERY...');
  });

  it('resolves token symbols by optimized, display, then raw symbol priority', () => {
    expect(
      getTokenSymbol({
        optimized_symbol: 'OPT',
        display_symbol: 'DISPLAY',
        symbol: 'RAW',
      }),
    ).toBe('OPT');
    expect(
      getTokenSymbol({
        optimized_symbol: '',
        display_symbol: 'DISPLAY',
        symbol: 'RAW',
      }),
    ).toBe('DISPLAY');
    expect(getTokenSymbol({ symbol: 'RAW' })).toBe('RAW');
    expect(getTokenSymbol()).toBe('');
  });

  it('detects closed token markets only by the exact closed status', () => {
    expect(isTokenMarketClosed({ market_status: 'closed' })).toBe(true);
    expect(isTokenMarketClosed({ market_status: 'open' })).toBe(false);
    expect(isTokenMarketClosed()).toBe(false);
  });

  it('maps abstract portfolio tokens into persisted token items and fold metadata', () => {
    const token = abstractTokenToTokenItem({
      ...portfolioToken(),
      _tokenId: '0xreal',
      _usdValueStr: '$0.42',
      _isPined: true,
      _isFold: true,
      _isManualFold: true,
      _isExcludeBalance: true,
      _pinIndex: 7,
    } as any);

    expect(token).toMatchObject({
      id: '0xreal',
      chain: 'eth',
      amount: 2,
      isPined: true,
      isFold: true,
      isManualFold: true,
      isExcludeBalance: true,
      pinIndex: 7,
      cex_ids: ['binance'],
    });

    const foldRow = abstractTokenToTokenItem({
      ...portfolioToken({ id: SMALL_TOKEN_ID }),
      _tokenId: SMALL_TOKEN_ID,
      _usdValueStr: '$1.23',
    } as any);
    expect(foldRow).toMatchObject({
      isFakerFoldRow: true,
      smallTokenAllUsdValue: '$1.23',
    });
  });
});

describe('DisplayedToken', () => {
  it('normalizes debt-like negative amounts while preserving real USD value', () => {
    const token = new DisplayedToken(
      portfolioToken({
        amount: -2,
        price: 3,
      }),
    );

    expect(token._realUsdValue).toBe(-6);
    expect(token._usdValue).toBe(6);
    expect(token._tokenId).toBe('0xtoken');
    expect(token.symbol).toBe('USDC');
    expect(token.cex_ids).toEqual(['binance']);
  });

  it('patches history using absolute debt amounts but keeps signed real-value delta', () => {
    const token = new DisplayedToken(
      portfolioToken({
        amount: -2,
        price: 3,
      }),
    );

    token.patchHistory(
      portfolioToken({
        amount: -1,
        price: 2,
      }),
    );

    expect(token._historyPatched).toBe(true);
    expect(token._amountChange).toBe(1);
    expect(token._usdValueChange).toBe(4);
    expect(token._realUsdValueChange).toBe(-4);
  });

  it('patches price once for tokens without history data', () => {
    const token = new DisplayedToken(portfolioToken({ amount: 2, price: 3 }));

    token.patchPrice(4);

    expect(token._historyPatched).toBe(true);
    expect(token._usdValueChange).toBe(-2);
    expect(token._realUsdValueChange).toBe(-2);

    token.patchPrice(1);
    expect(token._usdValueChange).toBe(-2);
  });

  it('copies owner account data when wrapping tokens with owners', () => {
    const owner = {
      address: '0x1111111111111111111111111111111111111111',
      type: 'SimpleKeyring',
      aliasName: 'Main',
    } as any;
    const token = new DisplayedTokenWithOwner(portfolioToken(), owner);
    owner.aliasName = 'Mutated';

    expect(token.ownerAccount).toMatchObject({ aliasName: 'Main' });
    expect(tokenItem2AbstractTokenWithOwner(tokenItem(), owner)).toBeInstanceOf(
      DisplayedTokenWithOwner,
    );
  });
});

describe('token chain and balance helpers', () => {
  beforeEach(() => {
    mockFindChain.mockReset();
  });

  it('converts custom testnet tokens through the chain registry', () => {
    mockFindChain.mockReturnValue({ serverId: 'custom-testnet' } as any);

    expect(
      customTestnetTokenToTokenItem({
        id: '0xabc',
        chainId: 12345,
        amount: 1.5,
        rawAmount: '1500000',
        decimals: 6,
        symbol: 'TST',
      }),
    ).toMatchObject({
      id: '0xabc',
      chain: 'custom-testnet',
      raw_amount_hex_str: '0x16e360',
      symbol: 'TST',
      is_verified: false,
    });

    expect(mockFindChain).toHaveBeenCalledWith({ id: 12345 });
  });

  it('detects testnet token items via the chain registry', () => {
    mockFindChain.mockImplementation(({ serverId }) =>
      serverId === 'custom-testnet' ? ({ isTestnet: true } as any) : undefined,
    );

    expect(isTestnetTokenItem(tokenItem({ chain: 'custom-testnet' }))).toBe(
      true,
    );
    expect(isTestnetTokenItem(tokenItem({ chain: 'eth' }))).toBeUndefined();
  });

  it('compares custom testnet tokens by lowercase id and numeric chain id', () => {
    expect(
      isSameTestnetToken(
        { id: '0xABC', chainId: '123' },
        { id: '0xabc', chainId: 123 },
      ),
    ).toBe(true);
    expect(
      isSameTestnetToken(
        { id: '0xABC', chainId: '123' },
        { id: '0xdef', chainId: 123 },
      ),
    ).toBe(false);
  });

  it('checks token gas balance against slow and normal gas levels', () => {
    const gasList = [
      { level: 'normal', price: 11 },
      { level: 'slow', price: 10 },
      { level: 'custom', price: 99 },
    ] as GasLevel[];

    expect(
      checkIfTokenBalanceEnough(tokenItem({ raw_amount_hex_str: '0x64' }), {
        gasLimit: 10,
        gasList,
      }),
    ).toMatchObject({
      normalLevel: gasList[0],
      slowLevel: gasList[1],
      customLevel: gasList[2],
      isNormalEnough: false,
      isSlowEnough: true,
    });
  });
});

describe('token persistence mappers', () => {
  it('parses serialized entity metadata and recomputes usd value', () => {
    expect(
      tokenItemEntityToTokenItem({
        ...tokenItem({ amount: 3, price: 2 }),
        owner_addr: '0xowner',
        cex_ids: '["binance","okx"]',
        launchpad: '{"id":"launch"}',
        asset: '{"id":"asset"}',
      } as any),
    ).toMatchObject({
      usd_value: 6,
      cex_ids: ['binance', 'okx'],
      launchpad: { id: 'launch' },
      asset: { id: 'asset' },
    });
  });

  it('keeps array entity metadata and falls back for empty optional fields', () => {
    expect(
      tokenItemEntityToTokenItem({
        ...tokenItem({ amount: 1, price: 4 }),
        owner_addr: '0xowner',
        cex_ids: ['coinbase'],
        launchpad: undefined,
        asset: undefined,
      } as any),
    ).toMatchObject({
      usd_value: 4,
      cex_ids: ['coinbase'],
      launchpad: undefined,
      asset: undefined,
    });
  });

  it('maps token items with entity identity data to owned database tokens', () => {
    expect(
      tokenItemToITokenItem(
        {
          ...tokenItem({ fdv: 1 }),
          identity: {
            fdv: 999,
          },
        } as TokenItemWithEntity,
        '0xowner',
      ),
    ).toMatchObject({
      owner_addr: '0xowner',
      usd_value: 6,
      fdv: 999,
      cex_ids: [],
    });
  });

  it('maps meme and market tokens into wallet token rows', () => {
    const meme = {
      id: '0xmeme',
      chain: 'base',
      logo_url: 'https://assets.example/meme.png',
      name: 'Meme Token',
      symbol: 'MEME',
    } as MemeItem | TokenMarketTokenItem;

    expect(memeItemToITokenItem(meme, '0xowner')).toMatchObject({
      id: '0xmeme',
      chain: 'base',
      amount: 0,
      decimals: 18,
      display_symbol: 'MEME',
      owner_addr: '0xowner',
      usd_value: 0,
      cex_ids: [],
    });
  });

  it('filters scam-like tokens by manual verification, suspicious, and core tags', () => {
    expect(scamTokenFilter({ is_verified: true, is_core: true })).toBe(true);
    expect(scamTokenFilter({ is_verified: false, is_core: true })).toBe(false);
    expect(scamTokenFilter({ is_suspicious: true, is_core: true })).toBe(false);
    expect(scamTokenFilter({ is_verified: true, is_core: false })).toBe(false);
  });
});
