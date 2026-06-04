const loadSubject = () => {
  jest.resetModules();
  const baseGetStateForAction = jest.fn(() => ({ key: 'next-state' }));
  const stackRouter = jest.fn(() => ({
    getStateForAction: baseGetStateForAction,
  }));

  jest.doMock('@react-navigation/native', () => ({
    StackRouter: (...args: unknown[]) => stackRouter(...args),
  }));

  const { CustomStackRouter } =
    require('./CustomStackRouter') as typeof import('./CustomStackRouter');

  return {
    CustomStackRouter,
    baseGetStateForAction,
    stackRouter,
  };
};

describe('CustomStackRouter', () => {
  afterEach(() => {
    jest.dontMock('@react-navigation/native');
    jest.resetModules();
  });

  it('returns null for duplicate PUSH actions with deeply equal params', () => {
    const { CustomStackRouter, baseGetStateForAction } = loadSubject();
    const router = CustomStackRouter({} as any);
    const state = {
      routes: [
        { name: 'Home', params: undefined },
        { name: 'Detail', params: { id: 1, nested: { tab: 'token' } } },
      ],
    } as any;

    expect(
      router.getStateForAction(
        state,
        {
          type: 'PUSH',
          payload: {
            name: 'Detail',
            params: { id: 1, nested: { tab: 'token' } },
          },
        } as any,
        {} as any,
      ),
    ).toBeNull();
    expect(baseGetStateForAction).not.toHaveBeenCalled();
  });

  it('delegates non-duplicate pushes and non-push actions to the base router', () => {
    const { CustomStackRouter, baseGetStateForAction } = loadSubject();
    const router = CustomStackRouter({ initialRouteName: 'Home' } as any);
    const state = {
      routes: [{ name: 'Detail', params: { id: 1 } }],
    } as any;

    expect(
      router.getStateForAction(
        state,
        {
          type: 'PUSH',
          payload: { name: 'Detail', params: { id: 2 } },
        } as any,
        { routeNames: ['Detail'] } as any,
      ),
    ).toEqual({ key: 'next-state' });
    expect(
      router.getStateForAction(
        state,
        {
          type: 'POP',
          payload: { count: 1 },
        } as any,
        {} as any,
      ),
    ).toEqual({ key: 'next-state' });
    expect(baseGetStateForAction).toHaveBeenCalledTimes(2);
  });
});
