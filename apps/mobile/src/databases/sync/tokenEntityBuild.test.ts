import type { ITokenItem } from '@/types/assets';

jest.mock('../entities/tokenitem', () => {
  class TokenItemEntity {
    static fillEntity(
      entity: Record<string, unknown>,
      ownerAddress: string,
      input: Record<string, unknown>,
    ) {
      Object.assign(entity, input, { owner_addr: ownerAddress });
    }
  }

  return { TokenItemEntity };
});

import { buildTokenEntitiesCooperatively } from './tokenEntityBuild';

const token = (id: string, isCore: boolean): ITokenItem =>
  ({
    id,
    chain: 'eth',
    is_core: isCore,
    cex_ids: [],
  } as ITokenItem);

describe('buildTokenEntitiesCooperatively', () => {
  it('preserves core-first ordering and fills persisted entity metadata', async () => {
    const result = await buildTokenEntitiesCooperatively(
      '0xOwner',
      [token('non-core', false), token('core', true)],
      1234,
    );

    expect(result?.tokens.map(item => item.id)).toEqual(['core', 'non-core']);
    expect(result?.tokenItems.map(item => item.id)).toEqual([
      'core',
      'non-core',
    ]);
    expect(result?.tokenItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          owner_addr: '0xOwner',
          _local_updated_at: 1234,
        }),
      ]),
    );
  });

  it('retains the empty-address sentinel', async () => {
    const result = await buildTokenEntitiesCooperatively('0xEmpty', [], 5678);

    expect(result?.tokens).toHaveLength(1);
    expect(result?.tokenItems).toHaveLength(1);
    expect(result?.tokenItems[0]).toEqual(
      expect.objectContaining({
        owner_addr: '0xEmpty',
        _local_updated_at: 5678,
      }),
    );
  });

  it('yields between bounded slices without changing the result', async () => {
    let now = 0;
    const yieldToHost = jest.fn(async () => {
      now += 1;
    });
    const onYield = jest.fn();

    const result = await buildTokenEntitiesCooperatively(
      '0xYield',
      [
        token('1', true),
        token('2', true),
        token('3', false),
        token('4', false),
      ],
      9012,
      {
        budgetMs: 5,
        minimumItemsPerSlice: 1,
        onYield,
        clock: {
          now: () => {
            now += 3;
            return now;
          },
          yieldToHost,
        },
      },
    );

    expect(result?.tokenItems).toHaveLength(4);
    expect(yieldToHost).toHaveBeenCalled();
    expect(onYield).toHaveBeenCalled();
  });

  it('does not return a partial snapshot after the request becomes stale', async () => {
    let checks = 0;
    const result = await buildTokenEntitiesCooperatively(
      '0xStale',
      [token('1', true), token('2', false)],
      3456,
      {
        minimumItemsPerSlice: 1,
        shouldContinue: () => {
          checks += 1;
          return checks < 2;
        },
      },
    );

    expect(result).toBeNull();
  });
});
