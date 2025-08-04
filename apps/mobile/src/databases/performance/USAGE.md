# 数据库性能监控调试工具使用指南

## 快速开始

### 1. 检查调试工具是否可用

在控制台中运行以下命令检查调试工具状态：

```javascript
checkDBDebugger();
```

如果调试工具可用，你会看到类似以下的输出：

```
🔍 检查数据库性能监控调试工具状态...
┌─────────┬─────────────────────────┬──────┬──────────┐
│ (index) │          检查项          │ 可用 │   类型   │
├─────────┼─────────────────────────┼──────┼──────────┤
│    0    │ 'global.DBPerformanceDebugger' │  ✅  │ 'object' │
│    1    │   'console.debugDB'    │  ✅  │ 'object' │
└─────────┴─────────────────────────┴──────┴──────────┘
✅ 调试工具可用! 可以使用以下方式访问:
  - global.DBPerformanceDebugger
  - console.debugDB
```

### 2. 查看查询性能统计

```javascript
// 查看所有查询统计
debugDB.stats();

// 查看性能摘要
debugDB.summary();

// 查看慢查询（默认阈值100ms）
debugDB.slow();

// 查看慢查询（自定义阈值50ms）
debugDB.slow(50);
```

### 3. 管理统计数据

```javascript
// 清除所有统计信息
debugDB.clear();

// 导出性能数据
debugDB.export();
```

## 详细 API

### debugDB 对象（简化版）

| 方法              | 描述                 | 参数                                |
| ----------------- | -------------------- | ----------------------------------- |
| `stats()`         | 打印所有查询统计信息 | 无                                  |
| `slow(threshold)` | 打印慢查询统计       | `threshold`: 阈值（毫秒，默认 100） |
| `summary()`       | 打印性能摘要         | 无                                  |
| `clear()`         | 清除所有统计信息     | 无                                  |
| `export()`        | 导出性能数据         | 无                                  |

### DBPerformanceDebugger 类（完整版）

```javascript
// 完整版API
DBPerformanceDebugger.printAllStats();
DBPerformanceDebugger.printSlowQueries(100);
DBPerformanceDebugger.printSummary();
DBPerformanceDebugger.clearStats();
DBPerformanceDebugger.exportStats();
```

## 示例输出

### 查询统计输出示例

```
📊 数据库查询性能统计
🔍 TokenItemEntity.getCountOfAccount
   执行次数: 5
   总耗时: 250ms
   平均耗时: 50.00ms
   总耗时占比: 25.00%

🔍 HistoryItemEntity.getAllHistoryItemSortedByTime
   执行次数: 3
   总耗时: 450ms
   平均耗时: 150.00ms
   总耗时占比: 45.00%
```

### 慢查询输出示例

```
🐌 慢查询统计 (阈值: 100ms)
⚠️  HistoryItemEntity.getAllHistoryItemSortedByTime
   执行次数: 3
   总耗时: 450ms
   平均耗时: 150.00ms
```

### 性能摘要输出示例

```
📊 数据库查询性能摘要
   总查询次数: 15
   总耗时: 1000ms
   平均耗时: 66.67ms
   慢查询数量: 2
   监控的查询类型: 8种
```

## 故障排除

### 问题：控制台找不到 debugDB

**解决方案：**

1. **检查开发环境**

   ```javascript
   console.log(__DEV__); // 应该输出 true
   ```

2. **重启应用**

   - 完全关闭应用
   - 重新启动开发服务器
   - 重新运行应用

3. **手动检查模块加载**

   ```javascript
   // 检查是否有错误信息
   console.log('检查性能监控模块...');
   ```

4. **手动导入（如果其他方法都失败）**
   ```javascript
   // 在控制台中手动执行
   import('./databases/performance').then(module => {
     global.debugDB = {
       stats: () => module.DBPerformanceDebugger.printAllStats(),
       slow: t => module.DBPerformanceDebugger.printSlowQueries(t),
       summary: () => module.DBPerformanceDebugger.printSummary(),
       clear: () => module.DBPerformanceDebugger.clearStats(),
       export: () => module.DBPerformanceDebugger.exportStats(),
     };
     console.log('✅ 手动加载成功!');
   });
   ```

### 问题：没有查询数据

**可能原因：**

1. 应用还没有执行任何数据库查询
2. 查询没有被监控装饰器覆盖
3. 数据库连接还没有建立

**解决方案：**

1. 在应用中执行一些操作（如查看代币列表、历史记录等）
2. 等待几秒钟后再检查
3. 确认相关实体已经添加了监控装饰器

### 问题：性能数据不准确

**可能原因：**

1. 有其他异步操作干扰计时
2. 查询被缓存了
3. 数据库连接问题

**解决方案：**

1. 清除统计数据重新测试
2. 检查控制台是否有错误信息
3. 确认数据库连接状态

## 最佳实践

1. **定期检查性能**

   ```javascript
   // 每5分钟检查一次
   setInterval(() => {
     debugDB.summary();
   }, 5 * 60 * 1000);
   ```

2. **监控慢查询**

   ```javascript
   // 设置较低的阈值来发现潜在问题
   debugDB.slow(50);
   ```

3. **导出数据进行分析**

   ```javascript
   const data = debugDB.export();
   console.log('性能数据:', data);
   ```

4. **清理旧数据**
   ```javascript
   // 定期清理统计数据
   debugDB.clear();
   ```

## 注意事项

- 调试工具仅在开发环境下可用
- 统计数据会占用少量内存
- 查询内容会被截断以保护隐私
- 性能监控本身会带来少量开销
