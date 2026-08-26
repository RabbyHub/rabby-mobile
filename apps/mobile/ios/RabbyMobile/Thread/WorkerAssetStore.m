#import "WorkerAssetStore.h"

#import <sqlite3.h>

static NSString *const WorkerAssetTokenTable =
    @"rabby_cache_tokenitem_20260816";

@interface WorkerAssetStore ()
@property(nonatomic, strong) dispatch_queue_t workerQueue;
@end

@implementation WorkerAssetStore

RCT_EXPORT_MODULE(WorkerAssetStore)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  self = [super init];
  if (self) {
    _workerQueue = dispatch_queue_create(
        "com.debank.rabbymobile.worker-asset-store", DISPATCH_QUEUE_SERIAL);
  }
  return self;
}

- (dispatch_queue_t)methodQueue
{
  return self.workerQueue;
}

RCT_REMAP_METHOD(commitTokenSnapshot,
                 ownerAddress:(NSString *)rawOwnerAddress
                 syncTimestamp:(nonnull NSNumber *)syncTimestampValue
                 rows:(NSArray<NSDictionary *> *)rows
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  NSString *ownerAddress = rawOwnerAddress.lowercaseString;
  int64_t syncTimestamp = syncTimestampValue.longLongValue;
  if (ownerAddress.length == 0 || syncTimestamp <= 0 || rows.count == 0) {
    reject(@"worker_asset_store_invalid_snapshot",
           @"Worker token snapshot is invalid", nil);
    return;
  }

  sqlite3 *database = NULL;
  sqlite3_stmt *upsert = NULL;
  sqlite3_stmt *cleanup = NULL;
  BOOL transactionStarted = NO;
  @try {
    NSString *libraryPath = NSSearchPathForDirectoriesInDomains(
        NSLibraryDirectory, NSUserDomainMask, YES).firstObject;
    NSString *databasePath = [libraryPath
        stringByAppendingPathComponent:@"LocalDatabase/rabby-app.db"];
    if (![[NSFileManager defaultManager] fileExistsAtPath:databasePath]) {
      @throw [NSException exceptionWithName:@"WorkerAssetStore"
                                     reason:@"app_database_missing"
                                   userInfo:nil];
    }
    if (sqlite3_open_v2(databasePath.UTF8String,
                        &database,
                        SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX,
                        NULL) != SQLITE_OK) {
      @throw [NSException exceptionWithName:@"WorkerAssetStore"
                                     reason:@"app_database_open_failed"
                                   userInfo:nil];
    }
    sqlite3_busy_timeout(database, 5000);

    NSArray<NSString *> *columns = [self tokenColumns];
    [self validateTokenTable:database expectedColumns:columns];
    [self executeSql:database sql:@"BEGIN IMMEDIATE"];
    transactionStarted = YES;

    if ([self hasNewerTokenSnapshot:database
                       ownerAddress:ownerAddress
                      syncTimestamp:syncTimestamp]) {
      [self executeSql:database sql:@"COMMIT"];
      transactionStarted = NO;
      sqlite3_close(database);
      database = NULL;
      resolve(@{ @"rowCount": @0, @"applied": @NO });
      return;
    }

    NSString *upsertSql = [self tokenUpsertSql:columns];
    if (sqlite3_prepare_v2(database,
                          upsertSql.UTF8String,
                          -1,
                          &upsert,
                          NULL) != SQLITE_OK) {
      @throw [NSException exceptionWithName:@"WorkerAssetStore"
                                     reason:@"token_cache_prepare_failed"
                                   userInfo:nil];
    }

    for (NSDictionary *row in rows) {
      NSString *rowOwner = [row[@"owner_addr"] isKindOfClass:NSString.class]
          ? row[@"owner_addr"]
          : nil;
      if (![ownerAddress isEqualToString:rowOwner]) {
        @throw [NSException exceptionWithName:@"WorkerAssetStore"
                                       reason:@"snapshot_scope_mismatch"
                                     userInfo:nil];
      }
      sqlite3_reset(upsert);
      sqlite3_clear_bindings(upsert);
      [columns enumerateObjectsUsingBlock:^(
          NSString *column, NSUInteger index, BOOL *stop) {
        [self bindValue:row[column]
                 column:column
              statement:upsert
                  index:(int)index + 1];
      }];
      if (sqlite3_step(upsert) != SQLITE_DONE) {
        @throw [NSException exceptionWithName:@"WorkerAssetStore"
                                       reason:@"token_cache_upsert_failed"
                                     userInfo:nil];
      }
    }
    sqlite3_finalize(upsert);
    upsert = NULL;

    NSString *cleanupSql = [NSString stringWithFormat:
        @"DELETE FROM \"%@\" WHERE \"owner_addr\"=? "
         "AND \"_local_updated_at\"<?", WorkerAssetTokenTable];
    if (sqlite3_prepare_v2(database,
                          cleanupSql.UTF8String,
                          -1,
                          &cleanup,
                          NULL) != SQLITE_OK) {
      @throw [NSException exceptionWithName:@"WorkerAssetStore"
                                     reason:@"token_cache_cleanup_prepare_failed"
                                   userInfo:nil];
    }
    sqlite3_bind_text(cleanup, 1, ownerAddress.UTF8String, -1, SQLITE_TRANSIENT);
    sqlite3_bind_int64(cleanup, 2, syncTimestamp);
    int cleanupResult = sqlite3_step(cleanup);
    sqlite3_finalize(cleanup);
    cleanup = NULL;
    if (cleanupResult != SQLITE_DONE) {
      @throw [NSException exceptionWithName:@"WorkerAssetStore"
                                     reason:@"token_cache_cleanup_failed"
                                   userInfo:nil];
    }

    [self executeSql:database sql:@"COMMIT"];
    transactionStarted = NO;
    sqlite3_close(database);
    database = NULL;
    resolve(@{ @"rowCount": @(rows.count), @"applied": @YES });
  } @catch (NSException *exception) {
    if (upsert != NULL) {
      sqlite3_finalize(upsert);
    }
    if (cleanup != NULL) {
      sqlite3_finalize(cleanup);
    }
    if (transactionStarted && database != NULL) {
      sqlite3_exec(database, "ROLLBACK", NULL, NULL, NULL);
    }
    if (database != NULL) {
      sqlite3_close(database);
    }
    reject(@"worker_asset_store_commit_failed",
           exception.reason ?: @"Worker token cache transaction failed",
           nil);
  }
}

- (NSArray<NSString *> *)tokenColumns
{
  return @[
    @"_local_created_at", @"_local_updated_at", @"_db_id", @"owner_addr",
    @"projection_resource_id", @"content_type", @"content", @"inner_id",
    @"amount", @"chain", @"decimals", @"display_symbol", @"id",
    @"is_core", @"is_verified", @"is_wallet", @"is_scam", @"is_infinity",
    @"is_suspicious", @"logo_url", @"name", @"optimized_symbol", @"price",
    @"symbol", @"time_at", @"usd_value", @"credit_score", @"protocol_id",
    @"launchpad", @"asset", @"market_status", @"raw_amount",
    @"raw_amount_hex_str", @"price_24h_change", @"low_credit_score", @"fdv",
    @"value_24h_change", @"cex_ids"
  ];
}

- (void)validateTokenTable:(sqlite3 *)database
           expectedColumns:(NSArray<NSString *> *)expectedColumns
{
  NSString *sql = [NSString stringWithFormat:
      @"PRAGMA table_info(\"%@\")", WorkerAssetTokenTable];
  sqlite3_stmt *statement = NULL;
  if (sqlite3_prepare_v2(database,
                        sql.UTF8String,
                        -1,
                        &statement,
                        NULL) != SQLITE_OK) {
    @throw [NSException exceptionWithName:@"WorkerAssetStore"
                                   reason:@"token_cache_schema_read_failed"
                                 userInfo:nil];
  }
  NSMutableSet<NSString *> *actualColumns = [NSMutableSet set];
  while (sqlite3_step(statement) == SQLITE_ROW) {
    const unsigned char *name = sqlite3_column_text(statement, 1);
    if (name != NULL) {
      [actualColumns addObject:[NSString stringWithUTF8String:(const char *)name]];
    }
  }
  sqlite3_finalize(statement);
  for (NSString *column in expectedColumns) {
    if (![actualColumns containsObject:column]) {
      @throw [NSException exceptionWithName:@"WorkerAssetStore"
                                     reason:@"token_cache_schema_mismatch"
                                   userInfo:nil];
    }
  }
}

- (BOOL)hasNewerTokenSnapshot:(sqlite3 *)database
                 ownerAddress:(NSString *)ownerAddress
                syncTimestamp:(int64_t)syncTimestamp
{
  NSString *sql = [NSString stringWithFormat:
      @"SELECT MAX(\"_local_updated_at\") FROM \"%@\" "
       "WHERE \"owner_addr\"=?", WorkerAssetTokenTable];
  sqlite3_stmt *statement = NULL;
  if (sqlite3_prepare_v2(database,
                        sql.UTF8String,
                        -1,
                        &statement,
                        NULL) != SQLITE_OK) {
    @throw [NSException exceptionWithName:@"WorkerAssetStore"
                                   reason:@"token_cache_generation_read_failed"
                                 userInfo:nil];
  }
  sqlite3_bind_text(
      statement, 1, ownerAddress.UTF8String, -1, SQLITE_TRANSIENT);
  BOOL hasNewerSnapshot = NO;
  if (sqlite3_step(statement) == SQLITE_ROW &&
      sqlite3_column_type(statement, 0) != SQLITE_NULL) {
    hasNewerSnapshot = sqlite3_column_int64(statement, 0) > syncTimestamp;
  }
  sqlite3_finalize(statement);
  return hasNewerSnapshot;
}

- (NSString *)tokenUpsertSql:(NSArray<NSString *> *)columns
{
  NSMutableArray<NSString *> *quotedColumns = [NSMutableArray array];
  NSMutableArray<NSString *> *placeholders = [NSMutableArray array];
  NSMutableArray<NSString *> *updates = [NSMutableArray array];
  for (NSString *column in columns) {
    [quotedColumns addObject:[NSString stringWithFormat:@"\"%@\"", column]];
    [placeholders addObject:@"?"];
    if (![column isEqualToString:@"_local_created_at"] &&
        ![column isEqualToString:@"_db_id"]) {
      [updates addObject:[NSString stringWithFormat:
          @"\"%@\"=excluded.\"%@\"", column, column]];
    }
  }
  return [NSString stringWithFormat:
      @"INSERT INTO \"%@\" (%@) VALUES (%@) "
       "ON CONFLICT (\"_db_id\") DO UPDATE SET %@",
      WorkerAssetTokenTable,
      [quotedColumns componentsJoinedByString:@","],
      [placeholders componentsJoinedByString:@","],
      [updates componentsJoinedByString:@","]];
}

- (BOOL)isIntegerColumn:(NSString *)column
{
  static NSSet<NSString *> *integerColumns;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    integerColumns = [NSSet setWithArray:@[
      @"_local_created_at", @"_local_updated_at", @"is_core",
      @"is_verified", @"is_wallet", @"is_scam", @"is_infinity",
      @"is_suspicious", @"time_at", @"low_credit_score"
    ]];
  });
  return [integerColumns containsObject:column];
}

- (void)bindValue:(id)value
            column:(NSString *)column
         statement:(sqlite3_stmt *)statement
             index:(int)index
{
  if (value == nil || value == NSNull.null) {
    sqlite3_bind_null(statement, index);
  } else if ([value isKindOfClass:NSString.class]) {
    sqlite3_bind_text(
        statement, index, [value UTF8String], -1, SQLITE_TRANSIENT);
  } else if ([value isKindOfClass:NSNumber.class]) {
    if ([self isIntegerColumn:column]) {
      sqlite3_bind_int64(statement, index, [value longLongValue]);
    } else {
      sqlite3_bind_double(statement, index, [value doubleValue]);
    }
  } else {
    @throw [NSException exceptionWithName:@"WorkerAssetStore"
                                   reason:@"token_cache_binding_invalid"
                                 userInfo:nil];
  }
}

- (void)executeSql:(sqlite3 *)database sql:(NSString *)sql
{
  if (sqlite3_exec(database, sql.UTF8String, NULL, NULL, NULL) != SQLITE_OK) {
    @throw [NSException exceptionWithName:@"WorkerAssetStore"
                                   reason:@"token_cache_transaction_failed"
                                 userInfo:nil];
  }
}

@end
