type PromptLocalStorageArchiveModule =
  typeof import('./promptLocalStorageArchive');

function loadPromptLocalStorageArchive(isNonPublicProductionEnv: boolean) {
  jest.resetModules();

  const alert = jest.fn();
  const shareCurrentLocalStorageArchive = jest.fn();

  jest.doMock('react-native', () => ({ Alert: { alert } }));
  jest.doMock('@/constant', () => ({ isNonPublicProductionEnv }));
  jest.doMock('@/core/storage/localStorageArchive', () => ({
    shareCurrentLocalStorageArchive,
  }));
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
    mocks: { alert, shareCurrentLocalStorageArchive },
  };
}

describe('promptLocalStorageArchiveShare', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('never opens the hidden share prompt in production builds', () => {
    const { module, mocks } = loadPromptLocalStorageArchive(false);

    for (let tap = 0; tap < 20; tap += 1) {
      module.promptLocalStorageArchiveShare();
    }

    expect(mocks.alert).not.toHaveBeenCalled();
    expect(mocks.shareCurrentLocalStorageArchive).not.toHaveBeenCalled();
  });

  it('opens the confirmation prompt in non-production builds', () => {
    const { module, mocks } = loadPromptLocalStorageArchive(true);

    module.promptLocalStorageArchiveShare();

    expect(mocks.alert).toHaveBeenCalledWith(
      'Export local storage?',
      expect.any(String),
      expect.any(Array),
      expect.any(Object),
    );
  });
});
