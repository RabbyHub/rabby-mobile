import { dbQueryMonitor, DBPerformanceDebugger } from './index';

/**
 * 测试数据库性能监控系统
 * 仅在开发环境下运行
 */
export async function testDBPerformanceMonitor() {
  if (!__DEV__) {
    console.log('测试仅在开发环境下运行');
    return;
  }

  console.log('🧪 开始测试数据库性能监控系统...');

  // 测试1: 模拟快速查询
  await dbQueryMonitor.monitorQuery(
    async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // 模拟10ms查询
      return { success: true };
    },
    {
      entity: 'TestEntity',
      method: 'fastQuery',
      query: 'SELECT * FROM test WHERE id = 1',
    },
  );

  // 测试2: 模拟慢查询
  await dbQueryMonitor.monitorQuery(
    async () => {
      await new Promise(resolve => setTimeout(resolve, 150)); // 模拟150ms查询
      return { success: true };
    },
    {
      entity: 'TestEntity',
      method: 'slowQuery',
      query:
        'SELECT * FROM test JOIN users ON test.user_id = users.id WHERE users.status = "active"',
    },
  );

  // 测试3: 模拟出错的查询
  try {
    await dbQueryMonitor.monitorQuery(
      async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        throw new Error('模拟数据库错误');
      },
      {
        entity: 'TestEntity',
        method: 'errorQuery',
        query: 'SELECT * FROM non_existent_table',
      },
    );
  } catch (error) {
    console.log('✅ 错误查询测试通过');
  }

  // 测试4: 模拟批量查询
  for (let i = 0; i < 5; i++) {
    await dbQueryMonitor.monitorQuery(
      async () => {
        await new Promise(resolve =>
          setTimeout(resolve, 20 + Math.random() * 30),
        );
        return { success: true, index: i };
      },
      {
        entity: 'TestEntity',
        method: 'batchQuery',
        query: `SELECT * FROM test WHERE batch_id = ${i}`,
      },
    );
  }

  console.log('✅ 所有测试查询完成');

  // 打印测试结果
  console.log('\n📊 测试结果:');
  DBPerformanceDebugger.printAllStats();

  console.log('\n🐌 慢查询检测:');
  DBPerformanceDebugger.printSlowQueries(50);

  console.log('\n📈 性能摘要:');
  DBPerformanceDebugger.printSummary();

  console.log('\n🎉 数据库性能监控系统测试完成!');
}

// 在开发环境下自动运行测试
if (__DEV__) {
  // 延迟5秒运行测试，确保系统初始化完成
  setTimeout(() => {
    testDBPerformanceMonitor();
  }, 5000);
}
