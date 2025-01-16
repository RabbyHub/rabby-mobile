import 'reflect-metadata';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  PrimaryColumn,
  PrimaryGeneratedColumn,
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
  address: string = '0x';
}
