describe('redirectToAddAddressEntry', () => {
  const mockPerfEmit = jest.fn();
  const mockResetRoot = jest.fn();
  const mockNavigateDeprecated = jest.fn();
  const mockDispatch = jest.fn();

  let redirectToAddAddressEntry: typeof import('./navigation')['redirectToAddAddressEntry'];

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.doMock('@/constant/layout', () => ({
      RootNames: {
        GetStarted: 'GetStarted',
        Home: 'Home',
        ImportNewAddress: 'ImportNewAddress',
        StackAddress: 'StackAddress',
        StackGetStarted: 'StackGetStarted',
        StackRoot: 'StackRoot',
      },
    }));
    jest.doMock('@/core/utils/perf', () => ({
      perfEvents: {
        emit: (...args: unknown[]) => mockPerfEmit(...args),
      },
    }));
    jest.doMock('@react-navigation/native', () => ({
      CommonActions: {
        reset: jest.fn(),
      },
      StackActions: {
        push: jest.fn(),
        replace: jest.fn(),
      },
      createNavigationContainerRef: jest.fn(() => ({
        current: {},
        dispatch: (...args: unknown[]) => mockDispatch(...args),
        isReady: jest.fn(() => true),
        navigate: jest.fn(),
        navigateDeprecated: (...args: unknown[]) =>
          mockNavigateDeprecated(...args),
        resetRoot: (...args: unknown[]) => mockResetRoot(...args),
      })),
    }));

    ({ redirectToAddAddressEntry } = require('./navigation'));
  });

  it.each([
    ['resetTo', 'StackGetStarted', 'GetStarted'],
    ['classical:resetTo', 'Root', 'ImportNewAddress'],
  ] as const)(
    'clears covered components before handling %s',
    (action, rootName, screenName) => {
      redirectToAddAddressEntry({ action });

      expect(mockPerfEmit).toHaveBeenCalledWith(
        'GLOBAL_CLEAR_ALL_COVERED_COMPONENTS',
      );
      expect(mockResetRoot).toHaveBeenCalledWith({
        index: 0,
        routes: [
          {
            name: rootName,
            state: {
              index: 0,
              routes: [{ name: screenName }],
            },
          },
        ],
      });
      expect(mockPerfEmit.mock.invocationCallOrder[0]).toBeLessThan(
        mockResetRoot.mock.invocationCallOrder[0],
      );
    },
  );

  it.each(['push', 'replace', 'classical:push', 'classical:replace'] as const)(
    'does not clear covered components for %s',
    action => {
      redirectToAddAddressEntry({ action });

      expect(mockPerfEmit).not.toHaveBeenCalled();
      expect(mockResetRoot).not.toHaveBeenCalled();
    },
  );
});
