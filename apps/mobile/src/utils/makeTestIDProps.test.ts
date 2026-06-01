const loadSubject = (runtimeEnv: string) => {
  jest.resetModules();
  jest.doMock('@/constant/e2e', () => ({
    E2E_ID: {
      Button: {
        Submit: 'button.submit',
      },
    },
  }));
  jest.doMock('@/constant/env', () => ({
    APP_RUNTIME_ENV: runtimeEnv,
  }));
  return require('./makeTestIDProps') as typeof import('./makeTestIDProps');
};

describe('makeTestIDProps', () => {
  afterEach(() => {
    jest.dontMock('@/constant/e2e');
    jest.dontMock('@/constant/env');
    jest.resetModules();
  });

  it('returns testID and default accessibilityLabel outside production', () => {
    const { makeTestIDProps } = loadSubject('development');

    expect(makeTestIDProps('button.submit')).toEqual({
      testID: 'button.submit',
      accessibilityLabel: 'button.submit',
    });
  });

  it('allows an explicit accessibility label outside production', () => {
    const { makeTestIDProps } = loadSubject('regression');

    expect(makeTestIDProps('button.submit', 'button.submit')).toEqual({
      testID: 'button.submit',
      accessibilityLabel: 'button.submit',
    });
  });

  it('hides test IDs in production or when the id is empty', () => {
    expect(loadSubject('production').makeTestIDProps('button.submit')).toEqual(
      {},
    );
    expect(loadSubject('development').makeTestIDProps(null)).toEqual({});
  });
});
