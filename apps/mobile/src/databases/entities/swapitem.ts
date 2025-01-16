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
  tx_id: SwapItem['tx_id'] = '0x';

  // chain
  @Column('text', { default: '' })
  chain: SwapItem['chain'] = '0x';

  // status
  @Column('text', { default: '' })
  status: SwapItem['status'] = 'Finished';

  // create_at
  @Column('integer')
  create_at: SwapItem['create_at'] = 0;

  makeDbId(): string {
    return (this._db_id = `${this.address}-${[this.chain, this.tx_id]
      .filter(Boolean)
      .join('-')}`);
  }

  static fillEntity(e: SwapItemEntity, address: string, input: SwapItem) {
    e.address = address;
    e.tx_id = input.tx_id;
    e.chain = input.chain;
    e.status = input.status;
    e.create_at = input.create_at;

    e.makeDbId();
  }

  static async getAllHistoryItem(address?: string) {
    await prepareAppDataSource();

    return await this.getRepository().findBy({ address });
  }

  static async getCountOfAccount() {
    await prepareAppDataSource();

    const repo = this.getRepository();

    const result = await repo
      .createQueryBuilder('swapitem')
      .select('COUNT(DISTINCT (`address`))', 'uniqueChainAddressCount')
      .getRawOne();

    return result.uniqueChainAddressCount as number;
  }

  static async getCount() {
    await prepareAppDataSource();

    return this.getRepository().count();
  }

  static async getLatestTime(address: string) {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const result = await repo
      .createQueryBuilder('swapitem')
      .select('MIN(swapitem.create_at)', 'minTimeAt')
      .where('swapitem.address = :address', { address })
      .getRawOne();

    if (!result.minTimeAt) {
      return false;
    }
    // const firstUpdateTime = parseInt(result.minTimeAt, 10);
    return result.minTimeAt;
  }

  static async batchQueryHistory(address: string) {
    await prepareAppDataSource();

    return this.getRepository().findBy({ address });
  }

  static async deleteForAddress(address: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ address });
  }
}
