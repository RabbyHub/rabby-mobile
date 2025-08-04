/**
 * 检查数据库性能监控调试工具是否可用
 * 在控制台中运行此函数来验证调试工具的状态
 */
export function checkDBPerformanceDebugger() {
  console.log('🔍 检查数据库性能监控调试工具状态...');

  const checks = [
    {
      name: 'global.DBPerformanceDebugger',
      available: typeof (global as any).DBPerformanceDebugger !== 'undefined',
      value: (global as any).DBPerformanceDebugger,
    },
    {
      name: 'console.DBPerformanceDebugger',
      available: typeof (console as any).DBPerformanceDebugger !== 'undefined',
      value: (console as any).DBPerformanceDebugger,
    },
    {
      name: 'global.debugDB',
      available: typeof (global as any).debugDB !== 'undefined',
      value: (global as any).debugDB,
    },
    {
      name: 'console.debugDB',
      available: typeof (console as any).debugDB !== 'undefined',
      value: (console as any).debugDB,
    },
  ];

  if (typeof window !== 'undefined') {
    checks.push(
      {
        name: 'window.DBPerformanceDebugger',
        available: typeof (window as any).DBPerformanceDebugger !== 'undefined',
        value: (window as any).DBPerformanceDebugger,
      },
      {
        name: 'window.debugDB',
        available: typeof (window as any).debugDB !== 'undefined',
        value: (window as any).debugDB,
      },
    );
  }

  console.table(
    checks.map(check => ({
      检查项: check.name,
      可用: check.available ? '✅' : '❌',
      类型: check.available ? typeof check.value : 'undefined',
    })),
  );

  const availableTools = checks.filter(check => check.available);

  if (availableTools.length > 0) {
    console.log('✅ 调试工具可用! 可以使用以下方式访问:');
    availableTools.forEach(check => {
      console.log(`  - ${check.name}`);
    });

    // 尝试调用一个简单的函数来验证功能
    try {
      if ((global as any).debugDB) {
        console.log('🧪 测试调试工具功能...');
        (global as any).debugDB.summary();
      }
    } catch (error) {
      console.error('❌ 调试工具功能测试失败:', error);
    }
  } else {
    console.error('❌ 调试工具不可用!');
    console.log('💡 可能的解决方案:');
    console.log('  1. 确保在开发环境下运行');
    console.log('  2. 重启应用');
    console.log('  3. 检查控制台是否有错误信息');
    console.log(
      '  4. 手动导入: import { DBPerformanceDebugger } from "@/databases/performance"',
    );
  }

  return availableTools.length > 0;
}

// 在开发环境下自动暴露检查函数
if (__DEV__) {
  try {
    (global as any).checkDBDebugger = checkDBPerformanceDebugger;
    (console as any).checkDBDebugger = checkDBPerformanceDebugger;

    if (typeof window !== 'undefined') {
      (window as any).checkDBDebugger = checkDBPerformanceDebugger;
    }

    console.log('🔧 检查函数已加载: checkDBDebugger()');
  } catch (error) {
    console.error('❌ 暴露检查函数失败:', error);
  }
}
