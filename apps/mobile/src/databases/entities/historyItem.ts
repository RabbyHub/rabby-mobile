import 'reflect-metadata';
import type { NFTItem, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { BuyServiceProvider } from '@rabby-wallet/rabby-api/dist/types';
import type { TxHistoryItem } from '@rabby-wallet/rabby-api/dist/types';
import { Entity, Column, Brackets } from 'typeorm/browser';
import type {
  DataSource,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm/browser';
import { EntityAddressAssetBase } from './base';
import {
  columnConverter,
  badRealTransformer,
  jsonTransformer,
} from './_helpers';
import { prepareAppDataSource } from '../imports';
import type { ProjectItemType } from '@/types/history';
import {
  CUSTOM_HISTORY_TITLE_TYPE,
  HistoryItemCateType,
} from '@/types/history';
import {
  checkIsGasDepositTx,
  fetchHistoryTokenItem,
  isNFTTokenId,
} from '@/utils/history';
import type { IManageToken } from '@/types/assets';
import {
  GAS_ACCOUNT_RECEIVED_ADDRESS,
  GAS_ACCOUNT_WITHDRAWED_ADDRESS,
  L2_DEPOSIT_ADDRESS_MAP,
} from '@/constant/gas-account';
import type {
  CustomTxItem,
  TransactionHistoryItem,
} from '@/core/services/transactionHistory';
import { APP_DB_PREFIX, ORM_TABLE_NAMES } from '../constant';
import { PreparedStatement } from '@op-engineering/op-sqlite';
import { ParseEntity } from '@/core/utils/typeorm';
import { findChain } from '@/utils/chain';

export type { ProjectItemType } from '@/types/history';

/**
 * Keyset cursor for {@link HistoryItemEntity.getHistoryItemsPaginated}. It
 * mirrors the full sort key so rows sharing a `time_at` are never skipped at a
 * page boundary.
 */
export type HistoryPageCursor = Pick<
  HistoryItemEntity,
  'time_at' | 'cate_id' | '_db_id'
>;

const getHistoryRepository = async (dataSource?: DataSource) =>
  (dataSource ?? (await prepareAppDataSource())).getRepository(
    HistoryItemEntity,
  );

export const toHistoryPageCursor = (
  item: HistoryPageCursor,
): HistoryPageCursor => ({
  time_at: item.time_at,
  cate_id: item.cate_id,
  _db_id: item._db_id,
});

/** Sort by the full keyset (newest first, receive before send, unique tie breaker) and resume after `cursor`. */
const applyHistoryPageOrder = <T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  cursor?: HistoryPageCursor | null,
) => {
  if (cursor) {
    queryBuilder.andWhere(
      new Brackets(qb => {
        qb.where('historyitem.time_at < :cursorTimeAt').orWhere(
          new Brackets(sameTime => {
            sameTime.where('historyitem.time_at = :cursorTimeAt').andWhere(
              new Brackets(tie => {
                tie
                  .where('historyitem.cate_id > :cursorCateId')
                  .orWhere(
                    'historyitem.cate_id = :cursorCateId AND historyitem._db_id > :cursorDbId',
                  );
              }),
            );
          }),
        );
      }),
      {
        cursorTimeAt: cursor.time_at,
        cursorCateId: cursor.cate_id,
        cursorDbId: cursor._db_id,
      },
    );
  }

  return queryBuilder
    .orderBy('historyitem.time_at', 'DESC')
    .addOrderBy('historyitem.cate_id', 'ASC')
    .addOrderBy('historyitem._db_id', 'ASC');
};

@ParseEntity()
@Entity(ORM_TABLE_NAMES.cache_historyitem)
export class HistoryItemEntity extends EntityAddressAssetBase {
  // is_scam
  @Column('boolean')
  is_scam: TxHistoryItem['is_scam'] = false;
  // is_small_tx
  @Column('boolean', { default: false })
  is_small_tx?: boolean = false;

  // id
  @Column('text', { default: '' })
  txHash: TxHistoryItem['id'] = '';

  // project_id
  @Column('text', { default: '' })
  project_id: TxHistoryItem['project_id'] = '';

  // chain
  @Column('text', { default: '' })
  chain: TxHistoryItem['chain'] = 'eth';
  // status
  @Column('integer')
  status: number = 0;
  // time_at
  @Column('integer')
  time_at: TxHistoryItem['time_at'] = 0;
  // cate_id
  @Column('text', { default: '' })
  cate_id: TxHistoryItem['cate_id'] = '';
  // receives
  @Column({
    type: 'text',
    default: '[]',
    transformer: jsonTransformer,
  })
  receives: {
    token_id: string;
    amount: number;
    from_addr: string;
    price?: number;
    token: TokenItem;
  }[] = [];
  // sends
  @Column({
    type: 'text',
    default: '[]',
    transformer: jsonTransformer,
  })
  sends: {
    token_id: string;
    amount: number;
    to_addr: string;
    price?: number;
    token: TokenItem;
  }[] = [];
  // tx_name
  @Column('text', { default: '' })
  tx_name: string = '';
  // token_approve_id
  @Column('text', { default: '' })
  token_approve_id: string = '';

  @Column({
    type: 'text',
    default: '{}',
    transformer: jsonTransformer,
  })
  token_approve_item: TokenItem = {
    amount: 0,
    chain: '',
    decimals: 0,
    display_symbol: null,
    id: '',
    is_core: false,
    is_verified: false,
    is_wallet: false,
    logo_url: '',
    name: '',
    optimized_symbol: '',
    price: 0,
    symbol: '',
    time_at: 0,
  };

  // token_approve_spender
  @Column('text', { default: '' })
  token_approve_spender: string = '';
  // token_approve_value
  @Column('real', { default: 0 })
  token_approve_value: number = 0;

  @Column({
    type: 'text',
    default: '{}',
    transformer: jsonTransformer,
  })
  project_item?: ProjectItemType | null = {
    chain: '',
    id: '',
    logo_url: '',
    name: '',
  };

  // other_addr
  @Column('text', { default: '' })
  other_addr: string = '';

  // tx_from_address
  @Column('text', { default: '' })
  tx_from_address: string = '';

  // tx_to_address
  @Column('text', { default: '' })
  tx_to_address: string = '';

  // tx_usd_gas_fee
  @Column('real', {
    default: 0,
  })
  tx_usd_gas_fee: number = 0;

  // tx_eth_gas_fee
  @Column('real', {
    default: 0,
  })
  tx_eth_gas_fee: number = 0;

  @Column('text', { default: HistoryItemCateType.UnKnown })
  history_type: HistoryItemCateType = HistoryItemCateType.UnKnown;

  @Column('text', { default: '' })
  history_custom_type?: CUSTOM_HISTORY_TITLE_TYPE | undefined = undefined;

  makeDbId(): string {
    return (this._db_id = `${this.owner_addr}-${[this.chain, this.txHash]
      .filter(Boolean)
      .join('-')}`);
  }

  static fillEntity(
    e: HistoryItemEntity,
    owner_addr: string,
    input: TxHistoryItem,
    tokenDict: Record<string, TokenItem>,
    projectDict: Record<string, ProjectItemType>,
    pinedQueue: IManageToken[],
    customTxItem: CustomTxItem | undefined,
    transactions: readonly TransactionHistoryItem[],
  ) {
    e.owner_addr = owner_addr;
    e.other_addr = input.other_addr ?? '';
    e.is_scam = input.is_scam ?? false;
    e.txHash = input.id ?? '';
    e.chain = input.chain ?? 'eth';
    e.receives = input.receives.map(item => {
      const token = fetchHistoryTokenItem(item.token_id, e.chain, tokenDict);
      return {
        ...item,
        token,
      };
    });
    e.sends = input.sends.map(item => {
      const token = fetchHistoryTokenItem(item.token_id, e.chain, tokenDict);
      return {
        ...item,
        token,
      };
    });
    e.status = input.tx?.status ?? 1;
    e.time_at = input.time_at ?? 0;
    e.cate_id = input.cate_id ?? '';
    e.tx_name = input.tx?.name ?? '';
    e.token_approve_id = input.token_approve?.token_id ?? '';
    e.token_approve_value = input.token_approve?.value ?? 0;
    e.token_approve_spender = input.token_approve?.spender ?? '';
    e.token_approve_item = fetchHistoryTokenItem(
      e.token_approve_id,
      e.chain,
      tokenDict,
    );
    e.project_id = input.project_id ?? '';
    e.project_item = projectDict[e.project_id] || null;
    e.tx_from_address = input.tx?.from_addr ?? '';
    e.tx_to_address = input.tx?.to_addr ?? '';
    e.tx_usd_gas_fee = input.tx?.usd_gas_fee ?? 0;
    e.tx_eth_gas_fee = input.tx?.eth_gas_fee ?? 0;
    e.is_small_tx = this.judgeIsSmallUsdTx(e, pinedQueue);
    e.makeDbId();
    e.history_type = this.getHistoryItemType(e, transactions);
    if (customTxItem) {
      e.history_custom_type = customTxItem.actionType;
    }
  }

  static judgeIsSmallUsdTx(
    item: HistoryItemEntity,
    pinedQueue: IManageToken[],
  ) {
    if (item.tx_from_address.toLowerCase() === item.owner_addr.toLowerCase()) {
      return false;
    }

    const transfers = [...(item.receives || []), ...(item.sends || [])];

    if (!transfers.length) {
      return true;
    }
    let allUsd = 0;

    for (const i of transfers) {
      const token = i.token;
      const tokenIsNft = i.token_id?.length === 32;
      if (tokenIsNft) {
        // reeives nft
        const nftToken = token as unknown as NFTItem;
        if (!nftToken || !nftToken.collection) {
          return true;
        } else {
          return false;
        }
      }
      const isCore =
        token?.is_core ||
        token?.is_verified ||
        pinedQueue.find(
          p => p.chainId === item.chain && p.tokenId === i.token_id,
        );
      const price = isCore ? i?.price || token?.price || 0 : 0; // is not core token price to 0
      const usd = i.amount * price;
      allUsd += usd;
    }

    if (allUsd < 0.1) {
      return true;
    }

    return false;
  }

  static getHistoryItemType(
    data: HistoryItemEntity,
    transactions: readonly TransactionHistoryItem[],
  ) {
    try {
      if (
        checkIsGasDepositTx({
          chainId: findChain({ serverId: data.chain })?.id,
          hash: data.txHash,
          transactions,
        })
      ) {
        return HistoryItemCateType.GAS_DEPOSIT;
      }
      if (data.cate_id === 'approve') {
        if (!data.token_approve_value) {
          return HistoryItemCateType.Revoke;
        } else {
          return HistoryItemCateType.Approve;
        }
      }

      if (data.cate_id === 'cancel') {
        return HistoryItemCateType.Cancel;
      }

      const receives = data.receives;
      const sends = data.sends;
      if (
        receives?.filter(item => !isNFTTokenId(item.token_id)).length === 1 &&
        sends?.filter(item => !isNFTTokenId(item.token_id)).length === 1
      ) {
        return HistoryItemCateType.Swap;
      }

      if (receives?.length === 1 && sends?.length === 0) {
        if (
          data?.tx_from_address.toLowerCase() === GAS_ACCOUNT_WITHDRAWED_ADDRESS
        ) {
          return HistoryItemCateType.GAS_WITHDRAW;
        }

        if (
          data?.tx_from_address.toLowerCase() === GAS_ACCOUNT_RECEIVED_ADDRESS
        ) {
          return HistoryItemCateType.GAS_RECEIVED;
        }

        return HistoryItemCateType.Recieve;
      }

      if (receives?.length === 0 && sends?.length === 1) {
        if (
          Object.values(L2_DEPOSIT_ADDRESS_MAP).includes(
            data.other_addr.toLowerCase() || '',
          )
        ) {
          return HistoryItemCateType.GAS_DEPOSIT;
        }

        return HistoryItemCateType.Send;
      }

      return HistoryItemCateType.UnKnown;
    } catch (error) {
      console.error(error);
      return HistoryItemCateType.UnKnown;
    }
  }

  static async getAllHistoryItem(owner_addr?: string) {
    await prepareAppDataSource();

    return await this.getRepository().findBy({ owner_addr });
  }

  static async getCountOfAccount() {
    await prepareAppDataSource();

    const repo = this.getRepository();

    const result = await repo
      .createQueryBuilder('historyitem')
      .select('COUNT(DISTINCT (`owner_addr`))', 'uniqueChainAddressCount')
      .getRawOne();

    return result.uniqueChainAddressCount as number;
  }

  static async getCount() {
    await prepareAppDataSource();

    return this.getRepository().count();
  }

  static async getLatestTime(owner_addr?: string): Promise<number> {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const queryBuilder = repo
      .createQueryBuilder('historyitem')
      .select('MAX(historyitem.time_at)', 'maxTimeAt');

    if (owner_addr) {
      queryBuilder.where('historyitem.owner_addr = :owner_addr', {
        owner_addr,
      });
    }

    const result = await queryBuilder.getRawOne();

    if (!result || !result.maxTimeAt) {
      return 0;
    }

    return result.maxTimeAt;
  }

  /** Count stored history rows of `owner_addr` with `from_ts <= time_at <= to_ts` (seconds). */
  static async countInTimeRange(
    owner_addr: string,
    from_ts: number,
    to_ts: number,
    dataSource?: DataSource,
  ): Promise<number> {
    const repo = await getHistoryRepository(dataSource);

    return repo
      .createQueryBuilder('historyitem')
      .where('historyitem.owner_addr = :owner_addr', { owner_addr })
      .andWhere('historyitem.time_at >= :from_ts', { from_ts })
      .andWhere('historyitem.time_at <= :to_ts', { to_ts })
      .getCount();
  }

  static async batchQueryHistory(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().findBy({ owner_addr });
  }

  /** @deprecated */
  static async getAllSendItemsTriggeredByImportedAddr(
    owner_addrs: string[],
    count?: number,
  ) {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const queryBuilder = repo
      .createQueryBuilder('historyitem')
      .where('historyitem.owner_addr IN (:...owner_addrs)', { owner_addrs })
      .andWhere('historyitem.is_scam = :is_scam', {
        is_scam: false,
      })
      .andWhere('historyitem.cate_id = :cate_id', {
        cate_id: 'send',
      })
      .andWhere('historyitem.tx_from_address IN (:...tx_from_addresses)', {
        tx_from_addresses: owner_addrs,
      })
      .orderBy('historyitem.time_at', 'DESC')
      .take(count || 10000); // limit

    const res = await queryBuilder.getMany();
    return res;
  }

  static async getAllHistoryItemSortedByTime(
    owner_addrs: string[],
    count?: number,
    filterScamAndSmallTx?: boolean,
    maxTimeAt?: number,
  ) {
    await prepareAppDataSource();
    const currentTime = new Date().getTime();
    const ninetyDaysAgo = Math.floor(currentTime / 1000) - 90 * 24 * 60 * 60;
    console.log('getAllHistoryItemSortedByTime exec');

    const repo = this.getRepository();
    const queryBuilder = repo
      .createQueryBuilder('historyitem')
      .where('historyitem.owner_addr IN (:...owner_addrs)', { owner_addrs })
      .andWhere('historyitem.time_at > :ninetyDaysAgo', {
        ninetyDaysAgo: maxTimeAt ?? ninetyDaysAgo,
      })
      .orderBy('historyitem.time_at', 'DESC')
      .take(count || 10000);

    if (filterScamAndSmallTx) {
      // filter scam tx
      queryBuilder.andWhere('historyitem.is_scam = :is_scam', {
        is_scam: false,
      });

      queryBuilder.andWhere('historyitem.is_small_tx = :is_small_tx', {
        is_small_tx: false,
      });
    }

    const res = await queryBuilder.getMany();

    console.log(
      'getAllHistoryItemSortedByTime exec time:',
      new Date().getTime() - currentTime,
      'count:',
      res.length,
    );
    return res;
  }

  static async getUnreadHistoryCount(
    owner_addrs: string[],
    maxTimeAt: number,
    dataSource?: DataSource,
  ): Promise<Pick<HistoryItemEntity, 'owner_addr' | 'txHash' | 'status'>[]> {
    const currentTime = new Date().getTime();
    console.log('getUnreadHistoryCount exec');
    const repo = await getHistoryRepository(dataSource);
    const queryBuilder = repo
      .createQueryBuilder('historyitem')
      .select(['owner_addr', 'txHash', 'status'])
      .where('historyitem.owner_addr IN (:...owner_addrs)', { owner_addrs })
      .andWhere('historyitem.time_at > :maxTimeAt', {
        maxTimeAt,
      })
      .andWhere(
        'LOWER(historyitem.tx_from_address) != LOWER(historyitem.owner_addr)',
      )
      .andWhere('historyitem.is_scam = :is_scam', {
        is_scam: false,
      })
      .andWhere('historyitem.is_small_tx = :is_small_tx', {
        is_small_tx: false,
      })
      .orderBy('historyitem.time_at', 'DESC')
      .take(10);
    const res = await queryBuilder.getRawMany();

    console.log(
      'getUnreadHistoryCount exec time:',
      new Date().getTime() - currentTime,
      'count:',
      res.length,
    );
    return res;
  }

  static async getHistoryItemsPaginated(
    owner_addrs: string[],
    options: {
      pageSize?: number;
      cursor?: HistoryPageCursor | null; // page cursor
      maxTimeAt?: number;
      filterScamAndSmallTx?: boolean;
      filterLendingHistory?: boolean;
    } = {},
    dataSource?: DataSource,
  ): Promise<{
    items: HistoryItemEntity[];
    hasMore: boolean;
    nextCursor?: HistoryPageCursor;
  }> {
    const currentTime = new Date().getTime();
    const { pageSize = 50, cursor, maxTimeAt, filterLendingHistory } = options;

    const ninetyDaysAgo = Math.floor(currentTime / 1000) - 90 * 24 * 60 * 60;
    console.log('getHistoryItemsPaginated exec', { pageSize, cursor });

    const repo = await getHistoryRepository(dataSource);
    let queryBuilder = repo
      .createQueryBuilder('historyitem')
      .where('historyitem.owner_addr IN (:...owner_addrs)', { owner_addrs })
      .andWhere('historyitem.time_at >= :ninetyDaysAgo', {
        ninetyDaysAgo: maxTimeAt ?? ninetyDaysAgo,
      });

    if (options.filterScamAndSmallTx) {
      // filter scam tx
      queryBuilder = queryBuilder.andWhere('historyitem.is_scam = :is_scam', {
        is_scam: false,
      });

      queryBuilder = queryBuilder.andWhere(
        'historyitem.is_small_tx = :is_small_tx',
        {
          is_small_tx: false,
        },
      );
    }

    if (filterLendingHistory) {
      queryBuilder = queryBuilder.andWhere(
        'historyitem.history_custom_type IN (:...history_custom_types)',
        {
          history_custom_types: [
            CUSTOM_HISTORY_TITLE_TYPE.LENDING_SUPPLY,
            CUSTOM_HISTORY_TITLE_TYPE.LENDING_WITHDRAW,
            CUSTOM_HISTORY_TITLE_TYPE.LENDING_BORROW,
            CUSTOM_HISTORY_TITLE_TYPE.LENDING_REPAY,
            CUSTOM_HISTORY_TITLE_TYPE.LENDING_ON_COLLATERAL,
            CUSTOM_HISTORY_TITLE_TYPE.LENDING_OFF_COLLATERAL,
            CUSTOM_HISTORY_TITLE_TYPE.LENDING_MANAGE_EMODE,
            CUSTOM_HISTORY_TITLE_TYPE.LENDING_MANAGE_EMODE_DISABLE,
            CUSTOM_HISTORY_TITLE_TYPE.LENDING_DEBT_SWAP,
            CUSTOM_HISTORY_TITLE_TYPE.LENDING_REPAY_WITH_COLLATERAL,
          ],
        },
      );
    }

    const res = await applyHistoryPageOrder(queryBuilder, cursor)
      .take(pageSize + 1) // add one for check has more
      .getMany();

    const hasMore = res.length > pageSize;
    const items = hasMore ? res.slice(0, pageSize) : res;
    const lastItem = items[items.length - 1];
    const nextCursor = lastItem ? toHistoryPageCursor(lastItem) : undefined;

    console.log(
      'getHistoryItemsPaginated exec time:',
      new Date().getTime() - currentTime,
      'count:',
      items.length,
    );

    return {
      items,
      hasMore,
      nextCursor,
    };
  }

  static async getTokenHistoryItemSortedByTime(
    owner_addr: string,
    cursor: HistoryPageCursor | null,
    tokenId: string,
    chain: string,
    count?: number,
    dataSource?: DataSource,
  ) {
    const repo = await getHistoryRepository(dataSource);
    const currentTime = new Date().getTime();
    const ninetyDaysAgo = Math.floor(currentTime / 1000) - 90 * 24 * 60 * 60;
    console.log('getTokenHistoryItemSortedByTime exec');

    const queryBuilder = repo
      .createQueryBuilder('historyitem')
      .where('historyitem.owner_addr = :owner_addr', { owner_addr })
      .andWhere('historyitem.chain = :chain', { chain })
      .andWhere('historyitem.time_at >= :ninetyDaysAgo', { ninetyDaysAgo })
      .andWhere(
        new Brackets(qb => {
          qb.where('historyitem.token_approve_id = :tokenId')
            .orWhere(
              `EXISTS (
                SELECT 1
                FROM json_each(historyitem.receives) AS receive_item
                WHERE json_extract(receive_item.value, '$.token_id') = :tokenId
              )`,
            )
            .orWhere(
              `EXISTS (
                SELECT 1
                FROM json_each(historyitem.sends) AS send_item
                WHERE json_extract(send_item.value, '$.token_id') = :tokenId
              )`,
            );
        }),
        { tokenId },
      );

    const res = await applyHistoryPageOrder(queryBuilder, cursor)
      .take(count || 10000) // limit
      .getMany();
    console.log(
      'getTokenHistoryItemSortedByTime exec done',
      new Date().getTime() - currentTime,
    );
    return res;
  }

  static async deleteForAddress(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr });
  }
}
