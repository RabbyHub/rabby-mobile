import 'reflect-metadata';
import { SwapItem, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
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
import { prepareAppDataSource } from '../imports';
import { monitorDBQuery } from '../performance';

@Entity('cache_swapitem')
export class SwapItemEntity extends EntityAddressAssetBase {
  // tx_id
  @Column('text', { default: '' })
  tx_id: SwapItem['tx_id'] = '';

  // chain
  @Column('text', { default: '' })
  chain: SwapItem['chain'] = '';

  // status
  @Column('text', { default: '' })
  status: SwapItem['status'] = 'Finished';

  // create_at
  @Column('integer')
  create_at: SwapItem['create_at'] = 0;

  makeDbId(): string {
    return (this._db_id = `${this.owner_addr}-${[this.chain, this.tx_id]
      .filter(Boolean)
      .join('-')}`);
  }

  static fillEntity(e: SwapItemEntity, owner_addr: string, input: SwapItem) {
    e.owner_addr = owner_addr;
    e.tx_id = input.tx_id;
    e.chain = input.chain;
    e.status = input.status;
    e.create_at = input.create_at;

    e.makeDbId();
  }

  @monitorDBQuery({ entity: 'SwapItemEntity', method: 'getAllHistoryItem' })
  static async getAllHistoryItem(owner_addrs: string[], count?: number) {
    await prepareAppDataSource();

    return await this.getRepository()
      .createQueryBuilder('swapitem')
      .where('swapitem.owner_addr IN (:...owner_addrs)', { owner_addrs })
      .orderBy('swapitem.create_at', 'DESC')
      .take(count || 10000)
      .getMany();
  }

  @monitorDBQuery({ entity: 'SwapItemEntity', method: 'getCountOfAccount' })
  static async getCountOfAccount() {
    await prepareAppDataSource();

    const repo = this.getRepository();

    const result = await repo
      .createQueryBuilder('swapitem')
      .select('COUNT(DISTINCT (`owner_addr`))', 'uniqueChainAddressCount')
      .getRawOne();

    return result.uniqueChainAddressCount as number;
  }

  @monitorDBQuery({ entity: 'SwapItemEntity', method: 'getCount' })
  static async getCount() {
    await prepareAppDataSource();

    return this.getRepository().count();
  }

  @monitorDBQuery({ entity: 'SwapItemEntity', method: 'getLatestTime' })
  static async getLatestTime(owner_addr: string): Promise<number> {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const result = await repo
      .createQueryBuilder('swapitem')
      .select('MAX(swapitem.create_at)', 'maxTimeAt')
      .where('swapitem.owner_addr = :owner_addr', { owner_addr })
      .getRawOne();

    if (!result.maxTimeAt) {
      return 0;
    }
    return result.maxTimeAt;
  }

  @monitorDBQuery({ entity: 'SwapItemEntity', method: 'batchQueryHistory' })
  static async batchQueryHistory(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().findBy({ owner_addr });
  }

  @monitorDBQuery({ entity: 'SwapItemEntity', method: 'deleteForAddress' })
  static async deleteForAddress(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr });
  }
}
