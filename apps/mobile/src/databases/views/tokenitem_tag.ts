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
  ObjectLiteral,
  SelectQueryBuilder,
  LessThan,
  NotBrackets,
  PrimaryColumn,
} from 'typeorm/browser';
import { ASSET_EXPIRED_TIME } from '@/constant/expireTime';
import { EMPTY_TOKEN_ITEM_ID } from '@/constant/assets';
import { prepareAppDataSource } from '../imports';
import { CACHE_TABLES, getFullTableName, TEMP_TABLES } from '../constant';
import { ITokenSetting } from '@/core/services/preference';
import { ViewBaseWithoutId } from './base';
import { correctBadRealOnSql } from '../entities/_helpers';
import { type TokenItemEntity } from '../entities/tokenitem';
import { OPSQLiteEvents } from '@/core/databases/op-sqlite/events';

const DROP_TABLE_SQL = `DROP TABLE IF EXISTS ${TEMP_TABLES.tokenitem_tag};`;
const CREATE_TABLE_SQL = `
  CREATE TABLE ${TEMP_TABLES.tokenitem_tag} (
    _db_id TEXT PRIMARY KEY NOT NULL,
    owner_addr TEXT NOT NULL,
    token_usd_value REAL NOT NULL DEFAULT 0,
    is_natural_unfold BOOLEAN NOT NULL DEFAULT 1,
    is_manual_unfold BOOLEAN NOT NULL DEFAULT 0,
    is_manual_fold BOOLEAN NOT NULL DEFAULT 0,
    is_natural_included_for_balance BOOLEAN NOT NULL DEFAULT 0,
    is_manual_included_for_balance BOOLEAN NOT NULL DEFAULT 0,
    is_manual_excluded_for_balance BOOLEAN NOT NULL DEFAULT 0,

    is_low_value BOOLEAN NOT NULL DEFAULT 0,
    final_is_unfold BOOLEAN NOT NULL DEFAULT 0,
    final_is_included_for_balance BOOLEAN NOT NULL DEFAULT 0,

    UNIQUE (_db_id)
  );
`;
const CLAEN_TABLE_SQL = `
  DROP VIEW IF EXISTS ${TEMP_TABLES.tokenitem_tag};
  DROP TABLE IF EXISTS ${TEMP_TABLES.tokenitem_tag};
`;

@Entity('tokenitem_tag_view', { synchronize: false })
export class TokenItemTagView extends ViewBaseWithoutId {
  @Column('text')
  owner_addr: string = '';

  @Column('real')
  token_usd_value: number = 0;

  @Column({ type: 'boolean', default: 0 })
  is_natural_unfold: boolean = false;

  @Column({ type: 'boolean', default: 0 })
  is_manual_unfold: boolean = false;

  @Column({ type: 'boolean', default: 0 })
  is_manual_fold: boolean = false;

  @Column({ type: 'boolean', default: 0 })
  is_natural_included_for_balance: boolean = false;

  @Column({ type: 'boolean', default: 0 })
  is_manual_included_for_balance: boolean = false;

  @Column({ type: 'boolean', default: 0 })
  is_manual_excluded_for_balance: boolean = false;

  @Column({ type: 'boolean', default: 0 })
  is_low_value: boolean = false;

  private static _waitTemplateTableTagReady: Promise<void> = new Promise(
    resolve => {
      OPSQLiteEvents.once('ASSET_TOKEN_TAG_TABLE_READY', () => {
        resolve();
      });
    },
  );
  static async waitTagViewReady() {
    return TokenItemTagView._waitTemplateTableTagReady;
  }
  static async __tempTableTag__(
    payload:
      | {
          action: 'on_bootstrap';
        }
      | {
          action: 'tagtemp' | 'tagview';
          statics: Awaited<ReturnType<typeof TokenItemEntity.getStaticsInfo>>;
          token_settings: ITokenSetting;
        },
  ) {
    const dataSource = await prepareAppDataSource();
    const queryRunner = dataSource.createQueryRunner();

    switch (payload.action) {
      case 'on_bootstrap': {
        await queryRunner.query(DROP_TABLE_SQL);
        const result = await queryRunner.query(CREATE_TABLE_SQL).catch(err => {
          console.error('[debug] __tempTableTag__:: on_bootstrap error', err);
          throw err;
        });
        console.debug('[debug] __tempTableTag__:: on_bootstrap result', result);
        OPSQLiteEvents.emit('ASSET_TOKEN_TAG_TABLE_READY');

        break;
      }
      case 'tagtemp': {
        await TokenItemTagView.waitTagViewReady();

        const token_settings = payload.token_settings;
        const statics = payload.statics;
        const pinedQueue = token_settings.pinedQueue || [];
        const noPinned = pinedQueue.length === 0;

        const join_chain_token_id = (chainId: string, tokenId: string) =>
          `${chainId}+${tokenId}`;

        const manual_unfold_setting_ids =
          token_settings.unfoldTokens?.map(x =>
            join_chain_token_id(x.chainId, x.tokenId),
          ) || [];
        const manual_fold_setting_ids =
          token_settings.foldTokens?.map(x =>
            join_chain_token_id(x.chainId, x.tokenId),
          ) || [];
        const manual_include_balance_setting_ids =
          token_settings.includeDefiAndTokens
            ?.filter(x => x.type === 'token')
            .map(x => join_chain_token_id(x.chainid, x.id)) || [];
        const manual_exclude_balance_setting_ids =
          token_settings.excludeDefiAndTokens
            ?.filter(x => x.type === 'token')
            .map(x => join_chain_token_id(x.chainid, x.id)) || [];

        /**
         * @description for token,
         * is_natural_included_for_balance = (is_core == true)
         */
        const TAG_SQL = /* sql */ `
            INSERT OR REPLACE INTO ${TEMP_TABLES.tokenitem_tag} (
              _db_id,
              owner_addr,
              token_usd_value,
              is_natural_unfold,
              is_manual_unfold,
              is_manual_fold,
              is_natural_included_for_balance,
              is_manual_included_for_balance,
              is_manual_excluded_for_balance,

              is_low_value,
              final_is_unfold,
              final_is_included_for_balance
            )
            SELECT
              _db_id, owner_addr, token_usd_value, is_natural_unfold, is_manual_unfold, is_manual_fold, is_natural_included_for_balance, is_manual_included_for_balance, is_manual_excluded_for_balance,
              CASE
                WHEN is_core != 1
                  AND ((is_natural_unfold != 1 AND is_manual_unfold != 1) OR is_manual_fold = 1)
                  AND token_usd_value = 0
                THEN 1 ELSE 0
              END AS is_low_value,
              CASE WHEN (is_natural_unfold = 1 OR is_manual_unfold = 1) AND is_manual_fold != 1 THEN 1 ELSE 0 END AS final_is_unfold,
              CASE WHEN (is_natural_included_for_balance = 1 OR is_manual_included_for_balance = 1) AND is_manual_excluded_for_balance != 1 THEN 1 ELSE 0 END AS final_is_included_for_balance
            FROM (
              SELECT
                ti._db_id as _db_id,
                ti.owner_addr as owner_addr,
                ti.is_core as is_core,
                ${correctBadRealOnSql('ti.price')} * ${correctBadRealOnSql(
          'ti.amount',
        )} AS token_usd_value,
                CASE
                  WHEN ti.is_core = 1 ${
                    !statics.hasExpandSwitch
                      ? ''
                      : `AND ( ${correctBadRealOnSql(
                          'ti.price',
                        )} * ${correctBadRealOnSql('ti.amount')} ) >= ${
                          statics.threshold
                        }`
                  } THEN 1 ELSE 0
                END AS is_natural_unfold,
                CASE
                  WHEN ${
                    manual_unfold_setting_ids.length
                      ? `CONCAT(ti.chain, '+', ti.id) IN (${manual_unfold_setting_ids
                          .map(x => `'${x}'`)
                          .join(',')})`
                      : '1 = 0'
                  } THEN 1 ELSE 0
                END AS is_manual_unfold,
                CASE
                  WHEN ${
                    manual_fold_setting_ids.length
                      ? `CONCAT(ti.chain, '+', ti.id) IN (${manual_fold_setting_ids
                          .map(x => `'${x}'`)
                          .join(',')})`
                      : '1 = 0'
                  } THEN 1 ELSE 0
                END AS is_manual_fold,
                CASE
                  WHEN ti.is_core = 1 THEN 1 ELSE 0
                END AS is_natural_included_for_balance,
                CASE
                  WHEN ${
                    manual_include_balance_setting_ids.length
                      ? `CONCAT(ti.chain, '+', ti.id) IN (${manual_include_balance_setting_ids
                          .map(x => `'${x}'`)
                          .join(',')})`
                      : '1 = 0'
                  } THEN 1 ELSE 0
                END AS is_manual_included_for_balance,
                CASE
                  WHEN ${
                    manual_exclude_balance_setting_ids.length
                      ? `CONCAT(ti.chain, '+', ti.id) IN (${manual_exclude_balance_setting_ids
                          .map(x => `'${x}'`)
                          .join(',')})`
                      : '1 = 0'
                  } THEN 1 ELSE 0
                END AS is_manual_excluded_for_balance
              FROM ${getFullTableName('tokenitem')} ti
              ${
                statics.addresses?.length
                  ? `WHERE ti.owner_addr IN (${statics.addresses
                      .map(x => `'${x}'`)
                      .join(',')})`
                  : ''
              }
            ) as base;
          `;

        const result = await queryRunner.query(TAG_SQL).catch(err => {
          console.error('[debug] __tempTableTag__:: tag error', err);
          throw err;
        });

        console.debug('[debug] __tempTableTag__::tag result', result);

        break;
      }
    }
  }
}
