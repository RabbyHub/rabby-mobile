import { stats } from '@/utils/stats';

export interface QueryPerformanceData {
  query: string;
  duration: number;
  entity?: string;
  method?: string;
  timestamp: number;
  success: boolean;
  error?: string;
}

export class DBQueryMonitor {
  private static instance: DBQueryMonitor;
  private queryStats: Map<
    string,
    { count: number; totalTime: number; avgTime: number }
  > = new Map();

  static getInstance(): DBQueryMonitor {
    if (!DBQueryMonitor.instance) {
      DBQueryMonitor.instance = new DBQueryMonitor();
    }
    return DBQueryMonitor.instance;
  }

  /**
   * 监控查询性能
   */
  async monitorQuery<T>(
    queryFn: () => Promise<T>,
    options: {
      query?: string;
      entity?: string;
      method?: string;
      reportToStats?: boolean;
    } = {},
  ): Promise<T> {
    const startTime = Date.now();
    const {
      query = 'unknown',
      entity = 'unknown',
      method = 'unknown',
      reportToStats = true,
    } = options;

    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;

      this.recordQueryPerformance({
        query,
        duration,
        entity,
        method,
        timestamp: startTime,
        success: true,
      });

      if (reportToStats && duration > 100) {
        // 只报告耗时超过100ms的查询
        this.reportToStats(query, duration, entity, method);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.recordQueryPerformance({
        query,
        duration,
        entity,
        method,
        timestamp: startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      if (reportToStats) {
        this.reportToStats(query, duration, entity, method, true);
      }

      throw error;
    }
  }

  /**
   * 记录查询性能数据
   */
  private recordQueryPerformance(data: QueryPerformanceData): void {
    const key = `${data.entity}:${data.method}`;
    const existing = this.queryStats.get(key) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
    };

    existing.count += 1;
    existing.totalTime += data.duration;
    existing.avgTime = existing.totalTime / existing.count;

    this.queryStats.set(key, existing);

    // 开发环境下打印详细日志
    if (__DEV__) {
      const status = data.success ? '✅' : '❌';
      const errorInfo = data.error ? ` (${data.error})` : '';
      console.log(
        `[DB Query] ${status} ${data.entity}.${data.method} - ${data.duration}ms${errorInfo}`,
      );
    }
  }

  /**
   * 上报到统计系统
   */
  private reportToStats(
    query: string,
    duration: number,
    entity: string,
    method: string,
    isError: boolean = false,
  ): void {
    try {
      stats.report('dbQueryPerformance', {
        query: query.substring(0, 100), // 限制长度避免过长
        duration,
        entity,
        method,
        isError,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[DBQueryMonitor] Failed to report stats:', error);
    }
  }

  /**
   * 获取查询统计信息
   */
  getQueryStats(): Map<
    string,
    { count: number; totalTime: number; avgTime: number }
  > {
    return new Map(this.queryStats);
  }

  /**
   * 清除统计信息
   */
  clearStats(): void {
    this.queryStats.clear();
  }

  /**
   * 获取慢查询（平均耗时超过阈值）
   */
  getSlowQueries(threshold: number = 100): Array<{
    key: string;
    stats: { count: number; totalTime: number; avgTime: number };
  }> {
    const slowQueries: Array<{
      key: string;
      stats: { count: number; totalTime: number; avgTime: number };
    }> = [];

    for (const [key, stats] of this.queryStats.entries()) {
      if (stats.avgTime > threshold) {
        slowQueries.push({ key, stats });
      }
    }

    return slowQueries.sort((a, b) => b.stats.avgTime - a.stats.avgTime);
  }
}

export const dbQueryMonitor = DBQueryMonitor.getInstance();
