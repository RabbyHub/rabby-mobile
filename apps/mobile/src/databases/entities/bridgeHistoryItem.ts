import 'reflect-metadata';
import { BridgeHistory, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
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

@Entity('cache_bridgehistoryitem')
export class BridgeHistoryItemEntity extends EntityAddressAssetBase {
  // tx_id
  @Column('text', { default: '' })
  tx_id: string = '';

  // chain
  @Column('text', { default: '' })
  chain: string = '';

  // status
  @Column('text', { default: '' })
  status: BridgeHistory['status'] = 'completed';

  // from_tx_id
  @Column('text', { default: '' })
  from_tx_id: BridgeHistory['from_tx']['tx_id'] = '';

  // to_tx_id
  @Column('text', { default: '' })
  to_tx_id: BridgeHistory['to_tx']['tx_id'] = '';

  // from_chain
  @Column('text', { default: '' })
  from_chain: BridgeHistory['from_token']['chain'] = '';

  // to_chain
  @Column('text', { default: '' })
  to_chain: BridgeHistory['to_token']['chain'] = '';

  // from_token_id
  @Column('text', { default: '' })
  from_token_id: BridgeHistory['from_token']['id'] = '';

  // to_token_id
  @Column('text', { default: '' })
  to_token_id: BridgeHistory['to_token']['id'] = '';

  // from_token_amount
  @Column('real')
  from_token_amount: BridgeHistory['actual']['pay_token_amount'] = 0;

  // from_token_amount
  @Column('real')
  to_token_amount: BridgeHistory['actual']['receive_token_amount'] = 0;

  // create_at
  @Column('integer')
  create_at: BridgeHistory['create_at'] = 0;

  makeDbId(): string {
    return (this._db_id = `${this.owner_addr}-${[this.chain, this.tx_id]
      .filter(Boolean)
      .join('-')}`);
  }

  static fillEntity(
    e: BridgeHistoryItemEntity,
    owner_addr: string,
    input: BridgeHistory,
  ) {
    e.owner_addr = owner_addr;
    e.create_at = input.create_at;
    e.status = input.status;
    e.from_tx_id = input.from_tx?.tx_id || '';
    e.to_tx_id = input.to_tx?.tx_id || '';
    e.from_chain = input.from_token?.chain || '';
    e.to_chain = input.to_token?.chain || '';
    e.from_token_id = input.from_token?.id || '';
    e.to_token_id = input.to_token?.id || '';
    e.from_token_amount = input.actual?.pay_token_amount || 0;
    e.to_token_amount = input.actual?.receive_token_amount || 0;

    e.tx_id = e.from_tx_id + '-' + e.to_tx_id;
    e.chain = e.from_chain + '-' + e.to_chain;

    e.makeDbId();
  }

  static async getAllHistoryItem(owner_addrs: string[], count?: number) {
    await prepareAppDataSource();

    return await this.getRepository()
      .createQueryBuilder('bridgehistoryitem')
      .where('bridgehistoryitem.owner_addr IN (:...owner_addrs)', {
        owner_addrs,
      })
      .orderBy('bridgehistoryitem.create_at', 'DESC')
      .take(count || 10000)
      .getMany();
  }

  static async getCountOfAccount() {
    await prepareAppDataSource();

    const repo = this.getRepository();

    const result = await repo
      .createQueryBuilder('bridgehistoryitem')
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
      .createQueryBuilder('bridgehistoryitem')
      .select('MAX(bridgehistoryitem.create_at)', 'maxTimeAt')
      .where('bridgehistoryitem.owner_addr = :owner_addr', { owner_addr })
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

  static async deleteForAddress(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr });
  }
}
