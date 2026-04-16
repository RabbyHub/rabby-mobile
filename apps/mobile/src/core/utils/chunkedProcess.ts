import { unstable_scheduleCallback, unstable_IdlePriority } from 'scheduler';

export async function processInChunks<T, R>(
  items: T[],
  processor: (item: T) => R,
  options: { maxTimePerChunk?: number; chunkSize?: number } = {},
): Promise<R[]> {
  const { maxTimePerChunk = 4, chunkSize = 10 } = options;
  const result: R[] = [];
  let index = 0;

  return new Promise<R[]>(resolve => {
    const work = () => {
      const start = performance.now();
      let processed = 0;

      while (
        index < items.length &&
        processed < chunkSize &&
        performance.now() - start < maxTimePerChunk
      ) {
        result.push(processor(items[index]));
        index++;
        processed++;
      }

      if (index < items.length) {
        unstable_scheduleCallback(unstable_IdlePriority, work);
      } else {
        resolve(result);
      }
    };

    work();
  });
}
