jest.mock('@/core/request', () => ({
  openapi: {
    collectionList: jest.fn(),
    listNFT: jest.fn(),
  },
}));
jest.mock('@/databases/entities/nftItem', () => ({
  NFTItemEntity: {
    batchQueryNFTs: jest.fn(),
    isExpired: jest.fn(),
  },
}));
jest.mock('@/databases/sync/assets', () => ({
  syncRemoteNFTs: jest.fn(),
}));
jest.mock('@/utils/collections', () => ({
  isValidCollection: jest.fn(() => true),
}));

import { openapi } from '@/core/request';
import { NFTItemEntity } from '@/databases/entities/nftItem';
import { syncRemoteNFTs } from '@/databases/sync/assets';
import { batchQueryNFTSnapshotWithLocalCache } from './nft';

const mockedOpenapi = jest.mocked(openapi);
const mockedNftEntity = jest.mocked(NFTItemEntity);
const mockedSyncRemoteNFTs = jest.mocked(syncRemoteNFTs);

describe('NFT snapshot loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publishes a successful empty remote result as an empty snapshot', async () => {
    mockedNftEntity.isExpired.mockResolvedValue(true);
    mockedOpenapi.listNFT.mockResolvedValue([]);
    mockedOpenapi.collectionList.mockResolvedValue([]);

    await expect(
      batchQueryNFTSnapshotWithLocalCache(
        { id: '0xabc', isAll: true, sortByCredit: true },
        false,
        true,
      ),
    ).resolves.toEqual({ status: 'snapshot', nfts: [] });
    expect(mockedSyncRemoteNFTs).toHaveBeenCalledWith('0xabc', []);
  });

  it('reports an unchanged result when a fresh cache needs no publication', async () => {
    mockedNftEntity.isExpired.mockResolvedValue(false);

    await expect(
      batchQueryNFTSnapshotWithLocalCache(
        { id: '0xabc', isAll: true, sortByCredit: true },
        false,
        true,
      ),
    ).resolves.toEqual({ status: 'unchanged' });
    expect(mockedNftEntity.batchQueryNFTs).not.toHaveBeenCalled();
    expect(mockedOpenapi.listNFT).not.toHaveBeenCalled();
  });

  it('returns a fresh cached snapshot when the caller needs a value', async () => {
    const cachedNfts = [{ id: 'cached' }];
    mockedNftEntity.isExpired.mockResolvedValue(false);
    mockedNftEntity.batchQueryNFTs.mockResolvedValue(cachedNfts as never);

    await expect(
      batchQueryNFTSnapshotWithLocalCache(
        { id: '0xabc', isAll: true, sortByCredit: true },
        false,
        false,
      ),
    ).resolves.toEqual({ status: 'snapshot', nfts: cachedNfts });
  });

  it('does not disguise a failed remote request as an empty snapshot', async () => {
    mockedNftEntity.isExpired.mockResolvedValue(true);
    mockedOpenapi.listNFT.mockRejectedValue(new Error('network failed'));

    await expect(
      batchQueryNFTSnapshotWithLocalCache(
        { id: '0xabc', isAll: true, sortByCredit: true },
        false,
        true,
      ),
    ).rejects.toThrow('network failed');
    expect(mockedSyncRemoteNFTs).not.toHaveBeenCalled();
  });

  it('lets a caller reject remote work before network requests start', async () => {
    mockedNftEntity.isExpired.mockResolvedValue(true);
    const beforeRemote = jest.fn(() => false);

    await expect(
      batchQueryNFTSnapshotWithLocalCache(
        { id: '0xabc', isAll: true, sortByCredit: true },
        false,
        true,
        { beforeRemote },
      ),
    ).resolves.toEqual({ status: 'superseded' });
    expect(beforeRemote).toHaveBeenCalledTimes(1);
    expect(mockedOpenapi.listNFT).not.toHaveBeenCalled();
    expect(mockedOpenapi.collectionList).not.toHaveBeenCalled();
  });

  it('returns remote data without persisting when commit is deferred', async () => {
    const remoteNft = { id: 'remote' };
    mockedNftEntity.isExpired.mockResolvedValue(true);
    mockedOpenapi.listNFT.mockResolvedValue([remoteNft] as never);
    mockedOpenapi.collectionList.mockResolvedValue([]);

    const result = await batchQueryNFTSnapshotWithLocalCache(
      { id: '0xabc', isAll: true, sortByCredit: true },
      false,
      true,
      { deferPersistence: true },
    );

    expect(result.status).toBe('snapshot');
    if (result.status !== 'snapshot') {
      throw new Error('Expected an NFT snapshot');
    }
    expect(result.remoteNfts).toEqual(result.nfts);
    expect(result.nfts).toEqual([
      expect.objectContaining({ id: remoteNft.id }),
    ]);
    expect(mockedSyncRemoteNFTs).not.toHaveBeenCalled();
  });
});
