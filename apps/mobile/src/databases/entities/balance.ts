import 'reflect-metadata';
import { Entity, Column } from 'typeorm';
import { EntityAddressAssetBase } from './base';
import { BALANCE_EXPIRED_TIME } from '@/constant/expireTime';
import { prepareAppDataSource } from '../imports';
import { TotalBalanceResponse } from '@rabby-wallet/rabby-api/dist/types';
import { columnConverter } from './_helpers';

@Entity('cache_balance')
export class BalanceEntity extends EntityAddressAssetBase {
  // balance
  @Column('real')
  balance: number = 0;
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
    input: TotalBalanceResponse,
  ) {
    e.owner_addr = owner_addr;
    e.balance = input.total_usd_value;
    e.chain_list = columnConverter.jsonObjToString(
      input.chain_list.slice(0, 2) || [],
    );
    e.isCore = !!isCore;
    e.makeDbId();
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
  ): Promise<TotalBalanceResponse> {
    await prepareAppDataSource();
    const result = await this.getRepository().findOneBy({
      owner_addr,
      isCore,
    });

    return {
      total_usd_value: result?.balance || 0,
      chain_list:
        columnConverter.jsonStringToObj(result?.chain_list || '[]') || [],
    };
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
