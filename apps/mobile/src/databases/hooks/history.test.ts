jest.mock('@/core/request', () => ({
  openapi: {
    getAllTxHistory: jest.fn(),
    hasNewTxFrom: jest.fn(),
    listTxHisotry: jest.fn(),
  },
}));

jest.mock('../entities/historyItem', () => ({
  HistoryItemEntity: {
    clear: jest.fn(),
    getLatestTime: jest.fn(),
  },
}));

jest.mock('../sync/assets', () => ({
  syncRemoteHistory: jest.fn(),
}));

jest.mock('@/core/serviceApi/transactionHistory', () => ({
  transactionHistoryServiceApi: {
    getIsNeedFetchTxHistory: jest.fn(),
  },
}));

jest.mock('@/hooks/historyTokenDict', () => ({
  historyTimeStore: Object.assign(jest.fn(), {
    getState: jest.fn(() => ({})),
  }),
  setHistoryLoading: jest.fn(),
  updateHistoryTimeSingleAddress: jest.fn(),
}));

jest.mock('../imports', () => ({
  prepareAppDataSource: jest.fn(),
}));

import type { TxHistoryResult } from '@rabby-wallet/rabby-api/dist/types';
import { openapi } from '@/core/request';
import {
  setHistoryLoading,
  updateHistoryTimeSingleAddress,
} from '@/hooks/historyTokenDict';
import { HistoryItemEntity } from '../entities/historyItem';
import { syncRemoteHistory } from '../sync/assets';
import { getRealtimeApiLatestTime, syncUserAllHistory } from './history';

const ADDRESS = '0x0000000000000000000000000000000000000001';

const makeHistoryResult = (times: number[]) =>
  ({
    cate_dict: {},
    history_list: times.map(time_at => ({ time_at })),
    project_dict: {},
    token_dict: {},
  } as unknown as TxHistoryResult);

const mockedOpenapi = jest.mocked(openapi);
const mockedGetLatestTime = jest.mocked(HistoryItemEntity.getLatestTime);
const mockedSyncRemoteHistory = jest.mocked(syncRemoteHistory);
const mockedSetHistoryLoading = jest.mocked(setHistoryLoading);
const mockedUpdateHistoryTime = jest.mocked(updateHistoryTimeSingleAddress);

describe('history database sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(10_100 * 1000);
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'debug').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    mockedSyncRemoteHistory.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses a 20-minute overlap for realtime reconciliation', () => {
    expect(getRealtimeApiLatestTime(10_000)).toBe(8_800);
    expect(getRealtimeApiLatestTime(1_000)).toBe(0);
    expect(getRealtimeApiLatestTime(0)).toBe(0);
  });

  it('reconciles with paginated realtime history even when the new-tx probe is false', async () => {
    mockedGetLatestTime.mockResolvedValue(10_000);
    mockedOpenapi.hasNewTxFrom.mockResolvedValue({ has_new_tx: false });
    mockedOpenapi.listTxHisotry
      .mockResolvedValueOnce(
        makeHistoryResult(Array.from({ length: 20 }, (_, i) => 10_000 - i)),
      )
      .mockResolvedValueOnce(makeHistoryResult([8_799]));

    await syncUserAllHistory(ADDRESS);

    expect(mockedOpenapi.getAllTxHistory).not.toHaveBeenCalled();
    expect(mockedOpenapi.listTxHisotry).toHaveBeenNthCalledWith(1, {
      id: ADDRESS,
      start_time: 0,
      page_count: 20,
    });
    expect(mockedOpenapi.listTxHisotry).toHaveBeenNthCalledWith(2, {
      id: ADDRESS,
      start_time: 9_981,
      page_count: 20,
    });
    expect(mockedSyncRemoteHistory).toHaveBeenCalledTimes(2);
  });

  it('reconciles the newest window after an all-history update', async () => {
    mockedGetLatestTime
      .mockResolvedValueOnce(10_000)
      .mockResolvedValueOnce(10_100);
    mockedOpenapi.hasNewTxFrom.mockResolvedValue({ has_new_tx: true });
    mockedOpenapi.getAllTxHistory.mockResolvedValue(
      makeHistoryResult([10_100, 9_999]),
    );
    mockedOpenapi.listTxHisotry.mockResolvedValue(makeHistoryResult([10_100]));

    await syncUserAllHistory(ADDRESS);

    expect(mockedOpenapi.getAllTxHistory).toHaveBeenCalledWith({
      id: ADDRESS,
      start_time: 0,
      page_count: 500,
    });
    expect(mockedOpenapi.listTxHisotry).toHaveBeenCalledWith({
      id: ADDRESS,
      start_time: 0,
      page_count: 20,
    });
    expect(mockedSyncRemoteHistory).toHaveBeenNthCalledWith(
      1,
      ADDRESS,
      expect.objectContaining({
        history_list: [{ time_at: 10_100 }],
      }),
    );
    expect(mockedSyncRemoteHistory).toHaveBeenCalledTimes(2);
    expect(
      mockedOpenapi.getAllTxHistory.mock.invocationCallOrder[0],
    ).toBeLessThan(mockedOpenapi.listTxHisotry.mock.invocationCallOrder[0]);
  });

  it('bypasses the cached new-tx probe when realtime history is forced', async () => {
    mockedGetLatestTime.mockResolvedValue(10_000);
    mockedOpenapi.listTxHisotry.mockResolvedValue(makeHistoryResult([]));

    await syncUserAllHistory(ADDRESS, 0, undefined, true);

    expect(mockedOpenapi.hasNewTxFrom).not.toHaveBeenCalled();
    expect(mockedOpenapi.getAllTxHistory).not.toHaveBeenCalled();
    expect(mockedOpenapi.listTxHisotry).toHaveBeenCalledTimes(1);
  });

  it('resets the refresh timestamp and loading state after a sync failure', async () => {
    mockedGetLatestTime.mockResolvedValue(10_000);
    mockedOpenapi.listTxHisotry.mockRejectedValue(new Error('network failed'));

    await syncUserAllHistory(ADDRESS, 0, undefined, true);

    expect(mockedUpdateHistoryTime).toHaveBeenCalledWith(ADDRESS, 0);
    expect(mockedSetHistoryLoading).toHaveBeenCalledTimes(2);
  });
});
