import 'reflect-metadata';
import { Entity, Column } from 'typeorm/browser';
import { EntityAddressAssetBase } from './base';
import { BALANCE_EXPIRED_TIME } from '@/constant/expireTime';
import { prepareAppDataSource } from '../imports';
import { columnConverter } from './_helpers';
import { EvmTotalBalanceResponse } from '../hooks/balance';
import { APP_DB_PREFIX, ORM_TABLE_NAMES } from '../constant';
import { PreparedStatement } from '@op-engineering/op-sqlite';

@Entity(ORM_TABLE_NAMES.cache_balance)
export class BalanceEntity extends EntityAddressAssetBase {
  // balance
  @Column('real')
  balance: number = 0;
  // evm balance
  @Column('real', { default: 0 })
  evm_usd_value: number = 0;
  // is_core
  @Column('boolean', { default: false })
  isCore: boolean = false;
  // chain_list
  @Column({
    type: 'text',
    default: '[]',
  })
  chain_list: string = '[]';

  makeDbId(): string {
    return (this._db_id = `${this.owner_addr}-${
      this.isCore ? 'core' : 'nocore'
    }`);
  }

  static fillEntity(
    e: BalanceEntity,
    owner_addr: string,
    isCore: boolean,
    input: EvmTotalBalanceResponse,
  ) {
    e.owner_addr = owner_addr;
    e.balance = input.total_usd_value;
    e.evm_usd_value = input.evm_usd_value || 0;
    e.chain_list = columnConverter.jsonObjToString(input.chain_list || []);
    e.isCore = !!isCore;
    e.makeDbId();
  }

  static stmSql = `
INSERT INTO "${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_balance}"
("_db_id", "owner_addr", "balance", "evm_usd_value", "chain_list", "isCore", "_local_created_at", "_local_updated_at")
VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT ( "_db_id" ) DO UPDATE SET "_local_updated_at" = EXCLUDED."_local_updated_at"
`;

  static getStatementSql() {
    return this.stmSql;
  }

  bindUpsertParams(stm: PreparedStatement): PreparedStatement {
    stm.bindSync([
      this._db_id,
      this.owner_addr,
      this.balance,
      this.evm_usd_value,
      this.chain_list,
      this.isCore,
      this._local_created_at,
      this._local_updated_at,
    ]);

    return stm;
  }

  static async getCountOfAccount() {
    await prepareAppDataSource();

    const repo = this.getRepository();

    const result = await repo
      .createQueryBuilder('balance')
      .select('COUNT(DISTINCT (`address`))', 'uniqueChainAddressCount')
      .getRawOne();

    return result.uniqueChainAddressCount as number;
  }

  static async getCount() {
    await prepareAppDataSource();

    return this.getRepository().count();
  }

  static async queryBalance(
    owner_addr: string,
    isCore: boolean,
  ): Promise<EvmTotalBalanceResponse> {
    await prepareAppDataSource();
    const result = await this.getRepository().findOneBy({
      owner_addr,
      isCore,
    });

    return {
      total_usd_value: result?.balance || 0,
      evm_usd_value: result?.evm_usd_value || 0,
      chain_list:
        columnConverter.jsonStringToObj(result?.chain_list || '[]') || [],
    };
  }

  static async queryChainList(
    address: string,
  ): Promise<EvmTotalBalanceResponse['chain_list']> {
    if (!address) {
      return [];
    }

    await prepareAppDataSource();

    const repo = this.getRepository();
    const result = await repo.findOne({
      where: {
        owner_addr: address,
      },
      select: {
        chain_list: true,
      },
    });

    return columnConverter.jsonStringToObj(result?.chain_list || '[]') || [];
  }

  static async isExpired(owner_addr: string, isCore: boolean) {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const result = await repo
      .createQueryBuilder('balance')
      .select('MIN(balance._local_updated_at)', 'minUpdatedAt')
      .where('balance.owner_addr = :owner_addr', { owner_addr })
      .andWhere('balance.isCore = :isCore', { isCore })
      .getRawOne();

    if (!result.minUpdatedAt) {
      return true;
    }
    const firstUpdateTime = parseInt(result.minUpdatedAt, 10);
    return Date.now() - firstUpdateTime > BALANCE_EXPIRED_TIME;
  }
  static async deleteForAddress(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr });
  }
  static async deleteForAddressCore(owner_addr: string, isCore: boolean) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr, isCore });
  }
}
