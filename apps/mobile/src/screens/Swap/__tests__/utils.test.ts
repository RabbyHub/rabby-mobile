import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import { isSwapWrapToken, tokenAmountBn } from '../utils';

const mockNativeEth = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const mockWeth = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const mockBnb = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const mockWbnb = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
const mockUsdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

jest.mock('@debank/common', () => ({
  CHAINS_ENUM: {
    ETH: 'ETH',
    BSC: 'BSC',
  },
  CHAINS: {
    ETH: {
      nativeTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    },
    BSC: {
      nativeTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    },
  },
}));

jest.mock('@rabby-wallet/rabby-swap', () => ({
  WrapTokenAddressMap: {
    ETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    BSC: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
  },
}));

jest.mock('@/utils/chain', () => ({
  findChainByEnum: jest.fn(chain =>
    chain === 'ETH'
      ? {
          nativeTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        }
      : null,
  ),
}));

const token = (params: Partial<TokenItem>): TokenItem =>
  ({
    id: 'token',
    decimals: 18,
    raw_amount_hex_str: '0x0',
    ...params,
  } as TokenItem);

describe('Swap utils', () => {
  describe('tokenAmountBn', () => {
    it('converts raw hex amount using token decimals', () => {
      expect(
        tokenAmountBn(
          token({
            decimals: 18,
            raw_amount_hex_str: '0xde0b6b3a7640000',
          }),
        ).toString(10),
      ).toBe('1');
    });

    it('keeps sub-unit precision for small raw balances', () => {
      expect(
        tokenAmountBn(
          token({
            decimals: 6,
            raw_amount_hex_str: '0x1',
          }),
        ).toString(10),
      ).toBe('0.000001');
    });

    it('treats a missing raw amount as zero', () => {
      expect(
        tokenAmountBn(
          token({
            decimals: 18,
            raw_amount_hex_str: undefined,
          }),
        ).toString(10),
      ).toBe('0');
    });
  });

  describe('isSwapWrapToken', () => {
    it('identifies native-to-wrapped and wrapped-to-native swaps', () => {
      expect(isSwapWrapToken(mockNativeEth, mockWeth, 'ETH' as any)).toBe(true);
      expect(isSwapWrapToken(mockWeth, mockNativeEth, 'ETH' as any)).toBe(true);
    });

    it('falls back to CHAINS native token metadata when chain lookup misses', () => {
      expect(isSwapWrapToken(mockBnb, mockWbnb, 'BSC' as any)).toBe(true);
    });

    it('does not classify the same wrapped token with different address casing as a wrap swap', () => {
      expect(
        isSwapWrapToken(mockWeth, mockWeth.toUpperCase(), 'ETH' as any),
      ).toBe(false);
    });

    it('rejects unrelated tokens and missing token ids', () => {
      expect(isSwapWrapToken(mockUsdc, mockWeth, 'ETH' as any)).toBe(false);
      expect(isSwapWrapToken('', mockWeth, 'ETH' as any)).toBe(false);
      expect(isSwapWrapToken(mockNativeEth, '', 'ETH' as any)).toBe(false);
    });
  });
});
