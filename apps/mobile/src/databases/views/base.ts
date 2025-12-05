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
export class ViewBaseWithoutId extends BaseEntity {
  @CreateDateColumn({ type: 'integer' }) _local_created_at: number = Date.now();
  @UpdateDateColumn({ type: 'integer' }) _local_updated_at: number = Date.now();
}

type OwnerAddress = string;

export abstract class ViewBase extends ViewBaseWithoutId {
  @PrimaryColumn({ type: 'text' })
  _db_id: `${OwnerAddress}${string}` = '';
}
