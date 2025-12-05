import 'reflect-metadata';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import {
  Entity,
  Column,
  In,
  Brackets,
  Not,
  MoreThan,
  Raw,
  PrimaryColumn,
} from 'typeorm/browser';
import { EntityInMemoryBase } from './base';

import {
  type IManageToken,
  type IManageNft,
  type IDefiOrToken,
  type ITokenSetting,
} from '@/core/services/preference';
import { INMEMORY_PREFIX } from '../constant';
import { obj2query } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { prepareAppDataSource } from '../imports';

type EMPTY_POS = '';
const EMPTY_POS = '';

type AssetType = 'token' | 'nft' | 'defi';
type MarkType = 'pin' | 'fold' | 'unfold' | 'include' | 'exclude';

type SavePayload = Parameters<
  (typeof IMUserAssetsSettingsEntity)['fillEntity']
>[1];

@Entity(`${INMEMORY_PREFIX}user_assets_settings`)
export class IMUserAssetsSettingsEntity extends EntityInMemoryBase {
  @PrimaryColumn('text', { type: 'text' })
  _db_id: string = '';

  // @Column('text')
  // owner_addr: string = '0x';

  @Column('text', { default: '' })
  asset_id: string = '';

  @Column('text', { default: '' })
  chain_id: string = '';

  @Column('text', { default: EMPTY_POS })
  asset_type: AssetType | EMPTY_POS = EMPTY_POS;

  @Column('text', { default: EMPTY_POS })
  mark: MarkType | EMPTY_POS = EMPTY_POS;

  makeDbId(): string {
    return (this._db_id = obj2query({
      asset_id: this.asset_id,
      chain_id: this.chain_id,
      asset_type: this.asset_type,
      mark: this.mark,
    }));
  }

  static fillEntity(
    e: IMUserAssetsSettingsEntity,
    payload:
      | {
          asset_type: AssetType & 'token';
          asset: IManageToken;
          mark: MarkType;
        }
      | {
          asset_type: AssetType & 'nft';
          asset: IManageNft;
          mark: MarkType & ('fold' | 'unfold');
        }
      | {
          asset_type: AssetType & 'defi';
          asset: IDefiOrToken;
          mark: MarkType & ('include' | 'exclude');
        },
  ) {
    // e.owner_addr = owner_addr;

    switch (payload.asset_type) {
      case 'token': {
        e.asset_id = payload.asset.tokenId;
        e.chain_id = payload.asset.chainId;
        e.asset_type = 'token';
        e.mark = payload.mark;
        break;
      }
      case 'nft': {
        e.asset_id = payload.asset.id;
        e.chain_id = payload.asset.chain;
        e.asset_type = 'nft';
        e.mark = payload.mark;
        break;
      }
      case 'defi': {
        e.asset_id = payload.asset.id;
        e.chain_id = payload.asset.chainid;
        e.asset_type = 'defi';
        e.mark = payload.mark;
        break;
      }
    }

    e.makeDbId();
  }

  static async persistAssetSetting(
    payload: SavePayload | SavePayload[],
    options?: {
      clearBeforePersistBy?: {
        asset_type: AssetType;
        mark: MarkType | MarkType[];
      };
    },
  ) {
    await prepareAppDataSource();

    const list = Array.isArray(payload) ? payload : [payload];
    const dataList = list.map(item => {
      const inst = new IMUserAssetsSettingsEntity();
      IMUserAssetsSettingsEntity.fillEntity(inst, item);
      return inst;
    });

    const repo = IMUserAssetsSettingsEntity.getRepository();

    if (options?.clearBeforePersistBy) {
      const { asset_type, mark } = options.clearBeforePersistBy;
      const markList = Array.isArray(mark) ? mark : [mark];
      await repo.manager.delete(IMUserAssetsSettingsEntity, {
        asset_type,
        mark: In(markList),
      });
    }

    return repo.manager.upsert(IMUserAssetsSettingsEntity, dataList, {
      conflictPaths: ['_db_id'],
    });
  }

  static async debugGetAllSettings() {
    if (!__DEV__) return [];

    await prepareAppDataSource();

    const repo = IMUserAssetsSettingsEntity.getRepository();

    return repo.find();
  }
}
