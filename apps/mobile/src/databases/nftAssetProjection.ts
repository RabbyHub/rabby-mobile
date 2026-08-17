import type { DataSource } from 'typeorm/browser';

import { EMPTY_NFT_ITEM_ID } from '@/constant/assets';
import { NFTItemEntity } from './entities/nftItem';
import { prepareAppDataSource } from './imports';

export const NFT_ASSET_SQL_PROJECTION_RULE_VERSION = 1;

export type NftAssetSqlProjectionScene = 'single-address' | 'multi-address';

export type NftAssetSqlProjectionRow =
  | {
      type: 'nft';
      nftId: string;
    }
  | {
      type: 'collection';
      collectionId: string;
      memberNftIds: string[];
    };

export type NftAssetSqlProjection = {
  ruleVersion: number;
  scene: NftAssetSqlProjectionScene;
  rows: NftAssetSqlProjectionRow[];
  resourceIds: string[];
  defaultVisibleRowCount: number;
};

type RawNftProjectionRow = {
  candidate_type: 'nft' | 'collection';
  candidate_id: string;
  resource_id: string;
  credit_score: number | bigint | string | null;
  default_visible: number | bigint | string | null;
};

type ProjectionCandidate = {
  type: 'nft' | 'collection';
  id: string;
  memberNftIds: string[];
  creditScore: number;
  defaultVisible: boolean;
  stableKey: string;
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
  const chainPredicate = chainServerId ? 'AND lower(nftitem.chain) = ?' : '';
  const resourceId = [
    "lower(COALESCE(nftitem.owner_addr, ''))",
    "lower(COALESCE(nftitem.chain, ''))",
    "lower(COALESCE(nftitem.collection_id, ''))",
    "lower(COALESCE(nftitem.id, ''))",
    "lower(COALESCE(nftitem.inner_id, ''))",
  ].join(" || ':' || ");

  return `
    WITH deduplicated AS (
      SELECT
        nftitem.*,
        ${resourceId} AS resource_id,
        ROW_NUMBER() OVER (
          PARTITION BY ${resourceId}
          ORDER BY nftitem._local_updated_at DESC, nftitem._db_id ASC
        ) AS resource_rank
      FROM ${quoteIdentifier(tableName)} nftitem
      WHERE lower(nftitem.owner_addr) IN (${addressPlaceholders})
        AND nftitem.id != ?
        ${chainPredicate}
    ),
    normalized AS (
      SELECT
        resource_id,
        lower(COALESCE(owner_addr, '')) AS owner_addr,
        lower(COALESCE(chain, '')) AS item_chain,
        lower(COALESCE(collection_id, '')) AS collection_id,
        CASE
          WHEN json_valid(collection) = 1 THEN collection
          ELSE '{}'
        END AS collection_json,
        CASE
          WHEN COALESCE(collection_id, '') != ''
            AND COALESCE(collection, '') != ''
            AND json_valid(collection) = 1 THEN 1
          ELSE 0
        END AS has_collection
      FROM deduplicated
      WHERE resource_rank = 1
    ),
    prepared AS (
      SELECT
        CASE WHEN has_collection = 1 THEN 'collection' ELSE 'nft' END
          AS candidate_type,
        CASE
          WHEN has_collection = 1 THEN
            owner_addr || '::' ||
            lower(COALESCE(
              NULLIF(CAST(json_extract(collection_json, '$.chain') AS TEXT), ''),
              item_chain
            )) || '::' ||
            lower(COALESCE(
              CAST(json_extract(collection_json, '$.id') AS TEXT),
              ''
            ))
          ELSE resource_id
        END AS candidate_id,
        resource_id,
        COALESCE(
          CAST(json_extract(collection_json, '$.credit_score') AS REAL),
          0
        ) AS credit_score,
        CASE
          WHEN COALESCE(
            CAST(json_extract(collection_json, '$.is_core') AS INTEGER),
            0
          ) != 0
          AND COALESCE(
            CAST(json_extract(collection_json, '$.is_hidden') AS INTEGER),
            0
          ) = 0 THEN 1
          ELSE 0
        END AS default_visible
      FROM normalized
    )
    SELECT
      candidate_type,
      candidate_id,
      resource_id,
      MAX(credit_score) OVER (
        PARTITION BY candidate_type, candidate_id
      ) AS credit_score,
      MAX(default_visible) OVER (
        PARTITION BY candidate_type, candidate_id
      ) AS default_visible
    FROM prepared
    ORDER BY candidate_type ASC, candidate_id ASC, resource_id ASC
  `;
};

const buildCandidates = (rows: RawNftProjectionRow[]) => {
  const candidateMap = new Map<string, ProjectionCandidate>();

  rows.forEach(row => {
    const type = row.candidate_type;
    const id = row.candidate_id.toLowerCase();
    const stableKey = `${type}:${id}`;
    const existing = candidateMap.get(stableKey);
    if (existing) {
      if (!existing.memberNftIds.includes(row.resource_id.toLowerCase())) {
        existing.memberNftIds.push(row.resource_id.toLowerCase());
      }
      return;
    }

    candidateMap.set(stableKey, {
      type,
      id,
      memberNftIds: [row.resource_id.toLowerCase()],
      creditScore: toFiniteNumber(row.credit_score),
      defaultVisible: toFiniteNumber(row.default_visible) !== 0,
      stableKey,
    });
  });

  candidateMap.forEach(candidate => candidate.memberNftIds.sort());
  return Array.from(candidateMap.values());
};

export async function compileNftAssetSqlProjection(
  {
    addresses: rawAddresses,
    chainServerId,
    scene,
    previousRowKeys = [],
  }: {
    addresses: string[];
    chainServerId?: string;
    scene: NftAssetSqlProjectionScene;
    previousRowKeys?: string[];
  },
  dataSource?: DataSource,
): Promise<NftAssetSqlProjection> {
  const addresses = normalizeAddresses(rawAddresses);
  if (!addresses.length) {
    return {
      ruleVersion: NFT_ASSET_SQL_PROJECTION_RULE_VERSION,
      scene,
      rows: [],
      resourceIds: [],
      defaultVisibleRowCount: 0,
    };
  }

  const source = dataSource || (await prepareAppDataSource());
  const tableName = source.getRepository(NFTItemEntity).metadata.tableName;
  const rows = (await source.query(
    buildProjectionSql({ tableName, addresses, chainServerId }),
    [
      ...addresses,
      EMPTY_NFT_ITEM_ID,
      ...(chainServerId ? [chainServerId.toLowerCase()] : []),
    ],
  )) as RawNftProjectionRow[];
  const previousPosition = new Map(
    previousRowKeys.map((key, index) => [key, index]),
  );
  const candidates = buildCandidates(rows);

  candidates.sort((left, right) => {
    if (left.defaultVisible !== right.defaultVisible) {
      return left.defaultVisible ? -1 : 1;
    }
    const scoreDelta = right.creditScore - left.creditScore;
    if (scoreDelta) {
      return scoreDelta;
    }
    const leftPosition = previousPosition.get(left.stableKey);
    const rightPosition = previousPosition.get(right.stableKey);
    if (leftPosition !== undefined || rightPosition !== undefined) {
      return (
        (leftPosition ?? Number.MAX_SAFE_INTEGER) -
        (rightPosition ?? Number.MAX_SAFE_INTEGER)
      );
    }
    return left.stableKey.localeCompare(right.stableKey);
  });

  return {
    ruleVersion: NFT_ASSET_SQL_PROJECTION_RULE_VERSION,
    scene,
    rows: candidates.map(candidate =>
      candidate.type === 'collection'
        ? {
            type: 'collection',
            collectionId: candidate.id,
            memberNftIds: candidate.memberNftIds,
          }
        : { type: 'nft', nftId: candidate.id },
    ),
    resourceIds: Array.from(
      new Set(candidates.flatMap(candidate => candidate.memberNftIds)),
    ),
    defaultVisibleRowCount: candidates.filter(
      candidate => candidate.defaultVisible,
    ).length,
  };
}
