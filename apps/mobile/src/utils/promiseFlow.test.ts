import PromiseFlow from './promiseFlow';

describe('PromiseFlow', () => {
  it('rejects non-function tasks', () => {
    const flow = new PromiseFlow();

    expect(() => flow.use(123 as any)).toThrow(
      'promise need function to handle',
    );
  });

  it('composes tasks in middleware order', async () => {
    const flow = new PromiseFlow<{ steps: string[]; value: number }>();

    flow.use(async (ctx, next) => {
      ctx.steps.push('outer:start');
      await next();
      ctx.steps.push('outer:end');
    });

    flow.use(async (ctx, next) => {
      ctx.steps.push('inner:start');
      ctx.value += 1;
      await next();
      ctx.steps.push('inner:end');
    });

    const ctx = { steps: [] as string[], value: 0 };
    await flow.callback()(ctx, async () => {
      ctx.steps.push('tail');
    });

    expect(ctx).toEqual({
      steps: ['outer:start', 'inner:start', 'tail', 'inner:end', 'outer:end'],
      value: 1,
    });
  });
});
