import { DBPerformanceDebugger } from './debug';
import { checkDBPerformanceDebugger } from './check';

/**
 * 初始化数据库性能监控调试工具
 * 确保在应用启动时加载并暴露调试工具
 */
export function initDBPerformanceDebugger() {
  if (!__DEV__) {
    return;
  }

  console.log('🔧 正在初始化数据库性能监控调试工具...');

  try {
    // 确保调试工具可用
    const debugDB = {
      stats: () => DBPerformanceDebugger.printAllStats(),
      slow: (threshold = 100) =>
        DBPerformanceDebugger.printSlowQueries(threshold),
      summary: () => DBPerformanceDebugger.printSummary(),
      clear: () => DBPerformanceDebugger.clearStats(),
      export: () => DBPerformanceDebugger.exportStats(),
      // 完整版
      full: DBPerformanceDebugger,
    };

    // 暴露到多个全局对象
    const globalObjects = [
      global,
      console,
      typeof window !== 'undefined' ? window : null,
      typeof self !== 'undefined' ? self : null,
    ].filter(Boolean);

    globalObjects.forEach((obj: any) => {
      if (obj) {
        obj.DBPerformanceDebugger = DBPerformanceDebugger;
        obj.debugDB = debugDB;
      }
    });

    console.log('✅ 数据库性能监控调试工具初始化成功!');
    console.log('📝 使用方法:');
    console.log('  - debugDB.stats() - 查看所有查询统计');
    console.log('  - debugDB.slow(50) - 查看慢查询(阈值50ms)');
    console.log('  - debugDB.summary() - 查看性能摘要');
    console.log('  - debugDB.clear() - 清除统计信息');
    console.log('  - debugDB.export() - 导出性能数据');
    console.log('  - DBPerformanceDebugger.printAllStats() - 完整版API');

    // 延迟2秒后打印初始摘要
    setTimeout(() => {
      console.log('📊 初始性能摘要:');
      DBPerformanceDebugger.printSummary();

      // 检查调试工具状态
      console.log('🔍 检查调试工具状态:');
      checkDBPerformanceDebugger();
    }, 2000);
  } catch (error) {
    console.error('❌ 初始化数据库性能监控调试工具失败:', error);
  }
}

// 自动初始化
if (__DEV__) {
  // 确保在模块加载时立即初始化
  initDBPerformanceDebugger();
}
