import { APP_DB_PREFIX } from '@/databases/constant';
import { stringUtils } from '@rabby-wallet/base-utils';
import {
  BaseEntity,
  ColumnType,
  getMetadataArgsStorage,
} from 'typeorm/browser';
import { ColumnMetadataArgs } from 'typeorm/browser/metadata-args/ColumnMetadataArgs';

type ColumnInfo = {
  $col: ColumnMetadataArgs;
  propertyName: string;
  databaseName: string;
  targetCls: Function;
  type: ColumnType | undefined;
  isPrimary: boolean;
};

type ParseEntityOpts = {
  tableName?: string;
  upsetExcludeColumns?: string[];
};

type ParsedEntityInfo = {
  tableName: string;
  columns: Function[];
  propMapToColumn: Record<string, ColumnInfo>;
  orderedPropertyNames: string[];
  upsertSql: string;
};

type EntityConstructor = typeof BaseEntity;
const ParsedMap = new Map<EntityConstructor, ParsedEntityInfo>();

export const DEFAULT_UPDATE_SET_IGNORE = ['_local_created_at', 'created_at'];
export function parseEntityColumns<T extends EntityConstructor>(
  entityCls: T,
  options?: ParseEntityOpts,
) {
  const storage = getMetadataArgsStorage();
  // console.debug('[parseEntityColumns] parseEntityColumns:: storage', storage);
  const foundTableName = storage.tables.find(
    item => item.target === entityCls,
  )?.name;
  let tableName = foundTableName || options?.tableName;
  if (!tableName) {
    throw new Error(
      `parseEntityColumns: table name not found for entity ${entityCls.name}`,
    );
  }
  tableName = stringUtils.ensurePrefix(tableName, APP_DB_PREFIX);

  const allColumns = storage.columns;
  const { upsetExcludeColumns = DEFAULT_UPDATE_SET_IGNORE } = options || {};

  const parseResult = {
    tableName,
    ancestors: [] as Function[],
    columns: [] as ParsedEntityInfo['columns'],
    propMapToColumn: {} as ParsedEntityInfo['propMapToColumn'],
    orderedPropertyNames: [] as ParsedEntityInfo['orderedPropertyNames'],
    upsertSql: '' as ParsedEntityInfo['upsertSql'],
  };

  let currentProto = entityCls.prototype;
  while (currentProto) {
    parseResult.ancestors.push(currentProto.constructor);
    currentProto = Object.getPrototypeOf(currentProto);
    if (currentProto === Object.prototype) {
      break;
    }
  }
  const ancestorsSet = new Set(parseResult.ancestors);
  // console.debug('[parseEntityColumns] parseEntityColumns:: allColumns', allColumns);

  const insertGenerator = {
    maybeConflictColumns: [] as ColumnInfo[],
    updateSetColumns: [] as ColumnInfo[],
    columnNames: [] as string[],
    placeholders: '',
  };

  // const metadata = entityCls.getRepository().metadata;
  allColumns.forEach(column => {
    const target = column.target as Function;
    if (!ancestorsSet.has(target)) return;

    const col = {
      $col: column,
      propertyName: column.propertyName,
      databaseName: column.options.name || column.propertyName,
      type: column.options.type,
      targetCls: target,
      isPrimary: !!column.options.primary,
      updateSetIgnore: upsetExcludeColumns.includes(column.propertyName),
    };
    if (col.isPrimary) {
      insertGenerator.maybeConflictColumns.push(col);
    } else if (!col.updateSetIgnore) {
      insertGenerator.updateSetColumns.push(col);
    }
    parseResult.orderedPropertyNames.push(col.propertyName);
    insertGenerator.columnNames.push(`"${col.databaseName}"`);
    parseResult.propMapToColumn[col.propertyName] = col;
  });

  const updateSet = insertGenerator.updateSetColumns
    .map(col => `"${col.databaseName}" = EXCLUDED."${col.databaseName}"`)
    .join(', ');

  const conflictColumns = insertGenerator.maybeConflictColumns
    .map(col => `"${col.databaseName}"`)
    .join(', ');

  parseResult.upsertSql = `
INSERT INTO "${tableName}" (${insertGenerator.columnNames.join(', ')})
VALUES (${insertGenerator.columnNames.map(() => '?').join(', ')})
ON CONFLICT (${conflictColumns}) DO UPDATE SET ${updateSet}
  `;

  // console.debug(`[codestub][${tableName}] parseResult.upsertSql`, parseResult.upsertSql);

  return parseResult;
}

export function generateUpsertSql<T extends EntityConstructor>(
  entityCls: T,
  opts?: ParseEntityOpts,
) {
  return parseEntityColumns(entityCls, opts).upsertSql;
}

export function ParseEntity() {
  return function <T extends EntityConstructor>(constructor: T) {
    const parseResult = parseEntityColumns(constructor);
    console.debug(
      `[codestub][${parseResult.tableName}] ParseEntity constructor`,
      constructor,
    );

    Object.defineProperty(constructor, '__parsedEntityInfo', {
      value: parseResult,
      writable: false,
      enumerable: false,
      configurable: false,
    });
    Object.defineProperty(constructor, 'stmSql', {
      value: parseResult.upsertSql,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    Object.defineProperty(constructor, 'getStatementSql', {
      value: function () {
        return parseResult.upsertSql;
      },
      writable: false,
      enumerable: false,
      configurable: false,
    });

    Object.defineProperty(constructor.prototype, 'bindUpsertParams', {
      value: function (stm: any) {
        const params = parseResult.orderedPropertyNames.map(propName => {
          let value = (this as any)[propName];
          const column = parseResult.propMapToColumn[propName];

          const colOptions = column?.$col.options;
          if (!colOptions) return value;

          const optTransformers = colOptions.transformer;
          const transformers = !optTransformers
            ? []
            : Array.isArray(optTransformers)
            ? optTransformers
            : [optTransformers].filter(Boolean);

          let transformedValue = value;
          if (transformers.length) {
            transformedValue = transformers.reduce(
              (val, transformer) =>
                typeof transformer.to === 'function'
                  ? transformer.to(val)
                  : val,
              value,
            );
          }
          const optDefaultValue = colOptions.default;
          if (transformedValue === undefined && optDefaultValue !== undefined) {
            transformedValue =
              typeof optDefaultValue === 'function'
                ? optDefaultValue()
                : optDefaultValue;
          }

          return transformedValue;
        });

        stm.bindSync(params);
        return stm;
      },
      writable: false,
      enumerable: false,
      configurable: false,
    });

    ParsedMap.set(constructor, parseResult);
  };
}
