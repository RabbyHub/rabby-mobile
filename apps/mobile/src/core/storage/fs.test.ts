type AppScreenshotFSModule = typeof import('./fs');

const TMP = '/mock/tmp';

function loadFsModule({ existingDirs = [] as string[] } = {}) {
  jest.resetModules();

  const exists = jest.fn(async (path: string) => existingDirs.includes(path));
  const unlink = jest.fn(async (_path: string) => undefined);

  jest.doMock('@rabby-wallet/react-native-fs', () => ({
    TemporaryDirectoryPath: TMP,
    CachesDirectoryPath: '/mock/caches',
    exists,
    unlink,
    mkdir: jest.fn(async () => undefined),
    writeFile: jest.fn(async () => undefined),
    readFile: jest.fn(async () => ''),
  }));
  jest.doMock('@/constant', () => ({
    APP_IDS: { forScreenshot: 'rabby' },
    INITIAL_OPENAPI_URL: 'https://openapi.test',
  }));

  let module: AppScreenshotFSModule | undefined;
  jest.isolateModules(() => {
    module = require('./fs');
  });

  return { module: module!, exists, unlink };
}

async function flushEffects(rounds = 5) {
  for (let index = 0; index < rounds; index++) {
    await new Promise(resolve => setImmediate(resolve));
  }
}

describe('AppScreenshotFS', () => {
  it('removes leftover screenshot and native capture directories on bootstrap', async () => {
    const { unlink } = loadFsModule({
      existingDirs: [`${TMP}/.screenshots`, `${TMP}/rabby-screen-capture`],
    });

    await flushEffects();

    expect(unlink).toHaveBeenCalledWith(`${TMP}/.screenshots`);
    expect(unlink).toHaveBeenCalledWith(`${TMP}/rabby-screen-capture`);
  });

  it('deletes native screenshot capture source files', async () => {
    const { module, unlink } = loadFsModule();
    const capturePath = `${TMP}/rabby-screen-capture/rabby-screen-capture-1.png`;

    await module.AppScreenshotFS.cleanupNativeScreenshotCaptureSource(
      capturePath,
    );

    expect(unlink).toHaveBeenCalledWith(capturePath);
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
