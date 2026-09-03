export const SQLITE_SAFE_VARIABLE_BUDGET = 900;

type SqliteVariableBatchOptions = {
  variablesPerItem: number;
  fixedVariableCount?: number;
  requestedBatchSize?: number;
  variableBudget?: number;
};

function requirePositiveInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function requireNonNegativeInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

export function getSqliteVariableBatchSize({
  variablesPerItem,
  fixedVariableCount = 0,
  requestedBatchSize = Number.MAX_SAFE_INTEGER,
  variableBudget = SQLITE_SAFE_VARIABLE_BUDGET,
}: SqliteVariableBatchOptions) {
  requirePositiveInteger(variablesPerItem, 'variablesPerItem');
  requireNonNegativeInteger(fixedVariableCount, 'fixedVariableCount');
  requirePositiveInteger(requestedBatchSize, 'requestedBatchSize');
  requirePositiveInteger(variableBudget, 'variableBudget');

  const availableVariableCount = variableBudget - fixedVariableCount;
  if (availableVariableCount < variablesPerItem) {
    throw new RangeError('SQLite variable budget cannot fit one item');
  }

  return Math.min(
    requestedBatchSize,
    Math.floor(availableVariableCount / variablesPerItem),
  );
}

export function chunkBySqliteVariableBudget<T>(
  items: readonly T[],
  options: SqliteVariableBatchOptions,
) {
  if (!items.length) {
    return [];
  }

  const batchSize = getSqliteVariableBatchSize(options);
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }

  return batches;
}
