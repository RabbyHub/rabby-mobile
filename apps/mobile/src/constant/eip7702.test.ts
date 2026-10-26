import { CHAINS_ENUM } from '@debank/common';

import { getEIP7702RevokeSupportedChains } from './eip7702';

jest.mock('@debank/common', () => ({
  CHAINS_ENUM: {
    ETH: 'ETH',
    BSC: 'BSC',
    OP: 'OP',
    BASE: 'BASE',
    ARBITRUM: 'ARBITRUM',
    SCRL: 'SCRL',
    POLYGON: 'POLYGON',
  },
}));

describe('getEIP7702RevokeSupportedChains', () => {
  it('filters candidates from the current chain list on every call', () => {
    expect(
      getEIP7702RevokeSupportedChains([{ enum: CHAINS_ENUM.ETH }]),
    ).toEqual([CHAINS_ENUM.ETH]);
    expect(
      getEIP7702RevokeSupportedChains([{ enum: CHAINS_ENUM.BSC }]),
    ).toEqual([CHAINS_ENUM.BSC]);
  });
});
