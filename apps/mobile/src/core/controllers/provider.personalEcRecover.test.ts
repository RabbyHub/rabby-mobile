import 'reflect-metadata';

import { personalSign } from '@metamask/eth-sig-util';

// Import-time stubs only: these modules pull in native code or the network,
// and personalEcRecover touches none of them.
jest.mock('@/constant/chains', () => ({
  CHAINS_ENUM: {},
  getChainList: jest.fn(() => []),
  getMainnetChainList: jest.fn(() => []),
  getTestnetChainList: jest.fn(() => []),
}));
jest.mock('@/constant', () => ({}));
jest.mock('../request', () => ({ openapi: {} }));
jest.mock('@/core/serviceApi/customTestnet', () => ({}));
jest.mock('@/utils/transaction', () => ({}));
jest.mock('@/utils/events', () => ({ eventBus: {}, EVENTS: {} }));
jest.mock('@/utils/stats', () => ({ stats: {} }));
jest.mock('@/utils/analytics', () => ({}));
jest.mock('@/databases/sync/utils', () => ({}));

import providerController from './provider';

// Well-known public test key (0x…01); never holds funds.
const TEST_PRIVATE_KEY = Buffer.from(`${'0'.repeat(63)}1`, 'hex');
const TEST_ADDRESS = '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf';
// Same message MetaMask test-dapp uses for its Personal Sign section.
const MESSAGE = `0x${Buffer.from(
  'Example `personal_sign` message',
  'utf8',
).toString('hex')}`;

describe('provider.personalEcRecover', () => {
  it('recovers the signer of a personal_sign signature', () => {
    const signature = personalSign({
      privateKey: TEST_PRIVATE_KEY,
      data: MESSAGE,
    });

    expect(
      providerController.personalEcRecover({
        data: { params: [MESSAGE, signature] },
      }),
    ).toBe(TEST_ADDRESS);
  });
});
