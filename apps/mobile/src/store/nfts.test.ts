import type { DisplayNftItem } from '@/types/assets';

jest.mock('@/core/apis/account', () => ({
  getTop10MyAccounts: jest.fn(async () => ({ top10Addresses: [] })),
}));
jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));
jest.mock('@/databases/hooks/assets', () => ({
  syncNFTs: jest.fn(),
}));
jest.mock('@/databases/entities/nftItem', () => ({
  NFTItemEntity: {
    batchMultAddressNFTs: jest.fn(async () => []),
  },
}));
jest.mock('@/store/balance', () => ({
  getSelectedBalanceAddressesSnapshot: jest.fn(() => []),
}));
jest.mock('@/core/utils/assetDataLoadDiagnostics', () => ({
  beginAssetDataLoadDiagnostic: jest.fn(() => ({
    fail: jest.fn(),
    finish: jest.fn(),
    mark: jest.fn(),
  })),
}));
jest.mock('./assetProjectionPersistence', () => ({
  restoreAssetProjection: jest.fn(async () => null),
  scheduleAssetProjectionPersistence: jest.fn(),
}));

import { syncNFTs } from '@/databases/hooks/assets';
import nftListStore from './nfts';

const mockedSyncNFTs = jest.mocked(syncNFTs);
const ADDRESS = '0xabc';
const cachedNft = {
  id: 'cached',
  inner_id: 'cached-inner',
  owner_addr: ADDRESS,
  chain: 'eth',
} as DisplayNftItem;

describe('NFT list refresh semantics', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    mockedSyncNFTs.mockReset();
    nftListStore.setState({
      nftsMap: { [ADDRESS]: [cachedNft] },
      isLoading: false,
      isFirstFetch: false,
      shortCache: false,
      singleLoadStatusByAddress: {},
    });
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('clears stale NFTs after a successful empty snapshot', async () => {
    mockedSyncNFTs.mockResolvedValue({ status: 'snapshot', nfts: [] });

    await nftListStore.getState().getNFTList(ADDRESS, true);

    expect(nftListStore.getState().nftsMap[ADDRESS]).toEqual([]);
  });

  it('retains usable NFTs when the source reports no update', async () => {
    mockedSyncNFTs.mockResolvedValue({ status: 'unchanged' });

    await nftListStore.getState().getNFTList(ADDRESS, false);

    expect(nftListStore.getState().nftsMap[ADDRESS]).toEqual([cachedNft]);
  });

  it('retains usable NFTs when refresh fails', async () => {
    mockedSyncNFTs.mockRejectedValue(new Error('network failed'));

    await nftListStore.getState().getNFTList(ADDRESS, true);

    expect(nftListStore.getState().nftsMap[ADDRESS]).toEqual([cachedNft]);
    expect(consoleError).toHaveBeenCalledWith(
      'ServiceErrorType.NFT',
      expect.any(Error),
    );
  });
});
