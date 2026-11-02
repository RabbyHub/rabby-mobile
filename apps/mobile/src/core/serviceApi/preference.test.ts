import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { getLastTimeSendTokenSnapshot } from './preference';

const mockGetRegisteredService = jest.fn();
const mockDeferredRead = jest.fn();

jest.mock('@/core/services/serviceRegistry', () => ({
  getRegisteredService: (...args: unknown[]) =>
    mockGetRegisteredService(...args),
}));
jest.mock('./createDeferredServiceApi', () => ({
  createDeferredServiceApi: () => ({
    getLastTimeSendToken: (...args: unknown[]) => mockDeferredRead(...args),
  }),
}));

describe('last Send token display snapshot', () => {
  beforeEach(() => jest.clearAllMocks());

  it('distinguishes an unready service from an initialized empty history', () => {
    mockGetRegisteredService.mockReturnValue(undefined);
    expect(getLastTimeSendTokenSnapshot('0xabc')).toEqual({
      ready: false,
      token: null,
    });

    mockGetRegisteredService.mockReturnValue({
      getLastTimeSendToken: () => undefined,
    });
    expect(getLastTimeSendTokenSnapshot('0xabc')).toEqual({
      ready: true,
      token: null,
    });
    expect(mockDeferredRead).not.toHaveBeenCalled();
  });

  it('uses the address-scoped cached getter, not a clone of all preferences', () => {
    const token = { chain: 'eth', id: 'eth', symbol: 'ETH' } as TokenItem;
    const getLastTimeSendToken = jest.fn(() => token);
    const getPreference = jest.fn();
    mockGetRegisteredService.mockReturnValue({
      getLastTimeSendToken,
      getPreference,
    });

    const snapshot = getLastTimeSendTokenSnapshot('0xAbC');
    expect(snapshot.ready).toBe(true);
    expect(snapshot.token).toBe(token);
    expect(getLastTimeSendToken).toHaveBeenCalledWith('0xAbC');
    expect(getPreference).not.toHaveBeenCalled();
    expect(mockGetRegisteredService).toHaveBeenCalledWith('preferenceService');
  });
});
