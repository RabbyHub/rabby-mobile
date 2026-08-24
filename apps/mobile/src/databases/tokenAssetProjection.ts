import type { DataSource } from 'typeorm/browser';

import type { TokenDisplayMode } from '@/types/assets';
import { EMPTY_TOKEN_ITEM_ID } from '@/constant/assets';
import { correctBadRealOnSql } from './entities/_helpers';
import { TokenItemEntity } from './entities/tokenitem';
import { prepareAppDataSource } from './imports';

export const TOKEN_ASSET_SQL_PROJECTION_RULE_VERSION = 1;

export const TOKEN_ASSET_SQL_SEGMENTS = [
  'primary',
  'additionalDefault',
  'additionalLp',
  'lowValueDefault',
  'lowValueLp',
] as const;

export type TokenAssetSqlProjectionSegment =
  (typeof TOKEN_ASSET_SQL_SEGMENTS)[number];

export type TokenAssetSqlProjectionScene = 'single-address' | 'multi-address';

export type TokenAssetSqlProjectionRow = {
  segment: TokenAssetSqlProjectionSegment;
  position: number;
  primaryResourceId: string;
  groupKey?: string;
  memberResourceIds: string[];
  totalAmount: number;
  totalUsdValue: number;
  logoUrl: string;
  isCore: boolean | null;
};

export type TokenAssetSqlProjection = {
  ruleVersion: number;
  scene: TokenAssetSqlProjectionScene;
  tokenDisplayMode: TokenDisplayMode;
  rows: TokenAssetSqlProjectionRow[];
  resourceIds: string[];
};

type RawProjectionRow = {
  segment: string;
  position: number | bigint | string;
  source_bucket: 'default' | 'deferred';
  primary_resource_id: string;
  group_key: string;
  total_amount: number | bigint | string | null;
  total_usd_value: number | bigint | string | null;
  logo_url: string | null;
  is_core: number | bigint | string | null;
};

type RawProjectionMember = {
  source_bucket: 'default' | 'deferred';
  group_key: string;
  resource_id: string;
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

const parseNullableBoolean = (value: unknown): boolean | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return Number(value) !== 0;
};

const isProjectionSegment = (
  value: string,
): value is TokenAssetSqlProjectionSegment =>
  TOKEN_ASSET_SQL_SEGMENTS.includes(value as TokenAssetSqlProjectionSegment);

const getSourceBucketForSegment = (segment: TokenAssetSqlProjectionSegment) =>
  segment === 'lowValueDefault' || segment === 'lowValueLp'
    ? 'deferred'
    : 'default';

const buildProjectionSql = ({
  tableName,
  addresses,
  chainServerId,
  scene,
  tokenDisplayMode,
  membersOnly,
}: {
  tableName: string;
  addresses: string[];
  chainServerId?: string;
  scene: TokenAssetSqlProjectionScene;
  tokenDisplayMode: TokenDisplayMode;
  membersOnly: boolean;
}) => {
  const addressPlaceholders = addresses.map(() => '?').join(', ');
  const ownerOrder = addresses
    .map((_, index) => `WHEN ? THEN ${index}`)
    .join(' ');
  const chainPredicate = chainServerId ? 'AND lower(tokenitem.chain) = ?' : '';
  const isMultiAddress = scene === 'multi-address';
  // The token cache still persists amount/price with the legacy x18
  // transformer, while usd_value may lag behind those source fields.
  const normalizedAmount = correctBadRealOnSql('tokenitem.amount');
  const normalizedPrice = correctBadRealOnSql('tokenitem.price');
  const normalizedUsdValue = `(${normalizedPrice} * ${normalizedAmount})`;
  const sourceBucket = isMultiAddress
    ? `CASE
         WHEN tokenitem.is_verified = 0
           OR COALESCE(tokenitem.is_suspicious, 0) != 0 THEN 'excluded'
         WHEN tokenitem.is_core IS NULL
           AND ${normalizedUsdValue} = 0 THEN 'deferred'
         ELSE 'default'
       END`
    : `CASE
         WHEN tokenitem.is_verified = 0
           OR COALESCE(tokenitem.is_suspicious, 0) != 0
           OR (
             ${normalizedUsdValue} = 0
             AND COALESCE(tokenitem.is_core, 0) != 1
           ) THEN 'deferred'
         ELSE 'default'
       END`;
  const groupKey =
    tokenDisplayMode === 'bySymbol'
      ? `COALESCE(
           NULLIF(lower(trim(optimized_symbol)), ''),
           NULLIF(lower(trim(display_symbol)), ''),
           NULLIF(lower(trim(symbol)), ''),
           lower(chain) || '::' || lower(token_id)
         )`
      : tokenDisplayMode === 'byAsset'
      ? "lower(chain) || '::' || lower(token_id)"
      : 'resource_id';

  const sharedCtes = `
    WITH deduplicated AS (
      SELECT
        tokenitem.*,
        ROW_NUMBER() OVER (
          PARTITION BY lower(tokenitem.projection_resource_id)
          ORDER BY tokenitem._local_updated_at DESC, tokenitem._db_id ASC
        ) AS resource_rank
      FROM ${quoteIdentifier(tableName)} tokenitem
      WHERE lower(tokenitem.owner_addr) IN (${addressPlaceholders})
        AND tokenitem.id != ?
        AND tokenitem.amount > 0
        AND tokenitem.projection_resource_id != ''
        ${chainPredicate}
    ),
    base_unordered AS (
      SELECT
        lower(tokenitem.projection_resource_id) AS resource_id,
        lower(tokenitem.owner_addr) AS owner_addr,
        lower(tokenitem.chain) AS chain,
        lower(tokenitem.id) AS token_id,
        tokenitem.optimized_symbol AS optimized_symbol,
        tokenitem.display_symbol AS display_symbol,
        tokenitem.symbol AS symbol,
        tokenitem.logo_url AS logo_url,
        tokenitem.is_core AS is_core,
        tokenitem.is_verified AS is_verified,
        tokenitem.is_suspicious AS is_suspicious,
        tokenitem.protocol_id AS protocol_id,
        ${normalizedAmount} AS amount_value,
        ${normalizedUsdValue} AS usd_value,
        CASE lower(tokenitem.owner_addr) ${ownerOrder}
          ELSE ${addresses.length}
        END AS owner_order,
        ${sourceBucket} AS source_bucket
      FROM deduplicated tokenitem
      WHERE tokenitem.resource_rank = 1
    ),
    base AS (
      SELECT
        base_unordered.*,
        ROW_NUMBER() OVER (
          ORDER BY
            owner_order ASC,
            CASE WHEN is_core = 1 THEN 0 ELSE 1 END ASC,
            usd_value DESC,
            resource_id ASC
        ) AS source_order
      FROM base_unordered
    ),
    prepared AS (
      SELECT base.*, ${groupKey} AS group_key
      FROM base
      WHERE source_bucket != 'excluded'
    )`;

  if (membersOnly) {
    return `${sharedCtes}
      SELECT source_bucket, group_key, resource_id
      FROM prepared
      ORDER BY source_bucket ASC, group_key ASC, source_order ASC
    `;
  }

  return `${sharedCtes},
    ranked_groups AS (
      SELECT
        prepared.*,
        ROW_NUMBER() OVER (
          PARTITION BY source_bucket, group_key
          ORDER BY usd_value DESC, source_order ASC, resource_id ASC
        ) AS group_rank,
        SUM(amount_value) OVER (
          PARTITION BY source_bucket, group_key
        ) AS total_amount,
        SUM(usd_value) OVER (
          PARTITION BY source_bucket, group_key
        ) AS total_usd_value,
        MIN(source_order) OVER (
          PARTITION BY source_bucket, group_key
        ) AS group_source_order
      FROM prepared
    ),
    aggregated AS (
      SELECT
        source_bucket,
        group_key,
        resource_id AS primary_resource_id,
        total_amount,
        total_usd_value,
        group_source_order AS source_order,
        logo_url,
        is_core,
        is_verified,
        is_suspicious,
        protocol_id
      FROM ranked_groups
      WHERE group_rank = 1
    ),
    core_totals AS (
      SELECT
        SUM(CASE WHEN source_bucket = 'default' AND is_core = 1 THEN 1 ELSE 0 END)
          AS core_count,
        SUM(CASE WHEN source_bucket = 'default' AND is_core = 1
          THEN total_usd_value ELSE 0 END) AS core_total_value
      FROM aggregated
    ),
    threshold_stats AS (
      SELECT
        core_count,
        CASE
          WHEN COALESCE(core_total_value, 0) / 100.0 < 1000.0
            THEN COALESCE(core_total_value, 0) / 100.0
          ELSE 1000.0
        END AS threshold
      FROM core_totals
    ),
    visibility_stats AS (
      SELECT
        threshold_stats.*,
        (
          SELECT COUNT(*)
          FROM aggregated
          WHERE source_bucket = 'default'
            AND is_core = 1
            AND total_usd_value < threshold_stats.threshold
        ) AS below_threshold_count
      FROM threshold_stats
    ),
    decorated AS (
      SELECT
        aggregated.*,
        CASE
          WHEN source_bucket = 'default'
            AND is_core = 1
            AND (
              NOT (
                visibility_stats.core_count > 3
                AND visibility_stats.below_threshold_count >= 4
              )
              OR total_usd_value >= visibility_stats.threshold
            ) THEN 1
          ELSE 0
        END AS is_default_visible
      FROM aggregated
      CROSS JOIN visibility_stats
    ),
    visible_ranked AS (
      SELECT
        decorated.*,
        ROW_NUMBER() OVER (
          ORDER BY total_usd_value DESC, source_order ASC, primary_resource_id ASC
        ) AS visible_position
      FROM decorated
      WHERE source_bucket = 'default' AND is_default_visible = 1
    ),
    remaining_unordered AS (
      SELECT
        source_bucket, group_key, primary_resource_id, total_amount,
        total_usd_value, source_order, logo_url, is_core, is_verified,
        is_suspicious, protocol_id
      FROM visible_ranked
      WHERE visible_position > 20
      UNION ALL
      SELECT
        source_bucket, group_key, primary_resource_id, total_amount,
        total_usd_value, source_order, logo_url, is_core, is_verified,
        is_suspicious, protocol_id
      FROM decorated
      WHERE source_bucket = 'default' AND is_default_visible = 0
    ),
    remaining_ranked AS (
      SELECT
        remaining_unordered.*,
        ROW_NUMBER() OVER (
          ORDER BY
            CASE
              WHEN is_core = 1 AND total_usd_value > 0 THEN 0
              WHEN is_core = 1 THEN 2
              ELSE 1
            END ASC,
            total_usd_value DESC,
            source_order ASC,
            primary_resource_id ASC
        ) AS remaining_position
      FROM remaining_unordered
    ),
    primary_rows AS (
      SELECT
        'primary' AS segment,
        visible_position - 1 AS position,
        source_bucket, group_key, primary_resource_id, total_amount,
        total_usd_value, logo_url, is_core
      FROM visible_ranked
      WHERE visible_position <= 20
    ),
    additional_default_rows AS (
      SELECT
        'additionalDefault' AS segment,
        ROW_NUMBER() OVER (
          ORDER BY remaining_position ASC
        ) - 1 AS position,
        source_bucket, group_key, primary_resource_id, total_amount,
        total_usd_value, logo_url, is_core
      FROM remaining_ranked
      WHERE (is_verified IS NULL OR is_verified != 0)
        AND COALESCE(is_suspicious, 0) = 0
        AND (is_core IS NULL OR is_core != 0)
        AND (COALESCE(is_core, 0) != 0 OR COALESCE(protocol_id, '') = '')
    ),
    additional_lp_rows AS (
      SELECT
        'additionalLp' AS segment,
        ROW_NUMBER() OVER (
          ORDER BY remaining_position ASC
        ) - 1 AS position,
        source_bucket, group_key, primary_resource_id, total_amount,
        total_usd_value, logo_url, is_core
      FROM remaining_ranked
      WHERE (is_verified IS NULL OR is_verified != 0)
        AND COALESCE(is_suspicious, 0) = 0
        AND COALESCE(is_core, 0) = 0
        AND COALESCE(protocol_id, '') != ''
    ),
    low_value_default_rows AS (
      SELECT
        'lowValueDefault' AS segment,
        ROW_NUMBER() OVER (
          ORDER BY source_order ASC, primary_resource_id ASC
        ) - 1 AS position,
        source_bucket, group_key, primary_resource_id, total_amount,
        total_usd_value, logo_url, is_core
      FROM decorated
      WHERE source_bucket = 'deferred'
        AND (is_verified IS NULL OR is_verified != 0)
        AND COALESCE(is_suspicious, 0) = 0
        AND (is_core IS NULL OR is_core != 0)
        AND (COALESCE(is_core, 0) != 0 OR COALESCE(protocol_id, '') = '')
    ),
    low_value_lp_rows AS (
      SELECT
        'lowValueLp' AS segment,
        ROW_NUMBER() OVER (
          ORDER BY source_order ASC, primary_resource_id ASC
        ) - 1 AS position,
        source_bucket, group_key, primary_resource_id, total_amount,
        total_usd_value, logo_url, is_core
      FROM decorated
      WHERE source_bucket = 'deferred'
        AND (is_verified IS NULL OR is_verified != 0)
        AND COALESCE(is_suspicious, 0) = 0
        AND COALESCE(is_core, 0) = 0
        AND COALESCE(protocol_id, '') != ''
    ),
    projection_rows AS (
      SELECT * FROM primary_rows
      UNION ALL SELECT * FROM additional_default_rows
      UNION ALL SELECT * FROM additional_lp_rows
      UNION ALL SELECT * FROM low_value_default_rows
      UNION ALL SELECT * FROM low_value_lp_rows
    )
    SELECT *
    FROM projection_rows
    ORDER BY
      CASE segment
        WHEN 'primary' THEN 0
        WHEN 'additionalDefault' THEN 1
        WHEN 'additionalLp' THEN 2
        WHEN 'lowValueDefault' THEN 3
        ELSE 4
      END ASC,
      position ASC
  `;
};

export async function compileTokenAssetSqlProjection(
  {
    addresses: rawAddresses,
    chainServerId,
    scene,
    tokenDisplayMode = 'byAddress',
  }: {
    addresses: string[];
    chainServerId?: string;
    scene: TokenAssetSqlProjectionScene;
    tokenDisplayMode?: TokenDisplayMode;
  },
  dataSource?: DataSource,
): Promise<TokenAssetSqlProjection> {
  const addresses = normalizeAddresses(rawAddresses);
  if (!addresses.length) {
    return {
      ruleVersion: TOKEN_ASSET_SQL_PROJECTION_RULE_VERSION,
      scene,
      tokenDisplayMode,
      rows: [],
      resourceIds: [],
    };
  }

  const source = dataSource || (await prepareAppDataSource());
  const tableName = source.getRepository(TokenItemEntity).metadata.tableName;
  const grouped = scene === 'multi-address' && tokenDisplayMode !== 'byAddress';
  // SQL placeholders encounter the owner filter before the owner-order CASE.
  const normalizedParams = [
    ...addresses,
    EMPTY_TOKEN_ITEM_ID,
    ...(chainServerId ? [chainServerId.toLowerCase()] : []),
    ...addresses,
  ];
  const rawRows = (await source.query(
    buildProjectionSql({
      tableName,
      addresses,
      chainServerId,
      scene,
      tokenDisplayMode: grouped ? tokenDisplayMode : 'byAddress',
      membersOnly: false,
    }),
    normalizedParams,
  )) as RawProjectionRow[];

  const membersByGroup = new Map<string, string[]>();
  if (grouped && rawRows.length) {
    const rawMembers = (await source.query(
      buildProjectionSql({
        tableName,
        addresses,
        chainServerId,
        scene,
        tokenDisplayMode,
        membersOnly: true,
      }),
      normalizedParams,
    )) as RawProjectionMember[];
    rawMembers.forEach(member => {
      const key = `${member.source_bucket}\u0000${member.group_key}`;
      const members = membersByGroup.get(key) || [];
      members.push(member.resource_id.toLowerCase());
      membersByGroup.set(key, members);
    });
  }

  const resourceIds = new Set<string>();
  const rows = rawRows.map(rawRow => {
    if (!isProjectionSegment(rawRow.segment)) {
      throw new Error(
        `Unsupported token SQL projection segment: ${rawRow.segment}`,
      );
    }
    const primaryResourceId = rawRow.primary_resource_id.toLowerCase();
    const memberResourceIds = grouped
      ? membersByGroup.get(
          `${getSourceBucketForSegment(rawRow.segment)}\u0000${
            rawRow.group_key
          }`,
        ) || []
      : [primaryResourceId];
    if (!memberResourceIds.length) {
      throw new Error(
        `Token SQL projection group has no members: ${rawRow.group_key}`,
      );
    }
    memberResourceIds.forEach(resourceId => resourceIds.add(resourceId));

    return {
      segment: rawRow.segment,
      position: toFiniteNumber(rawRow.position),
      primaryResourceId,
      groupKey: grouped ? rawRow.group_key : undefined,
      memberResourceIds,
      totalAmount: toFiniteNumber(rawRow.total_amount),
      totalUsdValue: toFiniteNumber(rawRow.total_usd_value),
      logoUrl: rawRow.logo_url || '',
      isCore: parseNullableBoolean(rawRow.is_core),
    };
  });

  return {
    ruleVersion: TOKEN_ASSET_SQL_PROJECTION_RULE_VERSION,
    scene,
    tokenDisplayMode: grouped ? tokenDisplayMode : 'byAddress',
    rows,
    resourceIds: Array.from(resourceIds),
  };
}
