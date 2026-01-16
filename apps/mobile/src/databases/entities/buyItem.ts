import 'reflect-metadata';
import { BuyHistoryItem } from '@rabby-wallet/rabby-api/dist/types';
import { Entity, Column } from 'typeorm/browser';
import { EntityAddressAssetBase } from './base';
import { prepareAppDataSource } from '../imports';
import { columnConverter } from './_helpers';
import { APP_DB_PREFIX, ORM_TABLE_NAMES } from '../constant';
import { PreparedStatement } from '@op-engineering/op-sqlite';

@Entity(ORM_TABLE_NAMES.cache_buy_order)
export class BuyItemEntity extends EntityAddressAssetBase {
  @Column('text', { default: '' })
  id: string = '';

  @Column('text', { default: '' })
  user_addr: string = '';

  @Column('text', { default: '' })
  status: BuyHistoryItem['status'] = 'success';

  @Column('integer')
  create_at: BuyHistoryItem['create_at'] = 0;

  @Column('text', { default: '{}' })
  service_provider: string = '{}';

  @Column('text', { default: null })
  service_provider_url: string | null = null;

  @Column('text', { default: '' })
  pay_usd_amount: string = '0';

  @Column('text', { default: '' })
  pay_currency_code: string = '';

  @Column('text', { default: '' })
  payment_type: string = '';

  @Column('text', { default: '' })
  receive_chain_id: BuyHistoryItem['receive_chain_id'] = '';

  @Column('text', { default: '' })
  receive_tx_id: BuyHistoryItem['receive_tx_id'] = '';

  @Column('text', { default: '' })
  receive_amount: string = '';

  @Column('text', { default: '' })
  receive_token_id: string = '';

  @Column('text', { default: '{}' })
  receive_token: string = '{}';

  makeDbId(): string {
    return (this._db_id = `${this.owner_addr}-${[this.receive_chain_id, this.id]
      .filter(Boolean)
      .join('-')}`);
  }

  static fillEntity(
    e: BuyItemEntity,
    owner_addr: string,
    input: BuyHistoryItem,
  ) {
    e.owner_addr = owner_addr;
    e.id = input.id;
    e.user_addr = input.user_addr;
    e.status = input.status;
    e.create_at = input.create_at;
    e.service_provider = columnConverter.jsonObjToString(
      input.service_provider,
    );
    e.service_provider_url = input.service_provider_url;
    e.pay_usd_amount = input.pay_usd_amount + '';
    e.payment_type = input.payment_type;
    e.receive_chain_id = input.receive_chain_id;
    e.receive_tx_id = input.receive_tx_id ?? '';
    e.receive_token_id = input.receive_token_id;
    e.receive_amount = input.receive_amount + '';
    e.receive_token = columnConverter.jsonObjToString(input.receive_token);
    e.pay_currency_code = input.pay_currency_code;

    e.makeDbId();
  }

  static stmSql = `
  INSERT INTO "${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_buy_order}"
  ("_db_id", "owner_addr", "id", "user_addr", "status", "create_at", "service_provider", "service_provider_url", "pay_usd_amount", "pay_currency_code", "payment_type", "receive_chain_id", "receive_tx_id", "receive_amount", "receive_token", "_local_created_at", "_local_updated_at")
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT ( "_db_id" ) DO UPDATE SET "_local_updated_at" = EXCLUDED."_local_updated_at"
  `;

  static getStatementSql() {
    return this.stmSql;
  }

  bindUpsertParams(stm: PreparedStatement): PreparedStatement {
    stm.bindSync([
      this._db_id,
      this.owner_addr,
      this.id,
      this.user_addr,
      this.status,
      this.create_at,
      this.service_provider,
      this.service_provider_url,
      this.pay_usd_amount,
      this.pay_currency_code,
      this.payment_type,
      this.receive_chain_id,
      this.receive_tx_id,
      this.receive_amount,
      this.receive_token,
      this._local_created_at,
      this._local_updated_at,
    ]);

    return stm;
  }

  static async getAllHistoryItem(owner_addrs: string[], count?: number) {
    await prepareAppDataSource();

    return (
      await this.getRepository()
        .createQueryBuilder('buy_order')
        .where('buy_order.owner_addr IN (:...owner_addrs)', { owner_addrs })
        .orderBy('buy_order.create_at', 'DESC')
        .take(count || 10000)
        .getMany()
    ).map(i => ({
      ...i,
      service_provider: columnConverter.jsonStringToObj(i.service_provider),
      receive_token: columnConverter.jsonStringToObj(i.receive_token),
    }));
  }

  static async getCountOfAccount() {
    await prepareAppDataSource();

    const repo = this.getRepository();

    const result = await repo
      .createQueryBuilder('buy_order')
      .select('COUNT(DISTINCT (`owner_addr`))', 'uniqueChainAddressCount')
      .getRawOne();

    return result.uniqueChainAddressCount as number;
  }

  static async getCount() {
    await prepareAppDataSource();

    return this.getRepository().count();
  }

  static async getLatestTime(owner_addr: string): Promise<number> {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const result = await repo
      .createQueryBuilder('buy_order')
      .select('MAX(buy_order.create_at)', 'maxTimeAt')
      .where('buy_order.owner_addr = :owner_addr', { owner_addr })
      .getRawOne();

    if (!result.maxTimeAt) {
      return 0;
    }
    return result.maxTimeAt;
  }

  static async getAllPending(owner_addr: string) {
    await prepareAppDataSource();

    return (
      await this.getRepository()
        .createQueryBuilder('buy_order')
        .where('buy_order.owner_addr = :owner_addr', { owner_addr })
        .andWhere('buy_order.status = :status', { status: 'pending' })
        .orderBy('buy_order.create_at', 'DESC')
        .getMany()
    ).map(i => ({
      ...i,
      service_provider: columnConverter.jsonStringToObj(i.service_provider),
      receive_token: columnConverter.jsonStringToObj(i.receive_token),
    }));
  }

  static async batchQueryHistory(owner_addr: string) {
    await prepareAppDataSource();

    return (await this.getRepository().findBy({ owner_addr })).map(i => ({
      ...i,
      service_provider: columnConverter.jsonStringToObj(i.service_provider),
      receive_token: columnConverter.jsonStringToObj(i.receive_token),
    }));
  }

  static async deleteForAddress(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr });
  }
}
