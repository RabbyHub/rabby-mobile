type PromptLocalStorageArchiveModule =
  typeof import('./promptLocalStorageArchive');

function loadPromptLocalStorageArchive(exportEnabled: boolean) {
  jest.resetModules();

  const alert = jest.fn();
  const shareCurrentLocalStorageArchive = jest.fn(async () => ({
    dismissed: true,
  }));
  const archiveModuleLoaded = jest.fn();

  jest.doMock('react-native', () => ({ Alert: { alert } }));
  jest.doMock('@/constant/env', () => ({
    IS_LOCAL_STORAGE_EXPORT_ENABLED: exportEnabled,
  }));
  jest.doMock('@/core/storage/localStorageArchive', () => {
    archiveModuleLoaded();
    return { shareCurrentLocalStorageArchive };
  });
  jest.doMock('@/components2024/Toast', () => ({
    toast: {
      show: jest.fn(),
      success: jest.fn(),
    },
  }));

  let module: PromptLocalStorageArchiveModule | undefined;
  jest.isolateModules(() => {
    module =
      require('./promptLocalStorageArchive') as PromptLocalStorageArchiveModule;
  });

  return {
    module: module as PromptLocalStorageArchiveModule,
    mocks: { alert, archiveModuleLoaded, shareCurrentLocalStorageArchive },
  };
}

describe('promptLocalStorageArchiveShare', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('never opens the hidden share prompt when the build switch is disabled', () => {
    const { module, mocks } = loadPromptLocalStorageArchive(false);

    for (let tap = 0; tap < 20; tap += 1) {
      module.promptLocalStorageArchiveShare();
    }

    expect(mocks.alert).not.toHaveBeenCalled();
    expect(mocks.shareCurrentLocalStorageArchive).not.toHaveBeenCalled();
    expect(mocks.archiveModuleLoaded).not.toHaveBeenCalled();
  });

  it('opens confirmation in diagnostic builds without loading storage', () => {
    const { module, mocks } = loadPromptLocalStorageArchive(true);

    module.promptLocalStorageArchiveShare();

    expect(mocks.alert).toHaveBeenCalledWith(
      'Export local storage?',
      expect.any(String),
      expect.any(Array),
      expect.any(Object),
    );
    expect(mocks.archiveModuleLoaded).not.toHaveBeenCalled();
  });

  it('does not export on cancellation and allows another prompt', () => {
    const { module, mocks } = loadPromptLocalStorageArchive(true);
    module.promptLocalStorageArchiveShare();
    module.promptLocalStorageArchiveShare();
    expect(mocks.alert).toHaveBeenCalledTimes(1);
    mocks.alert.mock.calls[0][2][0].onPress();
    expect(mocks.archiveModuleLoaded).not.toHaveBeenCalled();
    module.promptLocalStorageArchiveShare();
    expect(mocks.alert).toHaveBeenCalledTimes(2);
  });

  it('loads storage only after confirmation and releases its busy guard after failure', async () => {
    const { module, mocks } = loadPromptLocalStorageArchive(true);
    mocks.shareCurrentLocalStorageArchive.mockRejectedValueOnce(
      new Error('failed'),
    );
    module.promptLocalStorageArchiveShare();
    mocks.alert.mock.calls[0][2][1].onPress();
    module.promptLocalStorageArchiveShare();
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(mocks.shareCurrentLocalStorageArchive).toHaveBeenCalledTimes(1);
    expect(mocks.alert).toHaveBeenCalledWith(
      'Local storage export failed',
      'failed',
    );
    module.promptLocalStorageArchiveShare();
    expect(mocks.alert).toHaveBeenCalledTimes(3);
  });
});
