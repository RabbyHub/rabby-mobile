import {
  chunkBySqliteVariableBudget,
  getSqliteVariableBatchSize,
} from './sqliteVariableLimit';

describe('SQLite variable batching', () => {
  it('limits TypeORM rows using the entity column count', () => {
    expect(
      getSqliteVariableBatchSize({
        variablesPerItem: 37,
        requestedBatchSize: 120,
      }),
    ).toBe(24);
  });

  it('reserves fixed variables before batching variable-width items', () => {
    expect(
      getSqliteVariableBatchSize({
        variablesPerItem: 2,
        fixedVariableCount: 100,
      }),
    ).toBe(400);
  });

  it('chunks without exceeding the configured variable budget', () => {
    const batches = chunkBySqliteVariableBudget(
      Array.from({ length: 1000 }, (_, index) => index),
      {
        variablesPerItem: 2,
        fixedVariableCount: 100,
      },
    );

    expect(batches.map(batch => batch.length)).toEqual([400, 400, 200]);
    expect(batches.every(batch => 100 + batch.length * 2 <= 900)).toBe(true);
  });

  it('rejects a fixed variable set that leaves no room for one item', () => {
    expect(() =>
      getSqliteVariableBatchSize({
        variablesPerItem: 2,
        fixedVariableCount: 899,
      }),
    ).toThrow('SQLite variable budget cannot fit one item');
  });
});
