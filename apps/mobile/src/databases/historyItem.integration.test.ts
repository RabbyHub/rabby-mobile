import type { DataSource } from 'typeorm/browser';

import { createMemoryAppDataSource } from '../../test-support/database/createMemoryAppDataSource';
import {
  HistoryItemEntity,
  toHistoryPageCursor,
  type HistoryPageCursor,
} from './entities/historyItem';

const OWNER_A = '0x000000000000000000000000000000000000000a';
const OWNER_B = '0x000000000000000000000000000000000000000b';
const OTHER = '0x00000000000000000000000000000000000000ff';

const nowSec = () => Math.floor(Date.now() / 1000);

const makeHistoryItem = (input: {
  owner: string;
  txHash: string;
  time_at: number;
  cate_id?: string;
  status?: number;
  tx_from_address?: string;
  receiveTokenId?: string;
}) => {
  const item = new HistoryItemEntity();
  item.owner_addr = input.owner;
  item.chain = 'eth';
  item.txHash = input.txHash;
  item.time_at = input.time_at;
  item.cate_id = input.cate_id ?? 'send';
  item.status = input.status ?? 1;
  item.tx_from_address = input.tx_from_address ?? input.owner;
  if (input.receiveTokenId) {
    item.receives = [
      {
        token_id: input.receiveTokenId,
        amount: 1,
        from_addr: OTHER,
      } as HistoryItemEntity['receives'][number],
    ];
  }
  item.makeDbId();
  return item;
};

describe('HistoryItemEntity queries', () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    dataSource = undefined;
  });

  const saveItems = async (items: HistoryItemEntity[]) => {
    dataSource = await createMemoryAppDataSource();
    await dataSource.getRepository(HistoryItemEntity).save(items);
    return dataSource;
  };

  const readAllPages = async (
    source: DataSource,
    owners: string[],
    pageSize: number,
  ) => {
    const pages: string[][] = [];
    let cursor: HistoryPageCursor | null = null;
    for (let guard = 0; guard < 20; guard++) {
      const { items, hasMore, nextCursor } =
        await HistoryItemEntity.getHistoryItemsPaginated(
          owners,
          { pageSize, cursor },
          source,
        );
      pages.push(items.map(item => item._db_id));
      if (!hasMore) {
        break;
      }
      cursor = nextCursor ?? null;
    }
    return pages;
  };

  it('keeps a self-transfer visible for both owners across a page boundary', async () => {
    const sameTime = nowSec() - 60;
    const newer = makeHistoryItem({
      owner: OWNER_A,
      txHash: '0xnewer',
      time_at: sameTime + 10,
    });
    // one transaction between two owned addresses produces two rows with the same time_at
    const send = makeHistoryItem({
      owner: OWNER_A,
      txHash: '0xself',
      time_at: sameTime,
      cate_id: 'send',
    });
    const receive = makeHistoryItem({
      owner: OWNER_B,
      txHash: '0xself',
      time_at: sameTime,
      cate_id: 'receive',
      tx_from_address: OWNER_A,
    });
    const source = await saveItems([newer, send, receive]);

    const pages = await readAllPages(source, [OWNER_A, OWNER_B], 2);

    expect(pages).toEqual([[newer._db_id, receive._db_id], [send._db_id]]);
  });

  it('pages through many rows sharing one timestamp without gaps or duplicates', async () => {
    const sameTime = nowSec() - 60;
    const items = [
      makeHistoryItem({
        owner: OWNER_A,
        txHash: '0xa1',
        time_at: sameTime + 1,
      }),
      ...Array.from({ length: 5 }, (_, index) =>
        makeHistoryItem({
          owner: OWNER_A,
          txHash: `0xsame${index}`,
          time_at: sameTime,
          cate_id: index % 2 ? 'receive' : 'send',
        }),
      ),
      makeHistoryItem({
        owner: OWNER_A,
        txHash: '0xa2',
        time_at: sameTime - 1,
      }),
    ];
    const source = await saveItems(items);

    const pages = await readAllPages(source, [OWNER_A], 2);
    const { items: everything } =
      await HistoryItemEntity.getHistoryItemsPaginated(
        [OWNER_A],
        { pageSize: 100 },
        source,
      );

    expect(pages.flat()).toEqual(everything.map(item => item._db_id));
    expect(new Set(pages.flat()).size).toBe(items.length);
  });

  it('pages token history through rows sharing one timestamp without gaps or duplicates', async () => {
    const tokenId = '0xtoken';
    const sameTime = nowSec() - 60;
    const tokenItems = [
      makeHistoryItem({
        owner: OWNER_A,
        txHash: '0xt-newer',
        time_at: sameTime + 1,
        receiveTokenId: tokenId,
      }),
      ...Array.from({ length: 5 }, (_, index) =>
        makeHistoryItem({
          owner: OWNER_A,
          txHash: `0xt-same${index}`,
          time_at: sameTime,
          cate_id: index % 2 ? 'receive' : 'send',
          receiveTokenId: tokenId,
        }),
      ),
    ];
    const otherTokenItem = makeHistoryItem({
      owner: OWNER_A,
      txHash: '0xt-other',
      time_at: sameTime,
      receiveTokenId: '0xother',
    });
    const source = await saveItems([...tokenItems, otherTokenItem]);

    const collected: string[] = [];
    let cursor: HistoryPageCursor | null = null;
    for (let guard = 0; guard < 20; guard++) {
      const page = await HistoryItemEntity.getTokenHistoryItemSortedByTime(
        OWNER_A,
        cursor,
        tokenId,
        'eth',
        2,
        source,
      );
      collected.push(...page.map(item => item._db_id));
      if (page.length < 2) {
        break;
      }
      cursor = toHistoryPageCursor(page[page.length - 1]);
    }
    const everything = await HistoryItemEntity.getTokenHistoryItemSortedByTime(
      OWNER_A,
      null,
      tokenId,
      'eth',
      100,
      source,
    );

    expect(collected).toEqual(everything.map(item => item._db_id));
    expect(new Set(collected)).toEqual(
      new Set(tokenItems.map(item => item._db_id)),
    );
  });

  it('counts rows of one owner inside an inclusive time range', async () => {
    const from = nowSec() - 24 * 60 * 60;
    const to = nowSec() - 60;
    const source = await saveItems([
      makeHistoryItem({ owner: OWNER_A, txHash: '0xc-from', time_at: from }),
      makeHistoryItem({ owner: OWNER_A, txHash: '0xc-mid', time_at: from + 1 }),
      makeHistoryItem({ owner: OWNER_A, txHash: '0xc-to', time_at: to }),
      makeHistoryItem({ owner: OWNER_A, txHash: '0xc-old', time_at: from - 1 }),
      makeHistoryItem({ owner: OWNER_A, txHash: '0xc-new', time_at: to + 1 }),
      makeHistoryItem({
        owner: OWNER_B,
        txHash: '0xc-other',
        time_at: from + 1,
      }),
    ]);

    await expect(
      HistoryItemEntity.countInTimeRange(OWNER_A, from, to, source),
    ).resolves.toBe(3);
  });

  it('returns the status of unread incoming transactions', async () => {
    const recent = nowSec() - 60;
    const failed = makeHistoryItem({
      owner: OWNER_A,
      txHash: '0xfailed',
      time_at: recent,
      status: 0,
      tx_from_address: OTHER,
    });
    const succeeded = makeHistoryItem({
      owner: OWNER_A,
      txHash: '0xsucceeded',
      time_at: recent - 1,
      status: 1,
      tx_from_address: OTHER,
    });
    const source = await saveItems([failed, succeeded]);

    const unread = await HistoryItemEntity.getUnreadHistoryCount(
      [OWNER_A],
      recent - 3600,
      source,
    );

    expect(unread).toEqual([
      { owner_addr: OWNER_A, txHash: '0xfailed', status: 0 },
      { owner_addr: OWNER_A, txHash: '0xsucceeded', status: 1 },
    ]);
  });
});
