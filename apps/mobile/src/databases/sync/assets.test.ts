import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { TokenItemEntity } from '../entities/tokenitem';
import { batchSaveWithPQueueAndTransaction } from './_task';
import { syncRemoteTokens } from './assets';

jest.mock('typeorm/browser', () => require('typeorm'));
jest.mock('@op-engineering/op-sqlite', () => ({
  ANDROID_DATABASE_PATH: '',
  IOS_LIBRARY_PATH: '',
  open: jest.fn(),
}));
jest.mock('@/utils/token', () => ({ tokenItemEntityToTokenItem: jest.fn() }));
jest.mock('@/core/request', () => ({ openapi: {} }));
jest.mock('../imports', () => ({
  prepareAppDataSource: jest.fn(async () => undefined),
}));
jest.mock('./_task', () => ({
  batchSaveWithPQueueAndTransaction: jest.fn(async () => ({
    taskKey: 'token-test',
    taskSignal: new AbortController().signal,
    queueCompleted: true,
  })),
}));

const NOW = 1_800_000_000_000;
const OLDEST = NOW - 8 * 60_000;
const makeToken = (id: string, chain = 'eth') =>
  ({ id, chain, amount: 2, price: 3 } as TokenItem);
const write = jest.mocked(batchSaveWithPQueueAndTransaction);

describe('Token sync cache timestamps', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    write.mockClear();
    jest.spyOn(TokenItemEntity, 'getOldestUpdatedAt').mockResolvedValue(OLDEST);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  async function sync(tokens: TokenItem[], cleanupStale = false) {
    const pending = syncRemoteTokens('0xAbCd', tokens, { cleanupStale });
    jest.advanceTimersByTime(100);
    expect(await pending).toBe(true);
    return write.mock.calls[0][1] as TokenItemEntity[];
  }

  it.each([
    [makeToken('eth'), makeToken('arb', 'arb')],
    [makeToken('eth')],
    [],
  ])(
    'keeps the previous expiry for a partial snapshot: %j',
    async (...tokens) => {
      const rows = await sync(tokens);

      expect(TokenItemEntity.getOldestUpdatedAt).toHaveBeenCalledWith('0xabcd');
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every(row => row._local_updated_at === OLDEST)).toBe(true);
      for (const token of tokens) {
        expect(rows.find(row => row.id === token.id)).toMatchObject(token);
      }
    },
  );

  it('does not mark a partial snapshot fresh when there was no full cache', async () => {
    jest.mocked(TokenItemEntity.getOldestUpdatedAt).mockResolvedValue(0);
    const rows = await sync([makeToken('eth')]);

    expect(rows[0]._local_updated_at).toBe(0);
  });

  it('still timestamps a full refresh with the current time', async () => {
    const rows = await sync([makeToken('eth')], true);

    expect(TokenItemEntity.getOldestUpdatedAt).not.toHaveBeenCalled();
    expect(rows[0]._local_updated_at).toBeGreaterThanOrEqual(NOW);
    expect(rows[0]._local_updated_at).toBeLessThanOrEqual(Date.now());
  });
});
