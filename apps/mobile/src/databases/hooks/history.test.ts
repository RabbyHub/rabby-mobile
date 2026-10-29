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
    getLatestTimeByOwner: jest.fn(),
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
  historySyncCoverageMetaStore,
  historySyncCoverageStore,
  historyTimeStore,
  historyTxCountCheckStore,
  markHistoryTxCountChecked,
  resetUpdateHistoryTime,
  setHistorySyncCoverage,
  updateHistoryTimeSingleAddress,
  useHistoryLoading,
} from '@/hooks/historyTokenDict';
import { HistoryItemEntity } from '../entities/historyItem';
import { syncRemoteHistory } from '../sync/assets';
import {
  syncMultiAddressesHistory,
  syncSingleAddress,
  syncTop10History,
} from './history';

const mockedOpenapi = jest.mocked(openapi);
const mockedHistoryItemEntity = jest.mocked(HistoryItemEntity);
const mockedSyncRemoteHistory = jest.mocked(syncRemoteHistory);

const ADDRESS = '0xabcdef0000000000000000000000000000000001';
const CHECKSUM_ADDRESS = '0xABCDEF0000000000000000000000000000000001';

const DAY_SEC = 24 * 60 * 60;
const WINDOW_SEC = 90 * DAY_SEC;

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

const readCoverage = () => historySyncCoverageStore.getState()[ADDRESS];

/** local history is complete over the 90-day window, up to `to` */
const seedCoverage = (to: number) => {
  setHistorySyncCoverage(ADDRESS, { from: nowSec() - WINDOW_SEC, to });
};

const writtenTimes = () =>
  mockedSyncRemoteHistory.mock.calls.map(([, res]) =>
    res.history_list.map(item => item.time_at),
  );

describe('transaction history sync', () => {
  let latestTime: number;

  beforeEach(() => {
    jest.clearAllMocks();
    resetUpdateHistoryTime();
    latestTime = nowSec() - 60 * 60;
    mockedHistoryItemEntity.getLatestTime.mockResolvedValue(latestTime);
    // history from before coverage records is handled by its own tests
    historySyncCoverageMetaStore.setState({ legacySeeded: true });
    mockedHistoryItemEntity.getLatestTimeByOwner.mockResolvedValue({});
    seedCoverage(latestTime);
    mockedSyncRemoteHistory.mockResolvedValue(true);
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
    // the second page only keeps items newer than the synced range
    expect(writtenTimes()).toEqual([[now - 10, now - 100], [now - 1000]]);
    // the complete range now ends at the newest written tx
    expect(readCoverage()?.to).toBe(now - 10);
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

  describe('sync time', () => {
    it('is recorded only after every page is in the DB', async () => {
      const write = createDeferred<boolean>();
      mockedOpenapi.getAllTxHistory.mockResolvedValueOnce(
        makeHistoryResult([nowSec() - 10, latestTime - 1000]),
      );
      mockedSyncRemoteHistory.mockReturnValueOnce(write.promise);

      const running = syncSingleAddress(ADDRESS);
      await waitFor(() =>
        expect(mockedSyncRemoteHistory).toHaveBeenCalledTimes(1),
      );
      expect(historyTimeStore.getState()[ADDRESS]).toBeUndefined();

      write.resolve(true);
      await running;

      expect(historyTimeStore.getState()[ADDRESS]).toBeGreaterThan(0);
    });

    it('keeps the synced range when a page is not written, so the next sync fills the gap', async () => {
      const now = nowSec();
      const pages = () =>
        mockedOpenapi.getAllTxHistory
          .mockResolvedValueOnce(makeHistoryResult([now - 10, now - 100]))
          .mockResolvedValueOnce(
            makeHistoryResult([now - 1000, latestTime - 1000]),
          );
      pages();
      // the newest page lands, the older one is aborted
      mockedSyncRemoteHistory
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await syncTop10History([ADDRESS], true);

      expect(historyTimeStore.getState()[ADDRESS]).toBe(0);
      expect(readCoverage()?.to).toBe(latestTime);
      expect(readHistoryLoading(ADDRESS)).toBe(false);

      // the newest local row is past the gap now, but the next sync starts
      // over from the synced range
      mockedHistoryItemEntity.getLatestTime.mockResolvedValue(now - 10);
      mockedSyncRemoteHistory.mockClear();
      pages();

      await syncTop10History([ADDRESS], true);

      expect(writtenTimes()).toEqual([[now - 10, now - 100], [now - 1000]]);
      expect(readCoverage()?.to).toBe(now - 10);
      expect(historyTimeStore.getState()[ADDRESS]).toBeGreaterThan(0);
    });

    it('shares one run between concurrent syncs of an address', async () => {
      const page = createDeferred<never>();
      mockedOpenapi.getAllTxHistory.mockReturnValueOnce(page.promise);
      markHistoryTxCountChecked(ADDRESS);

      const single = syncSingleAddress(ADDRESS);
      await waitFor(() =>
        expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledTimes(1),
      );
      const imported = syncMultiAddressesHistory([CHECKSUM_ADDRESS]);
      await new Promise(resolve => setTimeout(resolve, 0));

      page.resolve(makeHistoryResult([]));
      await Promise.all([single, imported]);

      expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledTimes(1);
    });

    it('still fetches for a sync that joins a Home round only checking the count', async () => {
      // the Home round's regular sync is not due, only its daily count check
      updateHistoryTimeSingleAddress(ADDRESS, Date.now() - 60 * 1000);
      const txCount = createDeferred<{ tx_count: number; has_more: boolean }>();
      mockedOpenapi.getTxCount.mockReturnValueOnce(txCount.promise);

      const home = syncTop10History([ADDRESS], false);
      await waitFor(() =>
        expect(mockedOpenapi.getTxCount).toHaveBeenCalledTimes(1),
      );
      const single = syncSingleAddress(ADDRESS);

      // local history matches the server, so the check itself fetches nothing
      txCount.resolve({ tx_count: 0, has_more: false });
      await Promise.all([home, single]);

      expect(mockedOpenapi.getTxCount).toHaveBeenCalledTimes(1);
      expect(mockedOpenapi.hasNewTxFrom).toHaveBeenCalledTimes(1);
      expect(mockedOpenapi.listTxHistory).toHaveBeenCalledWith(
        expect.objectContaining({ id: ADDRESS }),
      );
    });

    it('still checks the count for a sync that joins a run without the check', async () => {
      const page = createDeferred<never>();
      mockedOpenapi.getAllTxHistory.mockReturnValueOnce(page.promise);

      const imported = syncMultiAddressesHistory([ADDRESS]);
      await waitFor(() =>
        expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledTimes(1),
      );
      const single = syncSingleAddress(ADDRESS);

      page.resolve(makeHistoryResult([]));
      await Promise.all([imported, single]);

      expect(mockedOpenapi.getTxCount).toHaveBeenCalledTimes(1);
      // the import already fetched, so only the check runs after it
      expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledTimes(1);
      expect(mockedOpenapi.hasNewTxFrom).not.toHaveBeenCalled();
    });
  });

  describe('90-day completeness check', () => {
    it('backfills the whole window for rows whose backfill did not finish', async () => {
      // local rows without a record after the one-time legacy seed
      setHistorySyncCoverage(ADDRESS, null);
      const now = nowSec();
      mockedOpenapi.getAllTxHistory.mockResolvedValueOnce(
        makeHistoryResult([
          now - 10,
          now - 40 * DAY_SEC,
          now - 80 * DAY_SEC,
          now - 100 * DAY_SEC,
        ]),
      );

      await syncTop10History([ADDRESS], true);

      expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledTimes(1);
      expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledWith({
        id: ADDRESS,
        start_time: 0,
        page_count: 2000,
      });
      expect(writtenTimes()).toEqual([
        [now - 10, now - 40 * DAY_SEC, now - 80 * DAY_SEC],
      ]);
      expect(readCoverage()?.from).toBeGreaterThanOrEqual(now - WINDOW_SEC);
      expect(readCoverage()?.from).toBeLessThanOrEqual(nowSec() - WINDOW_SEC);
      expect(readCoverage()?.to).toBe(now - 10);
      expect(historyTimeStore.getState()[ADDRESS]).toBeGreaterThan(0);
      expect(readHistoryLoading(ADDRESS)).toBe(false);
      // the backfill replaces this round's count check
      expect(mockedOpenapi.getTxCount).not.toHaveBeenCalled();
    });

    it('backfills an empty DB in full even when the address synced recently', async () => {
      // the sync time survived, the rows did not: this used to fetch only 30 days
      historySyncCoverageMetaStore.setState({ legacySeeded: false });
      setHistorySyncCoverage(ADDRESS, null);
      mockedHistoryItemEntity.getLatestTime.mockResolvedValue(0);
      updateHistoryTimeSingleAddress(ADDRESS, Date.now() - 60 * 60 * 1000);
      const now = nowSec();
      mockedOpenapi.getAllTxHistory
        .mockResolvedValueOnce(
          makeHistoryResult([now - 10, now - 30 * DAY_SEC]),
        )
        .mockResolvedValueOnce(
          makeHistoryResult([now - 60 * DAY_SEC, now - 95 * DAY_SEC]),
        );

      await syncSingleAddress(ADDRESS);

      expect(mockedOpenapi.hasNewTxFrom).not.toHaveBeenCalled();
      expect(mockedOpenapi.listTxHistory).not.toHaveBeenCalled();
      expect(mockedOpenapi.getAllTxHistory.mock.calls[1][0]).toMatchObject({
        start_time: now - 30 * DAY_SEC,
      });
      expect(writtenTimes()).toEqual([
        [now - 10, now - 30 * DAY_SEC],
        [now - 60 * DAY_SEC],
      ]);
    });

    it('backfills again once rows the synced range vouches for are gone', async () => {
      // e.g. the DB was reset outside the sync
      mockedHistoryItemEntity.getLatestTime.mockResolvedValue(0);

      await syncTop10History([ADDRESS], true);

      expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledWith({
        id: ADDRESS,
        start_time: 0,
        page_count: 2000,
      });
      // the server has nothing, so the range is empty but complete
      expect(readCoverage()?.to).toBe(readCoverage()?.from);
    });

    it('keeps the range of an address without txs and checks from its start', async () => {
      const from = nowSec() - WINDOW_SEC + 60;
      setHistorySyncCoverage(ADDRESS, { from, to: from });
      mockedHistoryItemEntity.getLatestTime.mockResolvedValue(0);
      updateHistoryTimeSingleAddress(ADDRESS, Date.now() - 60 * 60 * 1000);
      markHistoryTxCountChecked(ADDRESS);

      await syncSingleAddress(ADDRESS);

      expect(mockedOpenapi.hasNewTxFrom).toHaveBeenCalledWith({
        address: ADDRESS,
        startTime: from,
      });
      expect(mockedOpenapi.getAllTxHistory).not.toHaveBeenCalled();
    });

    it('drops the range when a sync cannot reach it, so the next sync backfills', async () => {
      const now = nowSec();
      // every page is still newer than the synced range
      mockedOpenapi.getAllTxHistory.mockResolvedValue(
        makeHistoryResult([now - 10, now - 20]),
      );

      await syncTop10History([ADDRESS], true);

      expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledTimes(5);
      expect(readCoverage()).toBeUndefined();

      mockedOpenapi.getAllTxHistory.mockClear();
      mockedOpenapi.getAllTxHistory.mockResolvedValue(makeHistoryResult([]));

      await syncTop10History([ADDRESS], true);

      expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledWith({
        id: ADDRESS,
        start_time: 0,
        page_count: 2000,
      });
      expect(readCoverage()).toBeDefined();
    });

    it('finishes with the all-history API when the realtime pages run out', async () => {
      updateHistoryTimeSingleAddress(ADDRESS, Date.now() - 60 * 1000);
      markHistoryTxCountChecked(ADDRESS);
      const now = nowSec();
      mockedOpenapi.listTxHistory.mockResolvedValue(
        makeHistoryResult([now - 10, now - 20]),
      );
      mockedOpenapi.getAllTxHistory.mockResolvedValueOnce(
        makeHistoryResult([now - 10, latestTime - 1]),
      );

      await syncSingleAddress(ADDRESS);

      expect(mockedOpenapi.listTxHistory).toHaveBeenCalledTimes(25);
      expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledTimes(1);
      expect(readCoverage()?.to).toBe(now - 10);
    });

    it('restarts the range at the window after a pause longer than the window', async () => {
      const oldTo = nowSec() - 100 * DAY_SEC;
      setHistorySyncCoverage(ADDRESS, { from: oldTo - WINDOW_SEC, to: oldTo });
      mockedHistoryItemEntity.getLatestTime.mockResolvedValue(oldTo);
      const now = nowSec();
      mockedOpenapi.getAllTxHistory.mockResolvedValueOnce(
        makeHistoryResult([now - 10, now - 95 * DAY_SEC]),
      );

      await syncTop10History([ADDRESS], true);

      expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledWith({
        id: ADDRESS,
        start_time: 0,
        page_count: 2000,
      });
      expect(writtenTimes()).toEqual([[now - 10]]);
      expect(readCoverage()?.from).toBeGreaterThanOrEqual(now - WINDOW_SEC);
      expect(readCoverage()?.to).toBe(now - 10);
    });

    it('keeps the restarted range valid when the window holds no new txs', async () => {
      const oldTo = nowSec() - 100 * DAY_SEC;
      setHistorySyncCoverage(ADDRESS, { from: oldTo - WINDOW_SEC, to: oldTo });
      mockedHistoryItemEntity.getLatestTime.mockResolvedValue(oldTo);

      await syncTop10History([ADDRESS], true);

      const coverage = readCoverage();
      expect(coverage?.from).toBeGreaterThan(oldTo);
      expect(coverage?.to).toBe(coverage?.from);
    });
  });

  describe('history from before coverage records', () => {
    beforeEach(() => {
      historySyncCoverageMetaStore.setState({ legacySeeded: false });
      setHistorySyncCoverage(ADDRESS, null);
    });

    it('is trusted as complete instead of backfilled', async () => {
      mockedHistoryItemEntity.getLatestTimeByOwner.mockResolvedValue({
        [ADDRESS]: latestTime,
      });

      await syncTop10History([ADDRESS], true);

      // a regular incremental sync from the newest local row, no backfill
      expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledTimes(1);
      expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledWith({
        id: ADDRESS,
        start_time: 0,
        page_count: 500,
      });
      expect(readCoverage()?.from).toBeLessThanOrEqual(nowSec() - WINDOW_SEC);
      expect(readCoverage()?.to).toBe(latestTime);
      expect(historySyncCoverageMetaStore.getState().legacySeeded).toBe(true);
    });

    it('starts the range of an address idle for longer than the window at the window', async () => {
      const staleTime = nowSec() - 100 * DAY_SEC;
      mockedHistoryItemEntity.getLatestTime.mockResolvedValue(staleTime);
      mockedHistoryItemEntity.getLatestTimeByOwner.mockResolvedValue({
        [ADDRESS]: staleTime,
      });
      markHistoryTxCountChecked(ADDRESS);

      await syncSingleAddress(ADDRESS);

      expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledWith({
        id: ADDRESS,
        start_time: 0,
        page_count: 2000,
      });
      const coverage = readCoverage();
      expect(coverage?.from).toBeGreaterThan(staleTime);
      expect(coverage?.to).toBe(coverage?.from);
    });

    it('is read once, before any sync writes', async () => {
      const latestTimes = createDeferred<Record<string, number>>();
      mockedHistoryItemEntity.getLatestTimeByOwner.mockReturnValueOnce(
        latestTimes.promise,
      );
      const OTHER_ADDRESS = '0xabcdef0000000000000000000000000000000002';

      const single = syncSingleAddress(ADDRESS);
      const imported = syncMultiAddressesHistory([OTHER_ADDRESS]);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockedSyncRemoteHistory).not.toHaveBeenCalled();

      latestTimes.resolve({ [ADDRESS]: latestTime });
      await Promise.all([single, imported]);
      await syncSingleAddress(ADDRESS);

      expect(
        mockedHistoryItemEntity.getLatestTimeByOwner,
      ).toHaveBeenCalledTimes(1);
      // the address with rows keeps them, the other one has none and backfills
      expect(readCoverage()?.to).toBe(latestTime);
      expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledWith({
        id: OTHER_ADDRESS,
        start_time: 0,
        page_count: 2000,
      });
    });

    it('retries the seed on the next sync when reading the DB fails', async () => {
      mockedHistoryItemEntity.getLatestTimeByOwner
        .mockRejectedValueOnce(new Error('db'))
        .mockResolvedValueOnce({ [ADDRESS]: latestTime });

      await syncSingleAddress(ADDRESS);

      expect(mockedOpenapi.getAllTxHistory).not.toHaveBeenCalled();
      expect(historySyncCoverageMetaStore.getState().legacySeeded).toBe(false);

      await syncSingleAddress(ADDRESS);

      expect(historySyncCoverageMetaStore.getState().legacySeeded).toBe(true);
      expect(readCoverage()?.to).toBe(latestTime);
    });
  });

  describe('daily tx count check', () => {
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
      // the server's to_ts is exclusive, so the newest local row needs +1
      expect(countParams.to_ts).toBe(latestTime + 1);
      expect(countParams.from_ts).toBeGreaterThanOrEqual(now - DAY_SEC);
      expect(countParams.from_ts).toBeLessThanOrEqual(nowSec() - DAY_SEC);
      expect(mockedHistoryItemEntity.countInTimeRange).toHaveBeenCalledWith(
        ADDRESS,
        countParams.from_ts,
        latestTime,
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
      const staleTime = nowSec() - DAY_SEC - 60;
      mockedHistoryItemEntity.getLatestTime.mockResolvedValue(staleTime);
      seedCoverage(staleTime);

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
