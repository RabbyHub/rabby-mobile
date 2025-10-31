import RNFS from 'react-native-fs';
import * as Sentry from '@sentry/react-native';

import { APP_IDS, INITIAL_OPENAPI_URL } from '@/constant';
import { stringUtils } from '@rabby-wallet/base-utils';
import { IS_ANDROID, IS_IOS } from '../native/utils';

const TMPDIR = RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath;

const DIRS = {
  SCREEN_SHOT_TMP: `${stringUtils.unSuffix(TMPDIR)}/.screenshots`,
};

export class AppScreenshotFS {
  #dir = DIRS['SCREEN_SHOT_TMP'];
  static getScreenshotDir() {
    return DIRS['SCREEN_SHOT_TMP'];
  }

  constructor() {
    this.#dir = DIRS['SCREEN_SHOT_TMP'];

    this._cleanDirectoryOnBootstrap();
    RNFS.mkdir(this.#dir, { NSURLIsExcludedFromBackupKey: false }).catch(
      error => {
        Sentry.captureException(error);
      },
    );
  }

  static #inst: AppScreenshotFS;
  static getInstance() {
    if (!AppScreenshotFS.#inst) {
      AppScreenshotFS.#inst = new AppScreenshotFS();
    }
    return AppScreenshotFS.#inst;
  }

  private async _cleanDirectoryOnBootstrap() {
    if (!(await RNFS.exists(this.#dir))) return;

    await RNFS.unlink(this.#dir);
  }

  static normalizeFilePath(filePath: string) {
    if (IS_IOS && filePath.startsWith('file://')) {
      return stringUtils.unPrefix(filePath, 'file://');
    } else if (IS_ANDROID && !filePath.startsWith('file://')) {
      return stringUtils.ensurePrefix(filePath, 'file://');
    }

    return filePath;
  }

  static normalizeContentType(contentType: string) {
    switch (contentType?.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
      case 'image/jpeg':
        return { mime: 'image/jpeg', ext: 'jpg' };
      case 'png':
      case 'image/png':
        return { mime: 'image/png', ext: 'png' };
      case 'webp':
      case 'image/webp':
        return { mime: 'image/webp', ext: 'webp' };
      default:
        return { mime: contentType, ext: contentType.split('/').pop() };
    }
  }

  static normalizeBase64(input: string, contentType = 'image/jpeg') {
    if (input.startsWith('data:image/') && input.indexOf('base64,') > -1) {
      return input.split(',')[1];
    }

    return `data:${
      AppScreenshotFS.normalizeContentType(contentType).mime
    };base64,${input}`;
  }

  static async uriToPath(
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

    if (maybeTest.path && (await RNFS.exists(maybeTest.path))) {
      return { type: 'fs', data: maybeTest.path };
    } else if ((val = maybeTest.base64())) {
      return { type: 'base64', data: val };
    } else if (options?.fallbackAsBase64 && input.length < 10 * 1024 * 1024) {
      return { type: 'base64', data: input };
    }

    return null;
  }

  static async uriToBase64(input: string) {
    const pathInfo = await AppScreenshotFS.uriToPath(input);
    if (!pathInfo) return null;

    switch (pathInfo.type) {
      case 'fs':
        return RNFS.readFile(pathInfo.data, 'base64');
      case 'base64':
        return pathInfo.data;
      default:
        return null;
    }
  }

  static async uploadFile<T extends any>(
    input: string,
    url: string = `${INITIAL_OPENAPI_URL}/v1/feedback/app/upload`,
  ): Promise<T | null> {
    const base64 = await AppScreenshotFS.uriToBase64(input);
    if (!base64) return null;

    const formData = new FormData();
    formData.append('file', {
      uri: `data:image/jpeg;base64,${base64}`,
      type: 'image/jpeg',
      name: 'screenshot.jpg',
    });

    return fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
      .then(response => response.json())
      .catch(error => {
        console.error('Upload file error:', error);
        throw error;
      });
  }

  async saveScreenshotFrom(
    input: string,
    options?: { fallbackAsBase64?: boolean; imageType?: string },
  ) {
    const pathInfo = await AppScreenshotFS.uriToPath(input);
    if (!pathInfo) return null;

    const targetPath = `${this.#dir}/screenshot-${
      APP_IDS.forScreenshot
    }-${Date.now()}.${
      AppScreenshotFS.normalizeContentType(options?.imageType || 'jpeg').ext
    }`;

    if (pathInfo.type === 'fs' && (await RNFS.exists(pathInfo.data))) {
      await RNFS.copyFile(pathInfo.data, targetPath);
    } else if (pathInfo.type === 'base64') {
      await RNFS.writeFile(targetPath, pathInfo.data, 'base64');
    } else if (options?.fallbackAsBase64 && input.length < 10 * 1024 * 1024) {
      await RNFS.writeFile(targetPath, input, 'base64');
    }

    return AppScreenshotFS.normalizeFilePath(targetPath);
  }
}

export const appScreenshotFS: AppScreenshotFS = AppScreenshotFS.getInstance();
