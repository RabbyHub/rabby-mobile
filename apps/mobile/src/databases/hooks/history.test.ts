jest.mock('@/core/request', () => ({
  openapi: {
    getAllTxHistory: jest.fn(),
    listTxHistory: jest.fn(),
    hasNewTxFrom: jest.fn(),
    getTxCount: jest.fn(),
  },
}));
jest.mock('@/core/serviceApi/transactionHistory', () => ({
  transactionHistoryServiceApi: {
    getIsNeedFetchTxHistory: jest.fn(),
  },
}));
jest.mock('../entities/historyItem', () => ({
  HistoryItemEntity: {
    getLatestTime: jest.fn(),
    countInTimeRange: jest.fn(),
    clear: jest.fn(),
  },
}));
jest.mock('../sync/assets', () => ({
  syncRemoteHistory: jest.fn(),
}));
jest.mock('../imports', () => ({
  prepareAppDataSource: jest.fn(),
}));
jest.mock('@/core/storage/mmkv', () => ({
  MMKVStorageStrategy: { compatJson: 'compatJson' },
  zustandByMMKV: jest.fn((_key: string, initialState: object) => {
    const { create } = jest.requireActual(
      'zustand',
    ) as typeof import('zustand');
    return create(() => initialState);
  }),
}));

import { renderHook, waitFor } from '@testing-library/react-native';

import { openapi } from '@/core/request';
import {
  historyTimeStore,
  historyTxCountCheckStore,
  markHistoryTxCountChecked,
  resetUpdateHistoryTime,
  updateHistoryTimeSingleAddress,
  useHistoryLoading,
} from '@/hooks/historyTokenDict';
import { HistoryItemEntity } from '../entities/historyItem';
import { syncRemoteHistory } from '../sync/assets';
import { syncSingleAddress, syncTop10History } from './history';

const mockedOpenapi = jest.mocked(openapi);
const mockedHistoryItemEntity = jest.mocked(HistoryItemEntity);
const mockedSyncRemoteHistory = jest.mocked(syncRemoteHistory);

const ADDRESS = '0xabcdef0000000000000000000000000000000001';
const CHECKSUM_ADDRESS = '0xABCDEF0000000000000000000000000000000001';

const nowSec = () => Math.floor(Date.now() / 1000);

const makeHistoryResult = (timeAtList: number[]) =>
  ({
    history_list: timeAtList.map((time_at, index) => ({
      id: `0x${index}`,
      chain: 'eth',
      time_at,
      tx: {},
    })),
    project_dict: {},
    token_uuid_dict: {},
    token_dict: {},
    cate_dict: {},
  } as never);

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
};

const readHistoryLoading = (address: string) =>
  renderHook(() => useHistoryLoading()).result.current[address];

describe('transaction history sync', () => {
  let latestTime: number;

  beforeEach(() => {
    jest.clearAllMocks();
    resetUpdateHistoryTime();
    latestTime = nowSec() - 60 * 60;
    mockedHistoryItemEntity.getLatestTime.mockResolvedValue(latestTime);
    mockedSyncRemoteHistory.mockResolvedValue(undefined);
    mockedOpenapi.hasNewTxFrom.mockResolvedValue({ has_new_tx: true } as never);
    mockedOpenapi.listTxHistory.mockResolvedValue(makeHistoryResult([]));
    mockedOpenapi.getAllTxHistory.mockResolvedValue(makeHistoryResult([]));
    // local history matches the server unless a test says otherwise
    mockedOpenapi.getTxCount.mockResolvedValue({
      tx_count: 0,
      has_more: false,
    });
    mockedHistoryItemEntity.countInTimeRange.mockResolvedValue(0);
  });

  it('resolves only after every page has been fetched and handed to the DB writer', async () => {
    const now = nowSec();
    mockedOpenapi.getAllTxHistory
      .mockResolvedValueOnce(makeHistoryResult([now - 10, now - 100]))
      .mockResolvedValueOnce(
        makeHistoryResult([now - 1000, latestTime - 1000]),
      );

    await syncTop10History([ADDRESS], true);

    expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledTimes(2);
    expect(mockedOpenapi.getAllTxHistory.mock.calls[1][0]).toMatchObject({
      id: ADDRESS,
      start_time: now - 100,
    });
    expect(mockedSyncRemoteHistory).toHaveBeenCalledTimes(2);
    // the second page only keeps items newer than the local latest time
    const secondWrite = mockedSyncRemoteHistory.mock.calls[1][1];
    expect(secondWrite.history_list).toHaveLength(1);
  });

  it('replays a forced sync requested while another sync is running', async () => {
    const firstPage = createDeferred<never>();
    mockedOpenapi.getAllTxHistory
      .mockReturnValueOnce(firstPage.promise)
      .mockResolvedValue(makeHistoryResult([]));

    const running = syncTop10History([ADDRESS], false);
    await waitFor(() =>
      expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledTimes(1),
    );

    await syncTop10History([ADDRESS], true);
    expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledTimes(1);

    firstPage.resolve(makeHistoryResult([]));
    await running;

    // the replay goes through the realtime API because the address was just synced
    await waitFor(() =>
      expect(mockedOpenapi.listTxHistory).toHaveBeenCalledWith(
        expect.objectContaining({ id: ADDRESS }),
      ),
    );
  });

  it('uses the realtime API for a recently synced checksum address and waits for the write', async () => {
    updateHistoryTimeSingleAddress(ADDRESS, Date.now() - 60 * 1000);
    mockedOpenapi.listTxHistory.mockResolvedValueOnce(
      makeHistoryResult([nowSec() - 10, latestTime - 1000]),
    );

    await syncSingleAddress(CHECKSUM_ADDRESS);

    expect(mockedOpenapi.getAllTxHistory).not.toHaveBeenCalled();
    expect(mockedOpenapi.listTxHistory).toHaveBeenCalledWith(
      expect.objectContaining({ id: ADDRESS }),
    );
    expect(mockedSyncRemoteHistory).toHaveBeenCalledWith(
      ADDRESS,
      expect.anything(),
    );
  });

  it('resets loading and the sync time when the realtime API fails', async () => {
    updateHistoryTimeSingleAddress(ADDRESS, Date.now() - 60 * 1000);
    mockedOpenapi.listTxHistory.mockRejectedValueOnce(new Error('network'));

    await syncSingleAddress(ADDRESS);

    expect(historyTimeStore.getState()[ADDRESS]).toBe(0);
    expect(readHistoryLoading(ADDRESS)).toBe(false);
  });

  it('resets loading and the sync time when the all-history API fails', async () => {
    mockedOpenapi.getAllTxHistory.mockRejectedValueOnce(new Error('network'));

    await syncSingleAddress(ADDRESS);

    expect(historyTimeStore.getState()[ADDRESS]).toBe(0);
    expect(readHistoryLoading(ADDRESS)).toBe(false);
  });

  describe('daily tx count check', () => {
    const DAY_SEC = 24 * 60 * 60;

    it('re-fetches the last 24 hours when the server has more txs and skips the regular sync', async () => {
      const now = nowSec();
      mockedOpenapi.getTxCount.mockResolvedValue({
        tx_count: 3,
        has_more: false,
      });
      mockedHistoryItemEntity.countInTimeRange.mockResolvedValue(1);
      mockedOpenapi.listTxHistory
        .mockResolvedValueOnce(makeHistoryResult([now - 10, now - 100]))
        .mockResolvedValueOnce(
          makeHistoryResult([now - 2000, now - DAY_SEC - 3600]),
        );

      await syncTop10History([ADDRESS], true);

      const [countParams] = mockedOpenapi.getTxCount.mock.calls[0];
      expect(countParams.id).toBe(ADDRESS);
      expect(countParams.to_ts).toBe(latestTime);
      expect(countParams.from_ts).toBeGreaterThanOrEqual(now - DAY_SEC);
      expect(countParams.from_ts).toBeLessThanOrEqual(nowSec() - DAY_SEC);
      expect(mockedHistoryItemEntity.countInTimeRange).toHaveBeenCalledWith(
        ADDRESS,
        countParams.from_ts,
        countParams.to_ts,
      );

      expect(mockedOpenapi.listTxHistory).toHaveBeenCalledTimes(2);
      expect(mockedOpenapi.listTxHistory.mock.calls[1][0]).toMatchObject({
        id: ADDRESS,
        start_time: now - 100,
      });
      // items older than the window are not written
      expect(
        mockedSyncRemoteHistory.mock.calls.map(
          ([, res]) => res.history_list.length,
        ),
      ).toEqual([2, 1]);
      // the re-fetch already covers everything newer than the local rows
      expect(mockedOpenapi.getAllTxHistory).not.toHaveBeenCalled();
      expect(historyTxCountCheckStore.getState()[ADDRESS]).toBeGreaterThan(0);
    });

    it('keeps the regular sync and checks only once a day when local history is complete', async () => {
      mockedOpenapi.getTxCount.mockResolvedValue({
        tx_count: 2,
        has_more: false,
      });
      mockedHistoryItemEntity.countInTimeRange.mockResolvedValue(2);

      await syncTop10History([ADDRESS], true);
      await syncTop10History([ADDRESS], true);

      expect(mockedOpenapi.getTxCount).toHaveBeenCalledTimes(1);
      // both rounds run the regular sync: the full API first, then the
      // realtime API (hasNewTxFrom + listTxHistory) since the address was just synced
      expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledTimes(1);
      expect(mockedOpenapi.hasNewTxFrom).toHaveBeenCalledTimes(1);
      expect(mockedOpenapi.listTxHistory).toHaveBeenCalledTimes(1);
    });

    it('checks again once 24 hours have passed', async () => {
      historyTxCountCheckStore.setState({
        [ADDRESS]: Date.now() - DAY_SEC * 1000 - 1,
      });

      await syncTop10History([ADDRESS], false);

      expect(mockedOpenapi.getTxCount).toHaveBeenCalledTimes(1);
    });

    it('does not check when there is no local history in the last 24 hours', async () => {
      mockedHistoryItemEntity.getLatestTime.mockResolvedValue(
        nowSec() - DAY_SEC - 60,
      );

      await syncTop10History([ADDRESS], true);

      expect(mockedOpenapi.getTxCount).not.toHaveBeenCalled();
      expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledTimes(1);
      expect(historyTxCountCheckStore.getState()[ADDRESS]).toBeUndefined();
    });

    it('retries on the next sync and still runs the regular sync when the count request fails', async () => {
      mockedOpenapi.getTxCount.mockRejectedValueOnce(new Error('network'));

      await syncTop10History([ADDRESS], true);

      expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledTimes(1);
      expect(historyTxCountCheckStore.getState()[ADDRESS]).toBeUndefined();

      await syncTop10History([ADDRESS], true);

      expect(mockedOpenapi.getTxCount).toHaveBeenCalledTimes(2);
    });

    it('does not sync an address whose check and regular sync are both not due', async () => {
      markHistoryTxCountChecked(ADDRESS);
      updateHistoryTimeSingleAddress(ADDRESS);

      await syncTop10History([ADDRESS], false);

      expect(mockedOpenapi.getTxCount).not.toHaveBeenCalled();
      expect(mockedOpenapi.getAllTxHistory).not.toHaveBeenCalled();
      expect(mockedOpenapi.listTxHistory).not.toHaveBeenCalled();
    });

    it('re-fetches from a single-address sync and skips its regular sync', async () => {
      const now = nowSec();
      mockedOpenapi.getTxCount.mockResolvedValue({
        tx_count: 2,
        has_more: false,
      });
      mockedHistoryItemEntity.countInTimeRange.mockResolvedValue(1);
      mockedOpenapi.listTxHistory.mockResolvedValueOnce(
        makeHistoryResult([now - 10, now - DAY_SEC - 60]),
      );

      await syncSingleAddress(CHECKSUM_ADDRESS);

      expect(mockedOpenapi.getTxCount).toHaveBeenCalledWith(
        expect.objectContaining({ id: ADDRESS }),
      );
      expect(mockedOpenapi.listTxHistory).toHaveBeenCalledTimes(1);
      expect(mockedSyncRemoteHistory).toHaveBeenCalledTimes(1);
      expect(mockedOpenapi.getAllTxHistory).not.toHaveBeenCalled();
      expect(historyTxCountCheckStore.getState()[ADDRESS]).toBeGreaterThan(0);
    });

    it('keeps the single-address regular sync and checks only once a day', async () => {
      await syncSingleAddress(ADDRESS);
      await syncSingleAddress(ADDRESS);

      expect(mockedOpenapi.getTxCount).toHaveBeenCalledTimes(1);
      // first round uses the full API, the second the realtime API
      expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledTimes(1);
      expect(mockedOpenapi.hasNewTxFrom).toHaveBeenCalledTimes(1);
    });

    it('shares one check between concurrent Home and single-address syncs', async () => {
      const txCount = createDeferred<{ tx_count: number; has_more: boolean }>();
      mockedOpenapi.getTxCount.mockReturnValueOnce(txCount.promise);
      mockedHistoryItemEntity.countInTimeRange.mockResolvedValue(1);

      const single = syncSingleAddress(ADDRESS);
      await waitFor(() =>
        expect(mockedOpenapi.getTxCount).toHaveBeenCalledTimes(1),
      );
      const home = syncTop10History([ADDRESS], true);
      // let the Home sync reach its queued check while the first one is pending
      await new Promise(resolve => setTimeout(resolve, 0));

      txCount.resolve({ tx_count: 3, has_more: false });
      await Promise.all([single, home]);

      expect(mockedOpenapi.getTxCount).toHaveBeenCalledTimes(1);
      // one re-fetch (a single empty page), and both callers skip the regular sync
      expect(mockedOpenapi.listTxHistory).toHaveBeenCalledTimes(1);
      expect(mockedOpenapi.getAllTxHistory).not.toHaveBeenCalled();
    });
  });
});
