import { TokenItemEntity } from './tokenitem';

jest.mock('typeorm/browser', () => require('typeorm'));

jest.mock('@/utils/token', () => ({
  tokenItemEntityToTokenItem: jest.fn(),
}));

jest.mock('../imports', () => ({
  prepareAppDataSource: jest.fn(async () => undefined),
}));

type RawAmountRow = {
  tokenitem_chain: string;
  tokenitem_id: string;
  total_amount: string;
};

function createQueryBuilderFactory(results: RawAmountRow[][]) {
  const queryCalls: Array<{
    ownerCount: number;
    tokenVariableCount: number;
  }> = [];
  let resultIndex = 0;

  const createQueryBuilder = jest.fn(() => {
    const queryState = {
      ownerCount: 0,
      tokenVariableCount: 0,
    };
    const builder = {
      select: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      groupBy: jest.fn(),
      getRawMany: jest.fn(),
    };

    builder.select.mockReturnValue(builder);
    builder.where.mockImplementation(
      (_sql: string, params: { owner_addr: string[] }) => {
        queryState.ownerCount = params.owner_addr.length;
        return builder;
      },
    );
    builder.andWhere.mockImplementation(
      (_sql: string, params: Record<string, string>) => {
        queryState.tokenVariableCount = Object.keys(params).length;
        return builder;
      },
    );
    builder.groupBy.mockReturnValue(builder);
    builder.getRawMany.mockImplementation(async () => {
      queryCalls.push({ ...queryState });
      const result = results[resultIndex] || [];
      resultIndex += 1;
      return result;
    });

    return builder;
  });

  return { createQueryBuilder, queryCalls };
}

describe('TokenItemEntity.getTokenListAmount query batching', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps every query below the conservative SQLite variable budget', async () => {
    const { createQueryBuilder, queryCalls } = createQueryBuilderFactory([]);
    jest.spyOn(TokenItemEntity, 'getRepository').mockReturnValue({
      createQueryBuilder,
    } as never);
    const tokenList = Array.from({ length: 1000 }, (_, index) => ({
      chain: 'eth',
      tokenId: `token-${index}`,
    }));

    const result = await TokenItemEntity.getTokenListAmount({
      owner_addr: ['owner-1', 'owner-2', 'owner-3'],
      tokenList,
    });

    expect(queryCalls).toHaveLength(3);
    expect(
      queryCalls.every(
        call => call.ownerCount + call.tokenVariableCount <= 900,
      ),
    ).toBe(true);
    expect(result).toHaveLength(tokenList.length);
  });

  it('adds amounts returned by separate owner batches', async () => {
    const { createQueryBuilder } = createQueryBuilderFactory([
      [
        {
          tokenitem_chain: 'eth',
          tokenitem_id: 'token-1',
          total_amount: '1.5',
        },
      ],
      [
        {
          tokenitem_chain: 'eth',
          tokenitem_id: 'token-1',
          total_amount: '2.5',
        },
      ],
    ]);
    jest.spyOn(TokenItemEntity, 'getRepository').mockReturnValue({
      createQueryBuilder,
    } as never);

    await expect(
      TokenItemEntity.getTokenListAmount({
        owner_addr: Array.from({ length: 101 }, (_, index) => `owner-${index}`),
        tokenList: [{ chain: 'eth', tokenId: 'token-1' }],
      }),
    ).resolves.toEqual([
      {
        chain: 'eth',
        tokenId: 'token-1',
        amount: 4,
      },
    ]);
  });

  it('deduplicates query inputs without changing the returned token list', async () => {
    const { createQueryBuilder, queryCalls } = createQueryBuilderFactory([]);
    jest.spyOn(TokenItemEntity, 'getRepository').mockReturnValue({
      createQueryBuilder,
    } as never);
    const uniqueTokens = Array.from({ length: 449 }, (_, index) => ({
      chain: 'eth',
      tokenId: `token-${index}`,
    }));
    const tokenList = [...uniqueTokens, uniqueTokens[0]];

    const result = await TokenItemEntity.getTokenListAmount({
      owner_addr: ['owner-1', 'owner-1'],
      tokenList,
    });

    expect(queryCalls).toEqual([
      {
        ownerCount: 1,
        tokenVariableCount: 898,
      },
    ]);
    expect(result).toHaveLength(tokenList.length);
    expect(result[0]).toEqual(result[result.length - 1]);
  });
});
