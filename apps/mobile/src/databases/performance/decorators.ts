import { dbQueryMonitor } from './dbQueryMonitor';

/**
 * 数据库查询性能监控装饰器
 * 用于监控静态方法的数据库查询性能
 */
export function monitorDBQuery(
  options: {
    entity?: string;
    method?: string;
    reportToStats?: boolean;
  } = {},
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;
    const entityName = options.entity || target.constructor.name;
    const methodName = options.method || propertyName;

    descriptor.value = async function (...args: any[]) {
      return dbQueryMonitor.monitorQuery(() => method.apply(this, args), {
        entity: entityName,
        method: methodName,
        reportToStats: options.reportToStats ?? true,
      });
    };

    return descriptor;
  };
}

/**
 * 监控原始SQL查询的装饰器
 */
export function monitorRawQuery(
  options: {
    entity?: string;
    method?: string;
    reportToStats?: boolean;
  } = {},
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;
    const entityName = options.entity || target.constructor.name;
    const methodName = options.method || propertyName;

    descriptor.value = async function (...args: any[]) {
      // 尝试从参数中提取SQL查询
      let query = 'unknown';
      if (args.length > 0 && typeof args[0] === 'string') {
        query = args[0].substring(0, 200); // 限制长度
      }

      return dbQueryMonitor.monitorQuery(() => method.apply(this, args), {
        query,
        entity: entityName,
        method: methodName,
        reportToStats: options.reportToStats ?? true,
      });
    };

    return descriptor;
  };
}
