import type { DataSource } from 'typeorm/browser';

import { EMPTY_PROTOCOL_ITEM_ID } from '@/constant/assets';
import { formatNetworth } from '@/utils/math';
import { ProtocolItemEntity } from './entities/portocolItem';
import { prepareAppDataSource } from './imports';

export const PROTOCOL_ASSET_SQL_PROJECTION_RULE_VERSION = 1;

export type ProtocolAssetSqlProjectionScene =
  | 'single-address'
  | 'multi-address';

export type ProtocolAssetSqlProjection = {
  ruleVersion: number;
  scene: ProtocolAssetSqlProjectionScene;
  protocolIds: string[];
  defaultVisibleProtocolCount: number;
  foldedProtocolUsdValue: string;
};

type RawProtocolProjectionRow = {
  resource_id: string;
  default_visible_count: number | bigint | string | null;
  folded_positive_usd_value: number | bigint | string | null;
};

const normalizeAddresses = (addresses: string[]) =>
  Array.from(
    new Set(addresses.map(address => address.trim().toLowerCase())),
  ).filter(Boolean);

const quoteIdentifier = (identifier: string) =>
  `"${identifier.replace(/"/g, '""')}"`;

const toFiniteNumber = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildProjectionSql = ({
  tableName,
  addresses,
  chainServerId,
}: {
  tableName: string;
  addresses: string[];
  chainServerId?: string;
}) => {
  const addressPlaceholders = addresses.map(() => '?').join(', ');
  const ownerOrder = addresses
    .map((_, index) => `WHEN ? THEN ${index}`)
    .join(' ');
  const chainPredicate = chainServerId
    ? 'AND lower(protocolitem.chain) = ?'
    : '';

  return `
    WITH deduplicated AS (
      SELECT
        protocolitem.*,
        ROW_NUMBER() OVER (
          PARTITION BY lower(protocolitem.projection_resource_id)
          ORDER BY protocolitem._local_updated_at DESC, protocolitem._db_id ASC
        ) AS resource_rank
      FROM ${quoteIdentifier(tableName)} protocolitem
      WHERE lower(protocolitem.owner_addr) IN (${addressPlaceholders})
        AND protocolitem.id != ?
        AND protocolitem.projection_resource_id != ''
        ${chainPredicate}
    ),
    ordered AS (
      SELECT
        lower(protocolitem.projection_resource_id) AS resource_id,
        COALESCE(protocolitem.net_worth, 0) AS net_worth,
        MAX(COALESCE(protocolitem.positive_real_usd_value, 0), 0)
          AS positive_real_usd_value,
        CASE lower(protocolitem.owner_addr) ${ownerOrder}
          ELSE ${addresses.length}
        END AS owner_order,
        COALESCE(protocolitem.source_order, 0) AS source_order
      FROM deduplicated protocolitem
      WHERE protocolitem.resource_rank = 1
    ),
    stats AS (
      SELECT
        COUNT(*) AS protocol_count,
        CASE
          WHEN COALESCE(SUM(net_worth), 0) / 1000.0 < 1000.0
            THEN COALESCE(SUM(net_worth), 0) / 1000.0
          ELSE 1000.0
        END AS threshold
      FROM ordered
    ),
    visibility AS (
      SELECT
        stats.protocol_count,
        stats.threshold,
        SUM(CASE WHEN ordered.net_worth < stats.threshold THEN 1 ELSE 0 END)
          AS below_threshold_count
      FROM stats
      LEFT JOIN ordered ON 1 = 1
      GROUP BY stats.protocol_count, stats.threshold
    ),
    decorated AS (
      SELECT
        ordered.*,
        visibility.threshold,
        CASE
          WHEN visibility.protocol_count > 3
            AND visibility.below_threshold_count >= 4 THEN 1
          ELSE 0
        END AS has_default_limit
      FROM ordered
      CROSS JOIN visibility
    )
    SELECT
      resource_id,
      SUM(
        CASE
          WHEN has_default_limit = 0 OR net_worth >= threshold THEN 1
          ELSE 0
        END
      ) OVER () AS default_visible_count,
      SUM(
        CASE
          WHEN has_default_limit = 1 AND net_worth < threshold
            THEN positive_real_usd_value
          ELSE 0
        END
      ) OVER () AS folded_positive_usd_value
    FROM decorated
    ORDER BY
      CASE
        WHEN has_default_limit = 1 AND net_worth < threshold THEN 1
        ELSE 0
      END ASC,
      net_worth DESC,
      owner_order ASC,
      source_order ASC,
      resource_id ASC
  `;
};

export async function compileProtocolAssetSqlProjection(
  {
    addresses: rawAddresses,
    chainServerId,
    scene,
  }: {
    addresses: string[];
    chainServerId?: string;
    scene: ProtocolAssetSqlProjectionScene;
  },
  dataSource?: DataSource,
): Promise<ProtocolAssetSqlProjection> {
  const addresses = normalizeAddresses(rawAddresses);
  if (!addresses.length) {
    return {
      ruleVersion: PROTOCOL_ASSET_SQL_PROJECTION_RULE_VERSION,
      scene,
      protocolIds: [],
      defaultVisibleProtocolCount: 0,
      foldedProtocolUsdValue: '',
    };
  }

  const source = dataSource || (await prepareAppDataSource());
  const tableName = source.getRepository(ProtocolItemEntity).metadata.tableName;
  const params = [
    ...addresses,
    EMPTY_PROTOCOL_ITEM_ID,
    ...(chainServerId ? [chainServerId.toLowerCase()] : []),
    ...addresses,
  ];
  const rows = (await source.query(
    buildProjectionSql({
      tableName,
      addresses,
      chainServerId,
    }),
    params,
  )) as RawProtocolProjectionRow[];

  if (!rows.length) {
    return {
      ruleVersion: PROTOCOL_ASSET_SQL_PROJECTION_RULE_VERSION,
      scene,
      protocolIds: [],
      defaultVisibleProtocolCount: 0,
      foldedProtocolUsdValue: '',
    };
  }

  const foldedProtocolUsdValue = toFiniteNumber(
    rows[0]?.folded_positive_usd_value,
  );
  return {
    ruleVersion: PROTOCOL_ASSET_SQL_PROJECTION_RULE_VERSION,
    scene,
    protocolIds: rows.map(row => row.resource_id.toLowerCase()),
    defaultVisibleProtocolCount: toFiniteNumber(rows[0]?.default_visible_count),
    foldedProtocolUsdValue:
      foldedProtocolUsdValue > 0
        ? formatNetworth(foldedProtocolUsdValue, false, '$')
        : '',
  };
}
