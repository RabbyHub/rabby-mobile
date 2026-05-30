const rootNames = {
  GetStarted: 'GetStarted',
  Home: 'Home',
  ImportNewAddress: 'ImportNewAddress',
  StackAddress: 'StackAddress',
  StackGetStarted: 'StackGetStarted',
  StackRoot: 'StackRoot',
};

const createMockRef = () => ({
  current: { id: 'nav-current' },
  dispatch: jest.fn(),
  getCurrentRoute: jest.fn(),
  isReady: jest.fn(),
  navigate: jest.fn(),
  navigateDeprecated: jest.fn(),
  resetRoot: jest.fn(),
});

const loadSubject = () => {
  jest.resetModules();
  const mockRef = createMockRef();
  const push = jest.fn((name, params) => ({
    type: 'PUSH',
    payload: { name, params },
  }));
  const replace = jest.fn((name, params) => ({
    type: 'REPLACE',
    payload: { name, params },
  }));
  const reset = jest.fn(payload => ({
    type: 'RESET',
    payload,
  }));

  jest.doMock('@/constant/layout', () => ({
    RootNames: rootNames,
  }));
  jest.doMock('@react-navigation/native', () => ({
    CommonActions: { reset },
    StackActions: { push, replace },
    createNavigationContainerRef: () => mockRef,
  }));
  jest.doMock('@react-navigation/native-stack', () => ({}));

  const navigation = require('./navigation') as typeof import('./navigation');
  return {
    ...navigation,
    mockRef,
    push,
    replace,
    reset,
  };
};

describe('navigation utils', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.dontMock('@/constant/layout');
    jest.dontMock('@react-navigation/native');
    jest.dontMock('@react-navigation/native-stack');
    jest.resetModules();
  });

  it('returns ready navigation refs and current route names defensively', () => {
    const subject = loadSubject();

    subject.mockRef.isReady.mockReturnValue(false);
    expect(subject.getReadyNavigationInstance()).toBeNull();
    expect(subject.getLatestNavigationName()).toBeUndefined();

    subject.mockRef.isReady.mockReturnValue(true);
    subject.mockRef.getCurrentRoute.mockReturnValue({ name: 'Home' });
    expect(subject.getReadyNavigationInstance()).toBe(subject.mockRef.current);
    expect(subject.getLatestNavigationName()).toBe('Home');

    subject.mockRef.isReady.mockImplementation(() => {
      throw new Error('not mounted');
    });
    expect(subject.getLatestNavigationName()).toBeUndefined();
  });

  it('dispatches navigation helpers only when the ref is ready', () => {
    const subject = loadSubject();

    subject.mockRef.isReady.mockReturnValue(false);
    subject.navigate('Home' as never);
    subject.navigateDeprecated('Home' as never);
    subject.naviPush('Home' as never, { id: 1 } as never);
    subject.naviReplace('Home' as never, { id: 2 });

    expect(subject.mockRef.navigate).not.toHaveBeenCalled();
    expect(subject.mockRef.navigateDeprecated).not.toHaveBeenCalled();
    expect(subject.mockRef.dispatch).not.toHaveBeenCalled();

    subject.mockRef.isReady.mockReturnValue(true);
    subject.navigate('Home' as never);
    subject.navigateDeprecated('Home' as never);
    subject.naviPush('Detail' as never, { id: 1 } as never);
    subject.naviReplace('Detail' as never, { id: 2 });

    expect(subject.mockRef.navigate).toHaveBeenCalledWith('Home');
    expect(subject.mockRef.navigateDeprecated).toHaveBeenCalledWith('Home');
    expect(subject.push).toHaveBeenCalledWith('Detail', { id: 1 });
    expect(subject.replace).toHaveBeenCalledWith('Detail', { id: 2 });
    expect(subject.mockRef.dispatch).toHaveBeenCalledWith({
      type: 'PUSH',
      payload: { name: 'Detail', params: { id: 1 } },
    });
    expect(subject.mockRef.dispatch).toHaveBeenCalledWith({
      type: 'REPLACE',
      payload: { name: 'Detail', params: { id: 2 } },
    });
  });

  it('goes back when possible and otherwise resets to a default route', () => {
    const subject = loadSubject();
    const navigation = {
      canGoBack: jest.fn().mockReturnValue(true),
      goBack: jest.fn(),
    };

    subject.redirectBackErrorHandler(navigation, 'Fallback');

    expect(navigation.goBack).toHaveBeenCalled();
    expect(subject.mockRef.resetRoot).not.toHaveBeenCalled();

    navigation.canGoBack.mockReturnValue(false);
    subject.redirectBackErrorHandler(navigation, 'Fallback');

    expect(subject.mockRef.resetRoot).toHaveBeenCalledWith({
      index: 0,
      routes: [
        {
          name: 'Root',
          state: {
            index: 0,
            routes: [{ name: 'Fallback' }],
          },
        },
      ],
    });
  });

  it('routes add-address entry actions through classical and get-started stacks', () => {
    const subject = loadSubject();
    subject.mockRef.isReady.mockReturnValue(true);

    subject.redirectToAddAddressEntry();
    expect(subject.mockRef.navigateDeprecated).toHaveBeenCalledWith(
      rootNames.StackAddress,
      {
        screen: rootNames.ImportNewAddress,
      },
    );

    subject.redirectToAddAddressEntry({ action: 'classical:replace' });
    expect(subject.mockRef.dispatch).toHaveBeenCalledWith({
      type: 'REPLACE',
      payload: {
        name: rootNames.StackAddress,
        params: { screen: rootNames.ImportNewAddress },
      },
    });

    subject.redirectToAddAddressEntry({ action: 'resetTo' });
    expect(subject.mockRef.resetRoot).toHaveBeenCalledWith({
      index: 0,
      routes: [
        {
          name: rootNames.StackGetStarted,
          state: {
            index: 0,
            routes: [{ name: rootNames.GetStarted }],
          },
        },
      ],
    });
  });

  it('resets navigation on top of Home before replacing to a first screen', () => {
    const subject = loadSubject();
    subject.mockRef.isReady.mockReturnValue(true);

    subject.replaceToFirst('Settings' as never, { tab: 'security' });

    expect(subject.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [
        {
          name: rootNames.StackRoot,
          params: {
            screen: rootNames.Home,
          },
        },
        {
          name: 'Settings',
          params: { tab: 'security' },
        },
      ],
    });
    expect(subject.mockRef.dispatch).toHaveBeenCalledWith({
      type: 'RESET',
      payload: expect.objectContaining({ index: 0 }),
    });
  });
});
