import { renderHook, waitFor } from '@testing-library/react-native';

import { openapi } from '@/core/request';
import { getCexId } from '@/utils/addressCexId';
import {
  getCexInfo,
  globalSupportCexList,
  useCexSupportList,
} from './useCexSupportList';

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

const expectedSupportList = [
  {
    id: 'binance',
    name: 'Binance',
    logo_url: 'https://example.com/binance.png',
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    logo_url: 'https://example.com/coinbase.png',
  },
];

jest.mock('@/core/request', () => ({
  openapi: {
    getCexSupportList: jest.fn(() =>
      Promise.resolve([
        {
          id: 'binance',
          name: 'Binance',
          logo_url: 'https://example.com/binance.png',
        },
        {
          id: 'coinbase',
          name: 'Coinbase',
          logo_url: 'https://example.com/coinbase.png',
        },
      ]),
    ),
  },
}));

jest.mock('@/utils/addressCexId', () => ({
  getCexId: jest.fn(),
}));

const getCexSupportList = openapi.getCexSupportList as jest.Mock;
const getCexIdMock = getCexId as jest.Mock;

describe('useCexSupportList', () => {
  beforeEach(() => {
    getCexIdMock.mockReset();
  });

  it('hydrates the hook store from openapi once the module side effect resolves', async () => {
    const { result } = renderHook(() => useCexSupportList());

    await waitFor(() => {
      expect(result.current.list).toEqual(expectedSupportList);
    });
    expect(getCexSupportList).toHaveBeenCalledTimes(1);
    expect(globalSupportCexList).toEqual(expectedSupportList);
  });

  it('resolves cex display info from cached support list and stored address mapping', async () => {
    renderHook(() => useCexSupportList());

    await waitFor(() => {
      expect(globalSupportCexList.length).toBeGreaterThan(0);
    });

    getCexIdMock.mockReturnValue('coinbase');
    expect(getCexInfo('0xABC')).toEqual({
      id: 'coinbase',
      name: 'Coinbase',
      logo: 'https://example.com/coinbase.png',
    });
    expect(getCexIdMock).toHaveBeenCalledWith('0xABC');

    getCexIdMock.mockReturnValue('missing');
    expect(getCexInfo('0xABC')).toBeUndefined();
    expect(getCexInfo('')).toBeUndefined();
  });
});
