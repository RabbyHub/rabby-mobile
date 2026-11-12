import { CHAINS_ENUM } from '@debank/common';
import { getSwapGasReserveGasLimit } from './utils';

jest.mock('@debank/common', () => ({
  CHAINS_ENUM: { ETH: 'ETH', BSC: 'BSC' },
  CHAINS: {},
}));
jest.mock('@rabby-wallet/rabby-swap', () => ({ isSwapWrapToken: jest.fn() }));
jest.mock('@/utils/chain', () => ({ findChainByEnum: jest.fn() }));

describe('getSwapGasReserveGasLimit', () => {
  it('reserves 1M gas on Ethereum and 2M elsewhere', () => {
    expect(getSwapGasReserveGasLimit(CHAINS_ENUM.ETH)).toBe(1000000);
    expect(getSwapGasReserveGasLimit(CHAINS_ENUM.BSC)).toBe(2000000);
  });
});
