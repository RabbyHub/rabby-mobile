type AppStateListener = (state: string) => void;

const mockPushStackEntry = jest.fn();
const mockReplaceStackEntry = jest.fn();
const mockReapply = jest.fn();
const mockAppStateListeners = new Map<string, AppStateListener>();
const mockAppState = {
  addEventListener: jest.fn((event: string, listener: AppStateListener) => {
    mockAppStateListeners.set(event, listener);
    return {
      remove: () => mockAppStateListeners.delete(event),
    };
  }),
};

jest.doMock('react-native', () => ({ AppState: mockAppState }));

jest.doMock('react-native-edge-to-edge', () => ({
  SystemBars: {
    pushStackEntry: mockPushStackEntry,
    replaceStackEntry: mockReplaceStackEntry,
    reapply: mockReapply,
  },
}));

jest.doMock('@/hooks/theme', () => ({
  getBinaryMode: jest.fn(() => 'light'),
}));

jest.doMock('@/core/utils/perf', () => ({
  perfEvents: {
    addListener: jest.fn(),
  },
}));

jest.doMock('@/constant/layout', () => ({
  getScreenSystemBarConfig: jest.fn(() => ({
    statusBarStyle: 'dark-content',
    statusBarBackgroundColor: 'transparent',
  })),
}));

const { reapplyAppSystemBars, syncAppSystemBars } =
  require('./systemBarController') as typeof import('./systemBarController');

describe('app system bar controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPushStackEntry.mockReturnValue({ id: 'base' });
    mockReplaceStackEntry.mockImplementation(entry => entry);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps one base entry and replaces it on subsequent updates', () => {
    const firstEntry = { id: 'first' };
    const secondEntry = { id: 'second' };
    mockPushStackEntry.mockReturnValueOnce(firstEntry);
    mockReplaceStackEntry.mockReturnValueOnce(secondEntry);

    syncAppSystemBars({
      statusBarStyle: 'dark-content',
      statusBarBackgroundColor: 'transparent',
    });
    syncAppSystemBars({
      statusBarStyle: 'light-content',
      statusBarBackgroundColor: 'transparent',
    });

    expect(mockPushStackEntry).toHaveBeenCalledWith({ style: 'dark' });
    expect(mockReplaceStackEntry).toHaveBeenCalledWith(firstEntry, {
      style: 'light',
    });
  });

  it('coalesces active and focus events before reapplying native values', () => {
    jest.useFakeTimers();
    syncAppSystemBars({
      statusBarStyle: 'dark-content',
      statusBarBackgroundColor: 'transparent',
    });

    mockAppStateListeners.get('change')?.('active');
    mockAppStateListeners.get('focus')?.('active');
    jest.runOnlyPendingTimers();

    expect(mockReapply).toHaveBeenCalledTimes(1);

    mockAppStateListeners.get('focus')?.('active');
    jest.runOnlyPendingTimers();
    expect(mockReapply).toHaveBeenCalledTimes(2);

    reapplyAppSystemBars();
    expect(mockReapply).toHaveBeenCalledTimes(3);
  });
});
