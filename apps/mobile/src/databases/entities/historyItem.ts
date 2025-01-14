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

@Entity('historyitem')
export class HistoryItemEntity extends EntityAddressAssetBase {
  // is_scam
  @Column('boolean')
  is_scam: TxHistoryItem['is_scam'] = false;
  // id
  @Column('text', { default: '' })
  txHash: TxHistoryItem['id'] = '0x';
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
  // token_approve_value
  @Column('integer', { default: '' })
  token_approve_value: number = 0;

  makeDbId(): string {
    return (this._db_id = `${this.address}-${[this.chain, this.txHash]
      .filter(Boolean)
      .join('-')}`);
  }

  static fillEntity(
    e: HistoryItemEntity,
    address: string,
    input: TxHistoryItem,
  ) {
    e.address = address;

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

    e.makeDbId();
  }

  static async getCountOfAccount() {
    const repo = this.getRepository();

    const result = await repo
      .createQueryBuilder('historyitem')
      .select('COUNT(DISTINCT (`address`))', 'uniqueChainAddressCount')
      .getRawOne();

    return result.uniqueChainAddressCount as number;
  }

  static async getCount() {
    return this.getRepository().count();
  }

  static async batchQueryHistory(address: string) {
    return this.getRepository().findBy({ address });
  }
}
