const mockPushStackEntry = jest.fn();
const mockReplaceStackEntry = jest.fn();

jest.doMock('react-native-edge-to-edge', () => ({
  SystemBars: {
    pushStackEntry: mockPushStackEntry,
    replaceStackEntry: mockReplaceStackEntry,
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

const { syncAppSystemBars } =
  require('./systemBarController') as typeof import('./systemBarController');

describe('app system bar controller', () => {
  it('keeps one base entry and replaces it on subsequent updates', () => {
    const firstEntry = { id: 'first' };
    const secondEntry = { id: 'second' };
    mockPushStackEntry.mockReturnValueOnce(firstEntry);
    mockReplaceStackEntry.mockReturnValueOnce(secondEntry);

    syncAppSystemBars('dark-content');
    syncAppSystemBars('light-content');

    expect(mockPushStackEntry).toHaveBeenCalledWith({ style: 'dark' });
    expect(mockReplaceStackEntry).toHaveBeenCalledWith(firstEntry, {
      style: 'light',
    });
  });
});
