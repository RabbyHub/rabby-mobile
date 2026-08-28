import { createPerpsOpenOrdersInvalidationCoordinator } from './openOrdersInvalidation';

describe('Perps frontend open-orders invalidation coordinator', () => {
  it('coalesces a WS burst and flushes only after authoritative HTTP refreshes', async () => {
    let resolveFirst: ((value: boolean) => void) | undefined;
    const fetchDex = jest
      .fn()
      .mockReturnValueOnce(
        new Promise<boolean>(resolve => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValue(true);
    const flush = jest.fn();
    const coordinator = createPerpsOpenOrdersInvalidationCoordinator({
      fetchDex,
      flush,
      isCurrentAddress: () => true,
    });

    coordinator.invalidate('0x1', ['']);
    coordinator.invalidate('0x1', ['', 'xyz']);

    expect(fetchDex).toHaveBeenCalledTimes(1);
    expect(flush).not.toHaveBeenCalled();

    resolveFirst?.(true);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(fetchDex).toHaveBeenCalledTimes(3);
    expect(fetchDex).toHaveBeenNthCalledWith(2, '', '0x1', 0);
    expect(fetchDex).toHaveBeenNthCalledWith(3, 'xyz', '0x1', 0);
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it('drops an in-flight session after account subscription reset', async () => {
    let resolveFetch: ((value: boolean) => void) | undefined;
    const flush = jest.fn();
    const coordinator = createPerpsOpenOrdersInvalidationCoordinator({
      fetchDex: () =>
        new Promise<boolean>(resolve => {
          resolveFetch = resolve;
        }),
      flush,
      isCurrentAddress: () => true,
    });

    coordinator.invalidate('0x1', ['']);
    coordinator.reset();
    resolveFetch?.(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(flush).not.toHaveBeenCalled();
    expect(coordinator.getGeneration()).toBe(1);
  });
});
