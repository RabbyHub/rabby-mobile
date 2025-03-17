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
  receives: string = '[]';
  // sends
  @Column({
    type: 'text',
    default: '[]',
    transformer: {
      to: (val: any) => columnConverter.jsonObjToString(val),
      from: (val: any) => columnConverter.jsonStringToObj(val),
    },
  })
  sends: string = '[]';
  // tx_name
  @Column('text', { default: '' })
  tx_name: string = '';
  // token_approve_id
  @Column('text', { default: '' })
  token_approve_id: string = '';

  // token_approve_spender
  @Column('text', { default: '' })
  token_approve_spender: string = '';
  // token_approve_value
  @Column('real', {
    transformer: badRealTransformer,
  })
  token_approve_value: number = 0;

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
    transformer: badRealTransformer,
  })
  tx_usd_gas_fee: number = 0;

  // tx_eth_gas_fee
  @Column('real', {
    default: 0,
    transformer: badRealTransformer,
  })
  tx_eth_gas_fee: number = 0;

  // historyItemCateType
  @Column('text', { default: '' })
  historyItemCateType?: HistoryItemCateType = undefined;

  makeDbId(): string {
    return (this._db_id = `${this.owner_addr}-${[this.chain, this.txHash]
      .filter(Boolean)
      .join('-')}`);
  }

  static fillEntity(
    e: HistoryItemEntity,
    owner_addr: string,
    input: TxHistoryItem,
  ) {
    e.owner_addr = owner_addr;

    e.other_addr = input.other_addr ?? '';
    e.is_scam = input.is_scam ?? false;
    e.txHash = input.id ?? '';
    e.receives = JSON.stringify(input.receives);
    e.sends = JSON.stringify(input.sends);
    e.chain = input.chain ?? 'eth';
    e.status = input.tx?.status ?? 0;
    e.time_at = input.time_at ?? 0;
    e.cate_id = input.cate_id ?? '';
    e.tx_name = input.tx?.name ?? '';
    e.token_approve_id = input.token_approve?.token_id ?? '';
    e.token_approve_value = input.token_approve?.value ?? 0;
    e.token_approve_spender = input.token_approve?.spender ?? '';
    e.project_id = input.project_id ?? '';

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
  // static async getAllHistoryItemSortedByTime(
  //   limit: number = 100,
  //   lastTimeAt?: number,
  // ) {
  //   await prepareAppDataSource();

  //   const repo = this.getRepository();

  //   const queryBuilder = repo
  //     .createQueryBuilder('historyitem')
  //     .orderBy('historyitem.time_at', 'DESC')
  //     .take(limit);

  //   if (lastTimeAt) {
  //     queryBuilder.where('historyitem.time_at > :lastTimeAt', { lastTimeAt });
  //   }

  //   const items = await queryBuilder.getMany();

  //   const totalCount = await repo
  //     .createQueryBuilder('historyitem')
  //     .select('COUNT(*)', 'count')
  //     .getRawOne();

  //   const hasMore = totalCount.count > limit + items.length;

  //   return {
  //     items,
  //     hasMore,
  //   };
  // }

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
  ) {
    await prepareAppDataSource();
    const currentTime = new Date().getTime();
    const ninetyDaysAgo = Math.floor(currentTime / 1000) - 90 * 24 * 60 * 60;
    console.log('getAllHistoryItemSortedByTime exec');
    const repo = this.getRepository();
    const queryBuilder = repo
      .createQueryBuilder('historyitem')
      .where('historyitem.owner_addr IN (:...owner_addrs)', { owner_addrs })
      .andWhere('historyitem.time_at >= :ninetyDaysAgo', { ninetyDaysAgo })
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
          qb.where(
            `EXISTS (
              SELECT 1
              FROM json_each(json_extract(historyitem.receives, '$')) AS json_each
              WHERE json_each.value ->> 'token_id' = :tokenId
            )`,
          )
            .orWhere(
              `EXISTS (
              SELECT 1
              FROM json_each(json_extract(historyitem.sends, '$')) AS json_each
              WHERE json_each.value ->> 'token_id' = :tokenId
            )`,
            )
            .orWhere('historyitem.token_approve_id = :tokenId');
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

  static async deleteForAddress(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr });
  }
}
