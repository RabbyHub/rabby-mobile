# 数据库查询性能监控系统

这个系统为 Rabby Mobile 应用提供了全面的数据库查询性能监控功能，帮助开发者识别和优化慢查询。

## 功能特性

- 🔍 **统一监控**: 自动监控所有数据库查询操作
- 📊 **性能统计**: 收集查询次数、总耗时、平均耗时等指标
- 🚨 **慢查询检测**: 自动识别和报告慢查询
- 📈 **数据上报**: 将性能数据上报到统计系统
- 🛠️ **调试工具**: 开发环境下提供详细的性能分析工具

## 核心组件

### 1. DBQueryMonitor (核心监控器)

主要的性能监控类，负责收集和分析查询性能数据。

```typescript
import { dbQueryMonitor } from '@/databases/performance';

// 手动监控查询
const result = await dbQueryMonitor.monitorQuery(() => repository.find(), {
  entity: 'UserEntity',
  method: 'findAll',
  query: 'SELECT * FROM users',
});
```

### 2. 装饰器

提供便捷的装饰器来监控静态方法：

```typescript
import { monitorDBQuery, monitorRawQuery } from '@/databases/performance';

class UserEntity {
  @monitorDBQuery({ entity: 'UserEntity', method: 'findByEmail' })
  static async findByEmail(email: string) {
    // 查询逻辑
  }

  @monitorRawQuery({ entity: 'UserEntity', method: 'customQuery' })
  static async customQuery(sql: string) {
    // 原始SQL查询
  }
}
```

### 3. 工具函数

提供各种查询类型的监控工具：

```typescript
import {
  monitorRepositoryQuery,
  monitorRawSQLQuery,
  monitorQueryBuilder,
  createMonitoredRepository,
} from '@/databases/performance';

// 监控Repository查询
const result = await monitorRepositoryQuery(
  repository,
  () => repository.find(),
  { entity: 'User', method: 'find' },
);

// 监控原始SQL查询
const result = await monitorRawSQLQuery(
  dataSource,
  'SELECT * FROM users WHERE id = ?',
  [userId],
  { entity: 'User', method: 'findById' },
);

// 创建带监控的Repository
const monitoredRepo = createMonitoredRepository(repository, 'User');
```

### 4. 调试工具

开发环境下提供详细的性能分析：

```typescript
import { DBPerformanceDebugger } from '@/databases/performance';

// 打印所有查询统计
DBPerformanceDebugger.printAllStats();

// 打印慢查询
DBPerformanceDebugger.printSlowQueries(100);

// 打印性能摘要
DBPerformanceDebugger.printSummary();

// 清除统计信息
DBPerformanceDebugger.clearStats();

// 导出性能数据
const data = DBPerformanceDebugger.exportStats();
```

## 自动监控

系统已经为以下实体添加了自动监控：

### TokenItemEntity

- `getCountOfAccount`
- `getCount`
- `batchQueryTokens`
- `batchMultiAddressTokensByIdAndChain`
- `batchMultAddressTokens`
- `searchAllTokens`
- `queryTokensByOwner`

### CopyTradingBuyItemEntity

- `getCountOfAccount`
- `getCount`
- `queryCopyTradingItems` (原始 SQL 查询)

### HistoryItemEntity

- `getAllHistoryItem`
- `getCountOfAccount`
- `getCount`
- `getAllHistoryItemSortedByTime`

## 配置选项

### 监控阈值

- **慢查询阈值**: 默认 100ms，超过此阈值的查询会被标记为慢查询
- **上报阈值**: 默认 100ms，超过此阈值的查询会上报到统计系统

### 开发环境特性

- 自动打印查询日志
- 每 5 分钟自动打印性能摘要
- 在全局对象中暴露调试工具 (`global.DBPerformanceDebugger`)

## 性能数据上报

系统会自动将以下数据上报到统计系统：

```typescript
{
  type: 'dbQueryPerformance',
  query: 'SELECT * FROM users', // 限制长度避免过长
  duration: 150, // 查询耗时(ms)
  entity: 'UserEntity', // 实体名称
  method: 'findAll', // 方法名称
  isError: false, // 是否出错
  timestamp: 1640995200000 // 时间戳
}
```

## 最佳实践

### 1. 为新实体添加监控

```typescript
import { monitorDBQuery } from '@/databases/performance';

@Entity('users')
export class UserEntity {
  @monitorDBQuery({ entity: 'UserEntity', method: 'findByEmail' })
  static async findByEmail(email: string) {
    // 查询逻辑
  }
}
```

### 2. 监控复杂查询

```typescript
@monitorDBQuery({
  entity: 'UserEntity',
  method: 'findWithRelations',
  reportToStats: true // 强制上报到统计系统
})
static async findWithRelations(userId: string) {
  // 复杂的关联查询
}
```

### 3. 开发时调试

```typescript
// 在控制台中查看性能数据
DBPerformanceDebugger.printAllStats();

// 查看慢查询
DBPerformanceDebugger.printSlowQueries(50);

// 导出数据进行分析
const data = DBPerformanceDebugger.exportStats();
```

## 注意事项

1. **性能开销**: 监控系统本身会带来少量性能开销，在生产环境中已优化
2. **数据隐私**: 查询内容会被截断以避免泄露敏感信息
3. **内存使用**: 统计数据会占用少量内存，开发环境下会自动清理
4. **统计精度**: 时间统计精度为毫秒级，适用于大多数场景

## 故障排除

### 监控不生效

1. 检查是否正确导入了监控装饰器
2. 确认方法是否为静态方法
3. 验证 TypeScript 装饰器配置

### 性能数据不准确

1. 检查是否有其他异步操作干扰计时
2. 确认查询是否真正执行
3. 验证数据库连接状态

### 调试工具不可用

1. 确认是否在开发环境 (`__DEV__` 为 true)
2. 检查控制台是否有错误信息
3. 验证全局对象是否正确暴露
