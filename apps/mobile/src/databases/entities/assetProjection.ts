import 'reflect-metadata';

import {
  BaseEntity,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm/browser';

import { ORM_TABLE_NAMES } from '../constant';

export type AssetProjectionKind = 'token' | 'protocol' | 'nft';
export type AssetProjectionScene = 'single-address' | 'multi-address';
export type AssetProjectionRowType =
  | 'token'
  | 'token-group'
  | 'protocol'
  | 'nft'
  | 'nft-collection';

@Index(
  'IDX_projection_snapshot_20260818_key_generation',
  ['projection_key', 'generation'],
  {
    unique: true,
  },
)
@Index('IDX_projection_snapshot_20260818_committed_at', ['committed_at'])
@Entity(ORM_TABLE_NAMES.projection_snapshot)
export class AssetProjectionSnapshotEntity extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  _db_id!: number;

  @Column({ type: 'text' })
  projection_key: string = '';

  @Column({ type: 'integer' })
  generation: number = 0;

  @Column({ type: 'text' })
  projection_kind: AssetProjectionKind = 'token';

  @Column({ type: 'text' })
  scene: AssetProjectionScene = 'single-address';

  @Column({ type: 'integer' })
  rule_version: number = 1;

  @Column({ type: 'integer' })
  item_count: number = 0;

  @Column({ type: 'integer' })
  group_item_count: number = 0;

  @Column({ type: 'text', default: '{}' })
  metadata_json: string = '{}';

  @Column({ type: 'integer' })
  committed_at: number = 0;
}

@Index(
  'IDX_projection_item_20260818_snapshot_position',
  ['snapshot_id', 'position'],
  {
    unique: true,
  },
)
@Index('IDX_projection_item_20260818_row_id', ['row_id'])
@Entity(ORM_TABLE_NAMES.projection_item)
export class AssetProjectionItemEntity extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  _db_id!: number;

  @Column({ type: 'integer' })
  snapshot_id: number = 0;

  @Column({ type: 'integer' })
  position: number = 0;

  @Column({ type: 'text' })
  row_type: AssetProjectionRowType = 'token';

  @Column({ type: 'text' })
  row_id: string = '';
}

@Index(
  'IDX_projection_group_item_20260818_snapshot_group_position',
  ['snapshot_id', 'group_id', 'position'],
  {
    unique: true,
  },
)
@Index('IDX_projection_group_item_20260818_member_id', ['member_id'])
@Entity(ORM_TABLE_NAMES.projection_group_item)
export class AssetProjectionGroupItemEntity extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  _db_id!: number;

  @Column({ type: 'integer' })
  snapshot_id: number = 0;

  @Column({ type: 'text' })
  group_id: string = '';

  @Column({ type: 'integer' })
  position: number = 0;

  @Column({ type: 'text' })
  member_id: string = '';
}
