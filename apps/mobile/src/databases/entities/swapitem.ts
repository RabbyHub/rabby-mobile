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
import { columnConverter, realTransformer } from './_helpers';
import { prepareAppDataSource } from '../imports';

@Entity('swapitem')
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

  static async getAllHistoryItem(owner_addr?: string) {
    await prepareAppDataSource();

    return await this.getRepository().findBy({ owner_addr });
  }

  static async getCountOfAccount() {
    await prepareAppDataSource();

    const repo = this.getRepository();

    const result = await repo
      .createQueryBuilder('swapitem')
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
      .createQueryBuilder('swapitem')
      .select('MAX(swapitem.create_at)', 'maxTimeAt')
      .where('swapitem.owner_addr = :owner_addr', { owner_addr })
      .getRawOne();

    if (!result.maxTimeAt) {
      return 0;
    }
    return result.maxTimeAt;
  }

  static async batchQueryHistory(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().findBy({ owner_addr });
  }

  static async getAllHistoryItemSortedByTime(
    owner_addr?: string,
    count: number = 100,
  ) {
    await prepareAppDataSource();

    const repo = this.getRepository();

    return await repo
      .createQueryBuilder('historyitem')
      // .where('historyitem.owner_addr = :owner_addr', { owner_addr })
      .orderBy('historyitem.time_at', 'DESC')
      .take(count) // limit 100
      .getMany();
  }

  static async deleteForAddress(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr });
  }
}
