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
import { columnConverter, realTransformer } from './_helpers';
import { prepareAppDataSource } from '../imports';

@Entity('historyitem')
export class HistoryItemEntity extends EntityAddressAssetBase {
  // is_scam
  @Column('boolean')
  is_scam: TxHistoryItem['is_scam'] = false;
  // id
  @Column('text', { default: '' })
  txHash: TxHistoryItem['id'] = '0x';

  // project_id
  @Column('text', { default: '' })
  project_id: TxHistoryItem['project_id'] = '0x';

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
  token_approve_id: string = '0x';

  // token_approve_spender
  @Column('text', { default: '' })
  token_approve_spender: string = '0x';
  // token_approve_value
  @Column('real', {
    transformer: realTransformer,
  })
  token_approve_value: number = 0;

  // tx_from_address
  @Column('text', { default: '' })
  tx_from_address: string = '0x';

  // tx_usd_gas_fee
  @Column('real', {
    transformer: realTransformer,
  })
  tx_usd_gas_fee: number = 0;

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

    e.is_scam = input.is_scam ?? false;
    e.txHash = input.id ?? '0x';
    e.receives = JSON.stringify(input.receives);
    e.sends = JSON.stringify(input.sends);
    e.chain = input.chain ?? 'eth';
    e.status = input.tx?.status ?? 0;
    e.time_at = input.time_at ?? 0;
    e.cate_id = input.cate_id ?? '';
    e.tx_name = input.tx?.name ?? '';
    e.token_approve_id = input.token_approve?.token_id ?? '0x';
    e.token_approve_value = input.token_approve?.value ?? 0;
    e.token_approve_spender = input.token_approve?.spender ?? '0x';

    e.tx_from_address = input.tx?.from_addr ?? '0x';
    e.tx_usd_gas_fee = input.tx?.usd_gas_fee ?? 0;

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

  static async getLatestTime(owner_addr: string) {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const result = await repo
      .createQueryBuilder('historyitem')
      .select('MIN(historyitem.time_at)', 'minTimeAt')
      .where('historyitem.owner_addr = :owner_addr', { owner_addr })
      .getRawOne();

    if (!result.minTimeAt) {
      return false;
    }
    // const firstUpdateTime = parseInt(result.minTimeAt, 10);
    return result.minTimeAt;
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
