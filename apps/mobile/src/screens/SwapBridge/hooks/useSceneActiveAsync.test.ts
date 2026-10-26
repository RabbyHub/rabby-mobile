import { createSceneActiveAsyncController } from './useSceneActiveAsync';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(nextResolve => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('createSceneActiveAsyncController', () => {
  it('does not start work while inactive', () => {
    const controller = createSceneActiveAsyncController();
    const run = jest.fn(async () => 1);
    const onStart = jest.fn();

    controller.run(run, {
      onStart,
      onValue: jest.fn(),
      onError: jest.fn(),
    });

    expect(run).not.toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
  });

  it('publishes an active request result', async () => {
    const controller = createSceneActiveAsyncController();
    const request = deferred<number>();
    const onStart = jest.fn();
    const onValue = jest.fn();

    controller.setActive(true);
    controller.run(() => request.promise, {
      onStart,
      onValue,
      onError: jest.fn(),
    });

    expect(onStart).toHaveBeenCalledTimes(1);

    request.resolve(1);
    await request.promise;
    await Promise.resolve();

    expect(onValue).toHaveBeenCalledWith(1);
  });

  it('drops an in-flight result after deactivation', async () => {
    const controller = createSceneActiveAsyncController();
    const request = deferred<number>();
    const onValue = jest.fn();

    controller.setActive(true);
    controller.run(() => request.promise, {
      onStart: jest.fn(),
      onValue,
      onError: jest.fn(),
    });
    controller.setActive(false);

    request.resolve(1);
    await request.promise;
    await Promise.resolve();

    expect(onValue).not.toHaveBeenCalled();
  });

  it('publishes only the latest request after reactivation', async () => {
    const controller = createSceneActiveAsyncController();
    const first = deferred<number>();
    const second = deferred<number>();
    const onValue = jest.fn();
    const handlers = {
      onStart: jest.fn(),
      onValue,
      onError: jest.fn(),
    };

    controller.setActive(true);
    controller.run(() => first.promise, handlers);
    controller.setActive(false);
    controller.setActive(true);
    controller.run(() => second.promise, handlers);

    first.resolve(1);
    second.resolve(2);
    await Promise.all([first.promise, second.promise]);
    await Promise.resolve();

    expect(onValue).toHaveBeenCalledTimes(1);
    expect(onValue).toHaveBeenCalledWith(2);
  });
});
