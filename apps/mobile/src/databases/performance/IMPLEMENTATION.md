# 数据库查询性能监控系统实现总结

## 实现概述

本次实现为 Rabby Mobile 应用添加了全面的数据库查询性能监控系统，通过统一拦截器和装饰器的方式，实现了对所有 SQL 查询的耗时监控。

## 实现的功能

### 1. 核心监控系统

- **DBQueryMonitor**: 单例模式的性能监控器，负责收集和分析查询性能数据
- **性能数据收集**: 记录查询次数、总耗时、平均耗时等关键指标
- **慢查询检测**: 自动识别超过阈值的慢查询
- **错误监控**: 监控查询失败的情况

### 2. 装饰器系统

- **@monitorDBQuery**: 用于监控普通数据库查询方法
- **@monitorRawQuery**: 用于监控原始 SQL 查询方法
- **自动参数提取**: 从方法参数中自动提取 SQL 查询内容

### 3. 工具函数

- **monitorRepositoryQuery**: 监控 Repository 查询操作
- **monitorRawSQLQuery**: 监控原始 SQL 查询
- **monitorQueryBuilder**: 监控 QueryBuilder 查询
- **createMonitoredRepository**: 创建带监控的 Repository 包装器

### 4. 调试工具

- **DBPerformanceDebugger**: 开发环境下的性能分析工具
- **自动统计**: 每 5 分钟自动打印性能摘要
- **慢查询报告**: 识别和报告慢查询
- **数据导出**: 支持导出性能数据用于进一步分析

### 5. 数据上报

- **统计系统集成**: 与现有的 stats 系统集成
- **性能数据上报**: 将慢查询数据上报到统计系统
- **数据隐私保护**: 查询内容截断避免泄露敏感信息

## 已添加监控的实体

### TokenItemEntity

- ✅ `getCountOfAccount` - 获取账户数量
- ✅ `getCount` - 获取总记录数
- ✅ `batchQueryTokens` - 批量查询代币
- ✅ `batchMultiAddressTokensByIdAndChain` - 多地址代币查询
- ✅ `batchMultAddressTokens` - 批量多地址代币查询
- ✅ `searchAllTokens` - 搜索所有代币
- ✅ `queryTokensByOwner` - 按所有者查询代币

### CopyTradingBuyItemEntity

- ✅ `getCountOfAccount` - 获取账户数量
- ✅ `getCount` - 获取总记录数
- ✅ `queryCopyTradingItems` - 查询复制交易项目（原始 SQL）

### HistoryItemEntity

- ✅ `getAllHistoryItem` - 获取所有历史记录
- ✅ `getCountOfAccount` - 获取账户数量
- ✅ `getCount` - 获取总记录数
- ✅ `getAllHistoryItemSortedByTime` - 按时间排序的历史记录

### NFTItemEntity

- ✅ `getCountOfAccount` - 获取账户数量
- ✅ `getCount` - 获取总记录数
- ✅ `batchQueryNFTs` - 批量查询 NFT
- ✅ `batchMultAddressNFTs` - 批量多地址 NFT 查询

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    数据库性能监控系统                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   DBQueryMonitor │  │   装饰器系统     │  │   工具函数    │ │
│  │   (核心监控器)    │  │  @monitorDBQuery │  │monitorQuery  │ │
│  │                 │  │  @monitorRawQuery│  │monitorRawSQL │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ 调试工具         │  │ 数据上报        │  │ 测试系统      │ │
│  │DBPerformanceDebug│  │stats.report     │  │testDBMonitor │ │
│  │ger              │  │                 │  │              │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 监控流程

1. **查询执行**: 数据库查询方法被调用
2. **装饰器拦截**: 装饰器自动拦截方法调用
3. **性能监控**: 记录开始时间和执行查询
4. **数据收集**: 计算耗时并收集性能数据
5. **统计分析**: 更新统计信息（次数、总耗时、平均耗时）
6. **慢查询检测**: 检查是否超过阈值
7. **数据上报**: 将慢查询数据上报到统计系统
8. **日志输出**: 开发环境下输出详细日志

## 配置参数

- **慢查询阈值**: 100ms（可配置）
- **上报阈值**: 100ms（可配置）
- **查询内容截断**: 200 字符（避免过长）
- **统计上报截断**: 100 字符（统计系统限制）

## 开发环境特性

- **自动日志**: 所有查询都会在控制台输出详细日志
- **性能摘要**: 每 5 分钟自动打印性能摘要
- **调试工具**: 全局暴露`DBPerformanceDebugger`工具
- **测试系统**: 自动运行测试验证系统功能

## 生产环境优化

- **性能开销最小化**: 监控系统本身的开销控制在最小范围
- **内存管理**: 统计数据定期清理，避免内存泄漏
- **错误处理**: 完善的错误处理机制，不影响正常业务
- **数据隐私**: 查询内容截断，保护用户隐私

## 使用示例

### 开发时调试

```typescript
// 查看所有查询统计
DBPerformanceDebugger.printAllStats();

// 查看慢查询
DBPerformanceDebugger.printSlowQueries(50);

// 导出性能数据
const data = DBPerformanceDebugger.exportStats();
```

### 为新实体添加监控

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

### 手动监控查询

```typescript
import { dbQueryMonitor } from '@/databases/performance';

const result = await dbQueryMonitor.monitorQuery(() => repository.find(), {
  entity: 'UserEntity',
  method: 'customQuery',
  query: 'SELECT * FROM users',
});
```

## 后续优化建议

1. **更多实体监控**: 为其他数据库实体添加监控装饰器
2. **查询分析**: 添加查询计划分析功能
3. **性能告警**: 实现慢查询告警机制
4. **可视化**: 添加性能数据可视化界面
5. **缓存监控**: 扩展监控范围到缓存操作

## 总结

本次实现成功为 Rabby Mobile 应用建立了完整的数据库查询性能监控体系，通过统一拦截器和装饰器的方式，实现了对所有 SQL 查询的全面监控。系统具有良好的扩展性和可维护性，为后续的性能优化提供了强有力的数据支撑。
