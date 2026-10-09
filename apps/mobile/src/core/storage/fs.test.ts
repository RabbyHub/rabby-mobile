type AppScreenshotFSModule = typeof import('./fs');

const TMP = '/mock/tmp';
const SCREENSHOT_DIR = `${TMP}/.screenshots`;
const NATIVE_CAPTURE_DIR = `${TMP}/rabby-screen-capture`;
const CAPTURE_PATH = `${NATIVE_CAPTURE_DIR}/rabby-screen-capture-1.png`;

function loadFsModule({
  existingDirs = [] as string[],
  existingFiles = {} as Record<string, string>,
} = {}) {
  jest.resetModules();

  const directories = new Set(existingDirs);
  const files = new Map(Object.entries(existingFiles));
  // Preserve the asynchronous, serial ordering of the iOS native FS queue.
  let nativeQueue = Promise.resolve<unknown>(undefined);
  function onNativeQueue<T>(action: () => T): Promise<T> {
    const next = nativeQueue
      .then(() => new Promise<void>(resolve => setImmediate(resolve)))
      .then(action);
    nativeQueue = next.catch(() => undefined);
    return next;
  }

  const exists = jest.fn((path: string) =>
    onNativeQueue(() => directories.has(path) || files.has(path)),
  );
  const unlink = jest.fn((path: string) =>
    onNativeQueue(() => {
      for (const entry of [...directories, ...files.keys()]) {
        if (entry === path || entry.startsWith(`${path}/`)) {
          directories.delete(entry);
          files.delete(entry);
        }
      }
    }),
  );
  const mkdir = jest.fn((path: string) =>
    onNativeQueue(() => {
      directories.add(path);
    }),
  );
  const persistFile = jest.fn((source: string, target: string) =>
    onNativeQueue(() => {
      const contents = files.get(source);
      if (contents === undefined) {
        throw new Error('ENOENT: screenshot source does not exist');
      }
      directories.add(target.slice(0, target.lastIndexOf('/')));
      files.set(target, contents);
    }),
  );
  const captureException = jest.fn();

  jest.doMock('@rabby-wallet/react-native-fs', () => ({
    TemporaryDirectoryPath: TMP,
    CachesDirectoryPath: '/mock/caches',
    exists,
    unlink,
    mkdir,
    persistFile,
    writeFile: jest.fn(async () => undefined),
    readFile: jest.fn(async () => ''),
  }));
  jest.doMock('@sentry/react-native', () => ({ captureException }));
  jest.doMock('@/constant', () => ({
    APP_IDS: { forScreenshot: 'rabby' },
    INITIAL_OPENAPI_URL: 'https://openapi.test',
  }));

  let module: AppScreenshotFSModule | undefined;
  jest.isolateModules(() => {
    module = require('./fs');
  });

  return {
    module: module!,
    directories,
    files,
    exists,
    unlink,
    mkdir,
    captureException,
  };
}

describe('AppScreenshotFS', () => {
  it('preserves the first capture when the module is loaded by a screenshot event', async () => {
    const { module, exists, files } = loadFsModule({
      existingDirs: [NATIVE_CAPTURE_DIR],
      existingFiles: { [CAPTURE_PATH]: 'captured image' },
    });

    // The native file already exists when a lazy screenshot callback first
    // accesses AppScreenshotFS. Module evaluation must not start a sweep.
    const source = module.AppScreenshotFS.normalizeLocalFilePath(CAPTURE_PATH);
    expect(await exists(source)).toBe(true);
    const savedPath = await module.appScreenshotFS.saveScreenshotFrom(source, {
      imageType: 'png',
      cleanupSource: true,
    });

    expect(savedPath).toBeTruthy();
    expect(
      files.get(module.AppScreenshotFS.normalizeLocalFilePath(savedPath!)),
    ).toBe('captured image');
    expect(files.has(CAPTURE_PATH)).toBe(false);
  });

  it('cleans old captures before recreating the screenshot directory', async () => {
    const { module, directories, files } = loadFsModule({
      existingDirs: [SCREENSHOT_DIR, NATIVE_CAPTURE_DIR],
      existingFiles: {
        [`${SCREENSHOT_DIR}/old.jpg`]: 'old feedback image',
        [CAPTURE_PATH]: 'old native capture',
      },
    });

    await module.appScreenshotFS.initializeBeforeCapture();

    expect(files.size).toBe(0);
    expect(directories.has(NATIVE_CAPTURE_DIR)).toBe(false);
    expect(directories.has(SCREENSHOT_DIR)).toBe(true);
  });

  it('shares initialization and never sweeps captures created after it completes', async () => {
    const { module, files, directories } = loadFsModule();
    const first = module.appScreenshotFS.initializeBeforeCapture();
    const concurrent = module.appScreenshotFS.initializeBeforeCapture();
    expect(concurrent).toBe(first);
    await first;

    directories.add(NATIVE_CAPTURE_DIR);
    files.set(CAPTURE_PATH, 'new capture');
    await module.appScreenshotFS.initializeBeforeCapture();

    const savedPath = await module.appScreenshotFS.saveScreenshotFrom(
      CAPTURE_PATH,
      { imageType: 'png', cleanupSource: true },
    );
    expect(
      files.get(module.AppScreenshotFS.normalizeLocalFilePath(savedPath!)),
    ).toBe('new capture');
    expect(files.has(CAPTURE_PATH)).toBe(false);
  });

  it('continues preparing capture storage when one old directory cannot be removed', async () => {
    const { module, unlink, captureException, directories, files } =
      loadFsModule({
        existingDirs: [SCREENSHOT_DIR, NATIVE_CAPTURE_DIR],
        existingFiles: { [CAPTURE_PATH]: 'old capture' },
      });
    const error = new Error('cannot remove old feedback directory');
    unlink.mockRejectedValueOnce(error);

    await module.appScreenshotFS.initializeBeforeCapture();

    expect(captureException).toHaveBeenCalledWith(error);
    expect(files.has(CAPTURE_PATH)).toBe(false);
    expect(directories.has(SCREENSHOT_DIR)).toBe(true);
  });

  it('allows initialization to retry after creating the directory fails', async () => {
    const { module, mkdir, directories } = loadFsModule();
    const error = new Error('cannot create screenshot directory');
    mkdir.mockRejectedValueOnce(error);

    await expect(module.appScreenshotFS.initializeBeforeCapture()).rejects.toBe(
      error,
    );
    await module.appScreenshotFS.initializeBeforeCapture();

    expect(directories.has(SCREENSHOT_DIR)).toBe(true);
  });

  it('deletes native screenshot capture source files', async () => {
    const { module, files } = loadFsModule({
      existingFiles: { [CAPTURE_PATH]: 'capture' },
    });

    await module.AppScreenshotFS.cleanupNativeScreenshotCaptureSource(
      CAPTURE_PATH,
    );

    expect(files.has(CAPTURE_PATH)).toBe(false);
  });

  it.each([
    `${TMP}/.screenshots/screenshot-rabby-1.jpg`,
    `${TMP}/rabby-screen-capture/other-file.png`,
    'content://media/external/images/media/1',
    '',
  ])('skips cleanup for non native capture path %s', async input => {
    const { module, unlink } = loadFsModule();

    await module.AppScreenshotFS.cleanupNativeScreenshotCaptureSource(input);

    expect(unlink).not.toHaveBeenCalled();
  });
});
