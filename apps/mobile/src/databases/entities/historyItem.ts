import 'reflect-metadata';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { TxHistoryItem } from '@rabby-wallet/rabby-api/dist/types';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  ManyToOne,
  Brackets,
} from 'typeorm';
import { EntityAddressAssetBase } from './base';
import { columnConverter, badRealTransformer } from './_helpers';
import { prepareAppDataSource } from '../imports';
import { HistoryItemCateType } from '@/screens/Transaction/components/type';
import { fetchHistoryTokenItem } from '@/screens/Transaction/components/utils';

export type ProjectItemType = {
  chain: string;
  id: string;
  logo_url: string;
  name: string;
};
@Entity('cache_historyitem')
export class HistoryItemEntity extends EntityAddressAssetBase {
  // is_scam
  @Column('boolean')
  is_scam: TxHistoryItem['is_scam'] = false;
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
    transformer: {
      to: (val: any) => columnConverter.jsonObjToString(val),
      from: (val: any) => columnConverter.jsonStringToObj(val),
    },
  })
  receives: {
    token_id: string;
    amount: number;
    from_addr: string;
    price?: number;
    token?: TokenItem;
  }[] = [];
  // sends
  @Column({
    type: 'text',
    default: '[]',
    transformer: {
      to: (val: any) => columnConverter.jsonObjToString(val),
      from: (val: any) => columnConverter.jsonStringToObj(val),
    },
  })
  sends: {
    token_id: string;
    amount: number;
    to_addr: string;
    price?: number;
    token?: TokenItem;
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
    transformer: {
      to: (val: any) => columnConverter.jsonObjToString(val),
      from: (val: any) => columnConverter.jsonStringToObj(val),
    },
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
    transformer: {
      to: (val: any) => columnConverter.jsonObjToString(val),
      from: (val: any) => columnConverter.jsonStringToObj(val),
    },
  })
  project_item?: ProjectItemType = {
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
  ) {
    e.owner_addr = owner_addr;

    e.other_addr = input.other_addr ?? '';
    e.is_scam = input.is_scam ?? false;
    e.txHash = input.id ?? '';
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
    e.chain = input.chain ?? 'eth';
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

    e.makeDbId();
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

  static async batchQueryHistory(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().findBy({ owner_addr });
  }

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
    filterNotScam?: boolean,
    cate_id?: string,
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
      .andWhere('historyitem.time_at >= :ninetyDaysAgo', {
        ninetyDaysAgo: maxTimeAt ?? ninetyDaysAgo,
      })
      .orderBy('historyitem.time_at', 'DESC')
      .take(count || 10000); // limit

    if (filterNotScam) {
      queryBuilder.andWhere('historyitem.is_scam = :is_scam', {
        is_scam: false,
      });
    }
    if (cate_id) {
      queryBuilder.andWhere('historyitem.cate_id = :cate_id', {
        cate_id,
      });
    }

    const res = await queryBuilder.getMany();
    return res;
  }

  static async getTokenHistoryItemSortedByTime(
    owner_addrs: string[],
    tokenId: string,
    chain: string,
    count?: number,
  ) {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const currentTime = new Date().getTime();
    const ninetyDaysAgo = Math.floor(currentTime / 1000) - 90 * 24 * 60 * 60;
    console.log('getTokenHistoryItemSortedByTime exec');

    const queryBuilder = repo
      .createQueryBuilder('historyitem')
      .where('historyitem.owner_addr IN (:...owner_addrs)', { owner_addrs })
      .andWhere('historyitem.chain = :chain', { chain })
      // .andWhere('historyitem.time_at >= :ninetyDaysAgo', { ninetyDaysAgo })
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
      )
      .orderBy('historyitem.time_at', 'DESC')
      .take(count || 10000); // limit

    const res = await queryBuilder.getMany();
    console.log(
      'getTokenHistoryItemSortedByTime exec done',
      new Date().getTime() - currentTime,
    );
    return res;
  }

  /**
   * 优化版本：利用新的表结构进行更高效的token历史查询
   * 优先使用直接字段查询，减少JSON解析开销
   */
  static async getTokenHistoryItemSortedByTimeOptimized(
    owner_addrs: string[],
    tokenId: string,
    chain: string,
    count?: number,
  ) {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const currentTime = new Date().getTime();
    console.log('getTokenHistoryItemSortedByTimeOptimized exec');

    const queryBuilder = repo
      .createQueryBuilder('historyitem')
      .where('historyitem.owner_addr IN (:...owner_addrs)', { owner_addrs })
      .andWhere('historyitem.chain = :chain', { chain })
      .andWhere(
        new Brackets(qb => {
          qb
            // 直接字段查询（最快）
            .where('historyitem.token_approve_id = :tokenId')
            // 简化的字符串匹配查询（比JSON解析快）
            .orWhere('historyitem.receives LIKE :tokenIdPattern')
            .orWhere('historyitem.sends LIKE :tokenIdPattern');
        }),
        {
          tokenId,
          tokenIdPattern: `%"token_id":"${tokenId}"%`,
        },
      )
      .orderBy('historyitem.time_at', 'DESC')
      .take(count || 10000);

    const res = await queryBuilder.getMany();
    console.log(
      'getTokenHistoryItemSortedByTimeOptimized exec done',
      new Date().getTime() - currentTime,
    );
    return res;
  }

  static async deleteForAddress(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr });
  }
}
