import { PreparedStatement } from '@op-engineering/op-sqlite';
import { KEYRING_TYPE, KeyringTypeName } from '@rabby-wallet/keyring-utils';
import { KeyringEventAccount } from '@rabby-wallet/service-keyring';
import 'reflect-metadata';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm/browser';

// @see ../../../node_modules/typeorm/browser/driver/react-native/ReactNativeDriver.js
// see all types supported by driver from it
export class EntityBaseWithoutId extends BaseEntity {
  @CreateDateColumn({ type: 'integer' }) _local_created_at: number = Date.now();
  @UpdateDateColumn({ type: 'integer' }) _local_updated_at: number = Date.now();
}

type OwnerAddress = string;

export abstract class EntityAddressAssetBase extends EntityBaseWithoutId {
  @PrimaryColumn({ type: 'text' })
  _db_id: `${OwnerAddress}${string}` = '0x-';

  abstract makeDbId(): string;

  @Column('text')
  owner_addr: string = '0x';

  static getStatementSql?(type?: 'upsert'): string;

  /**
   * bind parameters for upsert operation
   */
  bindUpsertParams?(stm: PreparedStatement): PreparedStatement;
}

export abstract class EntityAccountBase extends BaseEntity {
  @PrimaryColumn({ type: 'text' })
  _db_id: `${string}${string}${string}` = '0x-';

  @CreateDateColumn({ type: 'integer' }) created_at: number = Date.now();
  @CreateDateColumn({ type: 'integer' }) updated_at?: number = Date.now();

  static buildDBId(account: KeyringEventAccount) {
    return [
      account.address.toLowerCase(),
      account.type,
      account.brandName,
    ].join('-');
  }

  // abstract makeDbId(): string;
  protected makeDbId(): string {
    return (this._db_id = EntityAccountBase.buildDBId({
      address: this.address,
      type: this.type,
      brandName: this.brandName,
    }));
  }

  // address
  @Column({ type: 'text', default: '' })
  address: string = '0x';
  // type
  @Column({ type: 'text', default: '' })
  type: KeyringTypeName = KEYRING_TYPE.WatchAddressKeyring;
  // brandName
  @Column({ type: 'text', default: '' })
  brandName: string = '';
}
