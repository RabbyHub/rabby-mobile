import RNFS from 'react-native-fs';

import { APP_IDS } from '@/constant';
import { stringUtils } from '@rabby-wallet/base-utils';

const TMPDIR = RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath;

const DIRS = {
  SCREEN_SHOT_TMP: `${TMPDIR}/.screenshots`,
};

class AppScreenshotFS {
  #dir = DIRS['SCREEN_SHOT_TMP'];
  static getScreenshotDir() {
    return DIRS['SCREEN_SHOT_TMP'];
  }

  constructor() {
    this.#dir = DIRS['SCREEN_SHOT_TMP'];

    this._cleanDirectoryOnBootstrap();
    RNFS.mkdir(this.#dir, { NSURLIsExcludedFromBackupKey: false });
  }

  static #inst: AppScreenshotFS;
  static getInstance() {
    if (!AppScreenshotFS.#inst) {
      AppScreenshotFS.#inst = new AppScreenshotFS();
    }
    return AppScreenshotFS.#inst;
  }

  private async _cleanDirectoryOnBootstrap() {
    await RNFS.unlink(this.#dir);
  }

  async saveScreenshotFrom(
    input: string,
    options?: { fallbackAsBase64?: boolean },
  ) {
    const maybeTest = {
      path: input.startsWith('file://') || input.startsWith('/') ? input : '',
      base64: () =>
        input.startsWith('data:image/') && input.indexOf('base64,') > -1
          ? input.split(',')[1]
          : '',
    };

    let val = '';

    const targetPath = `${this.#dir}/screenshot-${
      APP_IDS.forScreenshot
    }-${Date.now()}.jpg`;

    if (maybeTest.path && (await RNFS.exists(maybeTest.path))) {
      await RNFS.copyFile(maybeTest.path, targetPath);
    } else if ((val = maybeTest.base64())) {
      // const imageType = input.split(';')[0].split('/')[1];
      await RNFS.writeFile(targetPath, val, 'base64');
    } else if (options?.fallbackAsBase64 && input.length < 10 * 1024 * 1024) {
      await RNFS.writeFile(targetPath, input, 'base64');
    }

    return stringUtils.ensurePrefix(targetPath, 'file://');
  }
}

export const appScreenshotFS: AppScreenshotFS = AppScreenshotFS.getInstance();
