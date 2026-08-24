import type { DataSource } from 'typeorm/browser';

import { createMemoryAppDataSource } from '../../test-support/database/createMemoryAppDataSource';
import { ProtocolItemEntity } from './entities/portocolItem';
import { buildProtocolProjectionResourceId } from './protocolProjectionResourceId';
import { compileProtocolAssetSqlProjection } from './protocolAssetProjection';

const OWNER_A = '0xAa';
const OWNER_B = '0xBb';

const resourceId = (owner: string, chain: string, id: string) =>
  `${owner.toLowerCase()}:${chain.toLowerCase()}:${id.toLowerCase()}`;

const createProtocol = ({
  id,
  netWorth,
  owner = OWNER_A,
  chain = 'eth',
  positiveUsdValue = netWorth,
  sourceOrder = 0,
}: {
  id: string;
  netWorth: number;
  owner?: string;
  chain?: string;
  positiveUsdValue?: number;
  sourceOrder?: number;
}) => {
  const entity = new ProtocolItemEntity();
  entity.owner_addr = owner.toLowerCase();
  entity.id = id;
  entity.chain = chain;
  entity.name = id;
  entity.net_worth = netWorth;
  entity.positive_real_usd_value = positiveUsdValue;
  entity.source_order = sourceOrder;
  entity.projection_resource_id = buildProtocolProjectionResourceId(
    owner,
    chain,
    id,
  );
  entity.makeDbId();
  return entity;
};

describe('protocol asset SQL projection', () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    dataSource = undefined;
  });

  it('preserves net-worth order and stable source order across addresses', async () => {
    dataSource = await createMemoryAppDataSource();
    await dataSource.getRepository(ProtocolItemEntity).save([
      createProtocol({ id: 'a-second', netWorth: 10, sourceOrder: 1 }),
      createProtocol({ id: 'a-first', netWorth: 10, sourceOrder: 0 }),
      createProtocol({
        id: 'b-first',
        netWorth: 10,
        owner: OWNER_B,
        sourceOrder: 0,
      }),
      createProtocol({ id: 'largest', netWorth: 20, owner: OWNER_B }),
    ]);

    const projection = await compileProtocolAssetSqlProjection(
      {
        addresses: [OWNER_A, OWNER_B],
        scene: 'multi-address',
      },
      dataSource,
    );

    expect(projection.protocolIds).toEqual([
      resourceId(OWNER_B, 'eth', 'largest'),
      resourceId(OWNER_A, 'eth', 'a-first'),
      resourceId(OWNER_A, 'eth', 'a-second'),
      resourceId(OWNER_B, 'eth', 'b-first'),
    ]);
  });

  it('keeps the existing threshold fold and folded positive value semantics', async () => {
    dataSource = await createMemoryAppDataSource();
    const values = [1000, 100, 0.5, 0.4, 0.3, 0.2];
    await dataSource.getRepository(ProtocolItemEntity).save(
      values.map((netWorth, index) =>
        createProtocol({
          id: `protocol-${index}`,
          netWorth,
          positiveUsdValue: index >= 2 ? netWorth : 0,
          sourceOrder: index,
        }),
      ),
    );

    const projection = await compileProtocolAssetSqlProjection(
      { addresses: [OWNER_A], scene: 'single-address' },
      dataSource,
    );

    expect(projection.protocolIds.slice(0, 2)).toEqual([
      resourceId(OWNER_A, 'eth', 'protocol-0'),
      resourceId(OWNER_A, 'eth', 'protocol-1'),
    ]);
    expect(projection.defaultVisibleProtocolCount).toBe(2);
    expect(projection.foldedProtocolUsdValue).toBe('$1.40');
  });

  it('keeps every protocol visible when fewer than four are below threshold', async () => {
    dataSource = await createMemoryAppDataSource();
    const values = [1000, 100, 10, 0.5, 0.4, 0.3];
    await dataSource.getRepository(ProtocolItemEntity).save(
      values.map((netWorth, index) =>
        createProtocol({
          id: `protocol-${index}`,
          netWorth,
          sourceOrder: index,
        }),
      ),
    );

    const projection = await compileProtocolAssetSqlProjection(
      { addresses: [OWNER_A], scene: 'single-address' },
      dataSource,
    );

    expect(projection.defaultVisibleProtocolCount).toBe(values.length);
    expect(projection.foldedProtocolUsdValue).toBe('');
  });

  it('applies chain filtering without changing the source table', async () => {
    dataSource = await createMemoryAppDataSource();
    await dataSource
      .getRepository(ProtocolItemEntity)
      .save([
        createProtocol({ id: 'eth-protocol', netWorth: 1 }),
        createProtocol({ id: 'arb-protocol', netWorth: 2, chain: 'arb' }),
      ]);

    const projection = await compileProtocolAssetSqlProjection(
      {
        addresses: [OWNER_A],
        chainServerId: 'ARB',
        scene: 'single-address',
      },
      dataSource,
    );

    expect(projection.protocolIds).toEqual([
      resourceId(OWNER_A, 'arb', 'arb-protocol'),
    ]);
  });
});
