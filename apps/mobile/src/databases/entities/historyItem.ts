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
} from 'typeorm';
import { EntityAddressAssetBase } from './base';
import { columnConverter, badRealTransformer } from './_helpers';
import { prepareAppDataSource } from '../imports';
import {
  TransactionGroup,
  TransactionHistoryItem,
} from '@/core/services/transactionHistory';
import { findChain } from '@/utils/chain';
import BigNumber from 'bignumber.js';
import { HistoryItemCateType } from '@/screens/Transaction/components/HistoryItemIcon';

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
    default: '',
    transformer: {
      to: (val: any) => columnConverter.jsonObjToString(val),
      from: (val: any) => columnConverter.jsonStringToObj(val),
    },
  })
  receives?: string = '';
  // sends
  @Column({
    type: 'text',
    default: '',
    transformer: {
      to: (val: any) => columnConverter.jsonObjToString(val),
      from: (val: any) => columnConverter.jsonStringToObj(val),
    },
  })
  sends?: string = '';
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

  // historyItemCateType
  @Column('text', { default: '' })
  historyItemCateType?: HistoryItemCateType | '' = '';

  // tx_eth_gas_fee
  @Column('real', {
    default: 0,
    transformer: badRealTransformer,
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

  static fillEntityFromLocalSend(
    e: HistoryItemEntity,
    input: TransactionHistoryItem,
  ) {
    e.owner_addr = input.address;

    e.other_addr = '';
    e.is_scam = false;
    e.txHash = input.hash ?? '';
    e.receives = '[]';
    const actionData = input.action?.actionData;
    const amount = new BigNumber(actionData?.send?.token.raw_amount || '0').div(
      10 ** (actionData?.send?.token.decimals || 0),
    );
    e.sends = JSON.stringify([
      {
        amount: amount.toNumber(),
        to_addr: actionData?.send?.to || '',
        token_id: actionData?.send?.token.id || '',
      },
    ]);
    e.chain =
      findChain({
        id: input.chainId,
      })?.serverId ?? 'eth';
    e.status = input.isFailed ? 0 : 1;
    e.time_at = input.completedAt ? Math.floor(input.completedAt / 1000) : 0;
    e.cate_id = 'fromLocalStore';
    e.tx_name = '';
    e.token_approve_id = '';
    e.token_approve_value = 0;
    e.token_approve_spender = '';
    e.project_id = '';

    // todo
    e.tx_from_address = input.address;
    e.tx_to_address = actionData?.send?.to || '';
    e.tx_usd_gas_fee = 0;
    e.tx_eth_gas_fee = 0;
    e.historyItemCateType = HistoryItemCateType.Send;

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

    // filter from local store items for update new history items from api
    queryBuilder.andWhere('historyitem.cate_id != :typeValue', {
      typeValue: 'fromLocalStore',
    });

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

  static async getAllHistoryItemSortedByTime(
    owner_addrs: string[],
    count?: number,
    filterNotScam?: boolean,
  ) {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const currentTime = new Date().getTime();
    console.log('getAllHistoryItemSortedByTime exec');

    const queryBuilder = repo
      .createQueryBuilder('historyitem')
      .where('historyitem.owner_addr IN (:...owner_addrs)', { owner_addrs })
      .orderBy('historyitem.time_at', 'DESC')
      .take(count || 10000); // limit

    if (filterNotScam) {
      queryBuilder.andWhere('historyitem.is_scam = :is_scam', {
        is_scam: false,
      });
    }

    const res = await queryBuilder.getMany();
    console.log(
      'getAllHistoryItemSortedByTime exec done',
      new Date().getTime() - currentTime,
    );
    return res;
  }
  static async deleteForAddress(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr });
  }
}
