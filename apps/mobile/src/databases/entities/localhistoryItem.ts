import 'reflect-metadata';
import { TxHistoryItem } from '@rabby-wallet/rabby-api/dist/types';
import { Entity, Column } from 'typeorm/browser';
import { EntityAddressAssetBase } from './base';
import {
  columnConverter,
  badRealTransformer,
  jsonTransformer,
} from './_helpers';
import { prepareAppDataSource } from '../imports';
import BigNumber from 'bignumber.js';
import { findChain } from '@/utils/chain';
import { TransactionHistoryItem } from '@/core/services/transactionHistory';
import { HistoryItemCateType } from '@/screens/Transaction/components/type';
import { APP_DB_PREFIX, ORM_TABLE_NAMES } from '../constant';
import { PreparedStatement } from '@op-engineering/op-sqlite';

@Entity(ORM_TABLE_NAMES.cache_local_historyitem)
export class LocalHistoryItemEntity extends EntityAddressAssetBase {
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
    transformer: jsonTransformer,
  })
  receives: string = '[]';
  // sends
  @Column({
    type: 'text',
    default: '[]',
    transformer: jsonTransformer,
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
  historyItemCateType?: HistoryItemCateType = HistoryItemCateType.UnKnown;

  @Column('text', { default: '' })
  source_type?: string = '';

  makeDbId(): string {
    return (this._db_id = `${this.owner_addr}-${[this.chain, this.txHash]
      .filter(Boolean)
      .join('-')}`);
  }

  static fillEntity(
    e: LocalHistoryItemEntity,
    owner_addr: string,
    input: TxHistoryItem,
  ) {
    e.owner_addr = owner_addr;

    e.other_addr = input.other_addr ?? '';
    e.is_scam = false; // local can not is scam
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

  static stmSql = `
  INSERT INTO "${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_local_historyitem}"
  ("_db_id", "owner_addr", "is_scam", "txHash", "project_id", "chain", "status", "time_at", "cate_id", "receives", "sends", "tx_name", "token_approve_id", "token_approve_spender", "token_approve_value", "other_addr", "tx_from_address", "tx_to_address", "tx_usd_gas_fee", "tx_eth_gas_fee", "historyItemCateType", "source_type", "_local_created_at", "_local_updated_at")
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT ( "_db_id" ) DO UPDATE SET "_local_updated_at" = EXCLUDED."_local_updated_at"
  `;

  static getStatementSql() {
    return this.stmSql;
  }

  bindUpsertParams(stm: PreparedStatement): PreparedStatement {
    stm.bindSync([
      this._db_id,
      this.owner_addr,
      this.is_scam,
      this.txHash,
      this.project_id,
      this.chain,
      this.status,
      this.time_at,
      this.cate_id,
      this.receives,
      this.sends,
      this.tx_name,
      this.token_approve_id,
      this.token_approve_spender,
      badRealTransformer.to(this.token_approve_value),
      this.other_addr,
      this.tx_from_address,
      this.tx_to_address,
      badRealTransformer.to(this.tx_usd_gas_fee),
      badRealTransformer.to(this.tx_eth_gas_fee),
      this.historyItemCateType,
      this.source_type,
      this._local_created_at,
      this._local_updated_at,
    ]);

    return stm;
  }

  static fillEntityFromLocalSend(
    e: LocalHistoryItemEntity,
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
        price: actionData?.send?.token.price || undefined,
      },
    ]);
    e.chain =
      findChain({
        id: input.chainId,
      })?.serverId ?? 'eth';
    e.status = input.isFailed ? 0 : 1;
    e.time_at = input.completedAt ? Math.floor(input.completedAt / 1000) : 0;
    e.cate_id = 'send';
    e.tx_name = '';
    e.token_approve_id = '';
    e.token_approve_value = 0;
    e.token_approve_spender = '';
    e.project_id = '';

    e.tx_from_address = input.address;
    e.tx_to_address = actionData?.send?.to || '';
    e.tx_usd_gas_fee = input.gasUSDValue ?? 0;
    e.tx_eth_gas_fee = input.gasTokenCount ?? 0;
    e.historyItemCateType = HistoryItemCateType.Send;
    e.source_type = input.$ctx?.ga?.source ?? '';

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
      .createQueryBuilder('localhistoryitem')
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
      .createQueryBuilder('localhistoryitem')
      .select('MAX(localhistoryitem.time_at)', 'maxTimeAt');

    if (owner_addr) {
      queryBuilder.where('localhistoryitem.owner_addr = :owner_addr', {
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

  static async getAllHistoryItemSortedByTime(
    owner_addrs: string[],
    count?: number,
  ) {
    await prepareAppDataSource();

    const repo = this.getRepository();

    const queryBuilder = repo
      .createQueryBuilder('localhistoryitem')
      .where('localhistoryitem.owner_addr IN (:...owner_addrs)', {
        owner_addrs,
      })
      .orderBy('localhistoryitem.time_at', 'DESC')
      .take(count || 10000); // limit

    const res = await queryBuilder.getMany();
    return res;
  }

  static async batchMultAddressSend(addresses: string[]) {
    await prepareAppDataSource();
    return await this.getRepository()
      .createQueryBuilder('localhistoryitem')
      .where('localhistoryitem.owner_addr IN (:...owner_addrs)', {
        owner_addrs: addresses,
      })
      .andWhere('localhistoryitem.source_type = :source_type', {
        source_type: 'sendToken',
      })
      .take(3)
      .getMany();
  }

  static async deleteForAddress(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr });
  }
}
