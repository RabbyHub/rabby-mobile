import 'reflect-metadata';

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
jest.mock('@/databases/sync/utils', () => ({}));

import providerController from './provider';
import type { ProviderRequest } from './type';

describe.each(['ethSignTypedDataV3', 'ethSignTypedDataV4'])(
  '%s approval validation',
  method => {
    const [approval, validate] = Reflect.getMetadata(
      'APPROVAL',
      providerController,
      method,
    ) as [string, (request: ProviderRequest) => void];
    const address = '0x1111111111111111111111111111111111111111';
    const request = (type: string, value: unknown): ProviderRequest => ({
      data: {
        method,
        params: [
          address,
          JSON.stringify({
            types: { EIP712Domain: [], Message: [{ name: 'value', type }] },
            primaryType: 'Message',
            domain: {},
            message: { value },
          }),
        ],
      },
      session: { origin: 'https://example.test', name: 'Test', icon: '' },
      account: { address, type: 'Simple Key Pair', brandName: 'Rabby' },
    });

    it.each([
      ['string', 123],
      ['address', '123'],
    ])(
      'rejects mismatched %s values before signing approval',
      (type, value) => {
        expect(approval).toBe('SignTypedData');
        expect(() => validate(request(type, value))).toThrow(
          expect.objectContaining({
            code: -32602,
            message: 'invalid typed data',
          }),
        );
      },
    );
  },
);
