import { renderHook } from '@testing-library/react-native';
import { getChainListFromAtom, useFindChain } from './useFindChain';

const mockFindChain = jest.fn();
const mockUseChainList = jest.fn();
const mockJotaiStoreGet = jest.fn();

jest.mock('@/constant/chains', () => ({
  getChainList: (tab: 'mainnet' | 'testnet') =>
    tab === 'mainnet'
      ? [{ enum: 'ETH', serverId: 'eth' }]
      : [{ enum: 'GOERLI', serverId: 'goerli' }],
}));

jest.mock('@/utils/chain', () => ({
  findChain: (...args: unknown[]) => mockFindChain(...args),
}));

jest.mock('./useChainList', () => ({
  useChainList: () => mockUseChainList(),
}));

jest.mock('@/core/utils/reexports', () => ({
  jotaiStore: {
    get: (...args: unknown[]) => mockJotaiStoreGet(...args),
  },
}));

describe('useFindChain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads the atom snapshot through jotaiStore', () => {
    mockJotaiStoreGet.mockReturnValue({
      mainnetList: [{ enum: 'ETH', serverId: 'eth' }],
      testnetList: [{ enum: 'GOERLI', serverId: 'goerli' }],
    });

    expect(getChainListFromAtom()).toEqual({
      mainnetList: [{ enum: 'ETH', serverId: 'eth' }],
      testnetList: [{ enum: 'GOERLI', serverId: 'goerli' }],
    });
    expect(mockJotaiStoreGet).toHaveBeenCalledTimes(1);
  });

  it('delegates to findChain with the merged mainnet and testnet lists', () => {
    mockUseChainList.mockReturnValue({
      mainnetList: [{ enum: 'ETH', serverId: 'eth' }],
      testnetList: [{ enum: 'GOERLI', serverId: 'goerli' }],
    });
    mockFindChain.mockReturnValue({
      enum: 'ETH',
      serverId: 'eth',
    });

    const { result } = renderHook(() =>
      useFindChain({
        enum: 'ETH',
      } as any),
    );

    expect(mockFindChain).toHaveBeenCalledWith(
      {
        id: undefined,
        serverId: undefined,
        enum: 'ETH',
        hex: undefined,
        networkId: undefined,
      },
      [
        { enum: 'ETH', serverId: 'eth' },
        { enum: 'GOERLI', serverId: 'goerli' },
      ],
    );
    expect(result.current).toEqual({
      enum: 'ETH',
      serverId: 'eth',
    });
  });
});
