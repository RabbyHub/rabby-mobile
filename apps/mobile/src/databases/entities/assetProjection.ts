import 'reflect-metadata';

import {
  BaseEntity,
  Column,
  Entity,
  Index,
  PrimaryColumn,
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
  'IDX_projection_snapshot_key_generation',
  ['projection_key', 'generation'],
  {
    unique: true,
  },
)
@Index('IDX_projection_snapshot_committed_at', ['committed_at'])
@Entity(ORM_TABLE_NAMES.projection_snapshot)
export class AssetProjectionSnapshotEntity extends BaseEntity {
  @PrimaryColumn({ type: 'text' })
  _db_id: string = '';

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

  static buildDbId(projectionKey: string, generation: number) {
    return JSON.stringify([projectionKey, generation]);
  }
}

@Index(
  'IDX_projection_item_key_generation_position',
  ['projection_key', 'generation', 'position'],
  {
    unique: true,
  },
)
@Index('IDX_projection_item_row_id', ['row_id'])
@Entity(ORM_TABLE_NAMES.projection_item)
export class AssetProjectionItemEntity extends BaseEntity {
  @PrimaryColumn({ type: 'text' })
  _db_id: string = '';

  @Column({ type: 'text' })
  projection_key: string = '';

  @Column({ type: 'integer' })
  generation: number = 0;

  @Column({ type: 'integer' })
  position: number = 0;

  @Column({ type: 'text' })
  row_type: AssetProjectionRowType = 'token';

  @Column({ type: 'text' })
  row_id: string = '';

  static buildDbId(
    projectionKey: string,
    generation: number,
    position: number,
  ) {
    return JSON.stringify([projectionKey, generation, position]);
  }
}

@Index(
  'IDX_projection_group_item_key_generation_group_position',
  ['projection_key', 'generation', 'group_id', 'position'],
  {
    unique: true,
  },
)
@Index('IDX_projection_group_item_member_id', ['member_id'])
@Entity(ORM_TABLE_NAMES.projection_group_item)
export class AssetProjectionGroupItemEntity extends BaseEntity {
  @PrimaryColumn({ type: 'text' })
  _db_id: string = '';

  @Column({ type: 'text' })
  projection_key: string = '';

  @Column({ type: 'integer' })
  generation: number = 0;

  @Column({ type: 'text' })
  group_id: string = '';

  @Column({ type: 'integer' })
  position: number = 0;

  @Column({ type: 'text' })
  member_id: string = '';

  static buildDbId(
    projectionKey: string,
    generation: number,
    groupId: string,
    position: number,
  ) {
    return JSON.stringify([projectionKey, generation, groupId, position]);
  }
}
