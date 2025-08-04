import { dbQueryMonitor } from './dbQueryMonitor';

/**
 * 数据库性能监控调试工具
 * 仅在开发环境下可用
 */
export class DBPerformanceDebugger {
  /**
   * 打印所有查询统计信息
   */
  static printAllStats(): void {
    if (!__DEV__) {
      console.warn('[DBPerformanceDebugger] 仅在开发环境下可用');
      return;
    }

    const stats = dbQueryMonitor.getQueryStats();
    console.group('📊 数据库查询性能统计');

    if (stats.size === 0) {
      console.log('暂无查询数据');
      console.groupEnd();
      return;
    }

    const sortedStats = Array.from(stats.entries()).sort(
      (a, b) => b[1].avgTime - a[1].avgTime,
    );

    sortedStats.forEach(([key, data]) => {
      const [entity, method] = key.split(':');
      console.log(
        `🔍 ${entity}.${method}`,
        `\n   执行次数: ${data.count}`,
        `\n   总耗时: ${data.totalTime}ms`,
        `\n   平均耗时: ${data.avgTime.toFixed(2)}ms`,
        `\n   总耗时占比: ${(
          (data.totalTime /
            sortedStats.reduce((sum, [, d]) => sum + d.totalTime, 0)) *
          100
        ).toFixed(2)}%`,
      );
    });

    console.groupEnd();
  }

  /**
   * 打印慢查询（平均耗时超过阈值）
   */
  static printSlowQueries(threshold: number = 100): void {
    if (!__DEV__) {
      console.warn('[DBPerformanceDebugger] 仅在开发环境下可用');
      return;
    }

    const slowQueries = dbQueryMonitor.getSlowQueries(threshold);
    console.group(`🐌 慢查询统计 (阈值: ${threshold}ms)`);

    if (slowQueries.length === 0) {
      console.log(`没有发现平均耗时超过${threshold}ms的查询`);
      console.groupEnd();
      return;
    }

    slowQueries.forEach(({ key, stats }) => {
      const [entity, method] = key.split(':');
      console.warn(
        `⚠️  ${entity}.${method}`,
        `\n   执行次数: ${stats.count}`,
        `\n   总耗时: ${stats.totalTime}ms`,
        `\n   平均耗时: ${stats.avgTime.toFixed(2)}ms`,
      );
    });

    console.groupEnd();
  }

  /**
   * 打印查询性能摘要
   */
  static printSummary(): void {
    if (!__DEV__) {
      console.warn('[DBPerformanceDebugger] 仅在开发环境下可用');
      return;
    }

    const stats = dbQueryMonitor.getQueryStats();
    if (stats.size === 0) {
      console.log('📊 暂无数据库查询数据');
      return;
    }

    const totalQueries = Array.from(stats.values()).reduce(
      (sum, data) => sum + data.count,
      0,
    );
    const totalTime = Array.from(stats.values()).reduce(
      (sum, data) => sum + data.totalTime,
      0,
    );
    const avgTime = totalTime / totalQueries;
    const slowQueries = dbQueryMonitor.getSlowQueries(100).length;

    console.log(
      '📊 数据库查询性能摘要',
      `\n   总查询次数: ${totalQueries}`,
      `\n   总耗时: ${totalTime}ms`,
      `\n   平均耗时: ${avgTime.toFixed(2)}ms`,
      `\n   慢查询数量: ${slowQueries}`,
      `\n   监控的查询类型: ${stats.size}种`,
    );
  }

  /**
   * 清除所有统计信息
   */
  static clearStats(): void {
    if (!__DEV__) {
      console.warn('[DBPerformanceDebugger] 仅在开发环境下可用');
      return;
    }

    dbQueryMonitor.clearStats();
    console.log('🗑️ 已清除所有数据库查询统计信息');
  }

  /**
   * 导出性能数据（用于进一步分析）
   */
  static exportStats(): any {
    if (!__DEV__) {
      console.warn('[DBPerformanceDebugger] 仅在开发环境下可用');
      return null;
    }

    const stats = dbQueryMonitor.getQueryStats();
    const exportData = {
      timestamp: Date.now(),
      totalQueries: Array.from(stats.values()).reduce(
        (sum, data) => sum + data.count,
        0,
      ),
      totalTime: Array.from(stats.values()).reduce(
        (sum, data) => sum + data.totalTime,
        0,
      ),
      queries: Array.from(stats.entries()).map(([key, data]) => {
        const [entity, method] = key.split(':');
        return {
          entity,
          method,
          count: data.count,
          totalTime: data.totalTime,
          avgTime: data.avgTime,
        };
      }),
    };

    console.log('📤 数据库查询性能数据:', exportData);
    return exportData;
  }
}

// 在开发环境下自动打印摘要
if (__DEV__) {
  // 每5分钟打印一次摘要
  setInterval(() => {
    DBPerformanceDebugger.printSummary();
  }, 5 * 60 * 1000);

  // 在控制台暴露调试工具 - 多种方式确保可用
  try {
    // 方式1: 使用global对象
    (global as any).DBPerformanceDebugger = DBPerformanceDebugger;

    // 方式2: 使用window对象（如果存在）
    if (typeof window !== 'undefined') {
      (window as any).DBPerformanceDebugger = DBPerformanceDebugger;
    }

    // 方式3: 使用console对象
    (console as any).DBPerformanceDebugger = DBPerformanceDebugger;

    // 方式4: 直接暴露到console
    console.log('🔧 DBPerformanceDebugger 已加载，可通过以下方式访问:');
    console.log('  - global.DBPerformanceDebugger');
    console.log('  - window.DBPerformanceDebugger (如果存在)');
    console.log('  - console.DBPerformanceDebugger');
    console.log('  - 或者直接使用: DBPerformanceDebugger.printAllStats()');

    // 方式5: 创建一个简化的全局函数
    const debugDB = {
      stats: () => DBPerformanceDebugger.printAllStats(),
      slow: (threshold = 100) =>
        DBPerformanceDebugger.printSlowQueries(threshold),
      summary: () => DBPerformanceDebugger.printSummary(),
      clear: () => DBPerformanceDebugger.clearStats(),
      export: () => DBPerformanceDebugger.exportStats(),
    };

    (global as any).debugDB = debugDB;
    (console as any).debugDB = debugDB;

    if (typeof window !== 'undefined') {
      (window as any).debugDB = debugDB;
    }

    console.log(
      '🚀 简化版调试工具已加载: debugDB.stats(), debugDB.slow(), debugDB.summary()',
    );
  } catch (error) {
    console.error('❌ 暴露DBPerformanceDebugger失败:', error);
  }
}
