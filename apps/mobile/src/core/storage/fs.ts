import RNFS from '@rabby-wallet/react-native-fs';
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

  static async ensureScreenshotDir() {
    await RNFS.mkdir(DIRS['SCREEN_SHOT_TMP'], {
      NSURLIsExcludedFromBackupKey: false,
    });
  }

  static makeScreenshotFilePath(imageType = 'jpeg') {
    return `${DIRS['SCREEN_SHOT_TMP']}/screenshot-${
      APP_IDS.forScreenshot
    }-${Date.now()}.${AppScreenshotFS.normalizeContentType(imageType).ext}`;
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
    if (filePath.startsWith('content://')) {
      return filePath;
    }

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

  static resolveImageContentType(input: string, fallback = 'image/jpeg') {
    const dataUrlMatch = input.match(/^data:(image\/[^;]+);base64,/i);
    if (dataUrlMatch?.[1]) {
      return AppScreenshotFS.normalizeContentType(dataUrlMatch[1]);
    }

    const pathPart = input.split('?')[0] || '';
    const extMatch = pathPart.match(/\.([a-z0-9]+)$/i);
    return AppScreenshotFS.normalizeContentType(extMatch?.[1] || fallback);
  }

  static normalizeBase64(input: string, contentType = 'image/jpeg') {
    if (input.startsWith('data:image/') && input.indexOf('base64,') > -1) {
      return input.split(',')[1];
    }

    return `data:${
      AppScreenshotFS.normalizeContentType(contentType).mime
    };base64,${input}`;
  }

  static normalizeImageUri(input: string, contentType = 'image/jpeg') {
    if (
      input.startsWith('data:image/') ||
      input.startsWith('file://') ||
      input.startsWith('content://')
    ) {
      return input;
    }

    if (input.startsWith('/')) {
      return `file://${input}`;
    }

    return AppScreenshotFS.normalizeBase64(input, contentType);
  }

  static normalizeUploadFileUri(input: string) {
    if (
      input.startsWith('file://') ||
      input.startsWith('content://') ||
      input.startsWith('data:')
    ) {
      return input;
    }

    if (input.startsWith('/')) {
      return `file://${input}`;
    }

    return input;
  }

  static async uriToPath(
    input: string,
    options?: { fallbackAsBase64?: boolean },
  ) {
    const maybeTest = {
      path:
        input.startsWith('file://') ||
        input.startsWith('content://') ||
        input.startsWith('/')
          ? input
          : '',
      base64: () =>
        input.startsWith('data:image/') && input.indexOf('base64,') > -1
          ? input.split(',')[1] ?? ''
          : '',
    };

    let val = '';

    if (maybeTest.path.startsWith('content://')) {
      return { type: 'fs', data: maybeTest.path };
    } else if (maybeTest.path && (await RNFS.exists(maybeTest.path))) {
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
    const pathInfo = await AppScreenshotFS.uriToPath(input, {
      fallbackAsBase64: true,
    });
    if (!pathInfo) return null;

    const fileType = AppScreenshotFS.resolveImageContentType(input);
    let cleanupPath = '';
    let uploadUri =
      pathInfo.type === 'fs'
        ? AppScreenshotFS.normalizeUploadFileUri(pathInfo.data)
        : `data:${fileType.mime};base64,${pathInfo.data}`;
    if (pathInfo.type === 'base64') {
      const targetPath = AppScreenshotFS.makeScreenshotFilePath(fileType.mime);
      await AppScreenshotFS.ensureScreenshotDir();
      await RNFS.writeFile(targetPath, pathInfo.data, 'base64');
      cleanupPath = targetPath;
      uploadUri = AppScreenshotFS.normalizeUploadFileUri(targetPath);
    }

    const formData = new FormData();
    formData.append('file', {
      uri: uploadUri,
      type: fileType.mime,
      name: `screenshot.${fileType.ext}`,
    } as unknown as Blob);

    return fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
      .then(response => response.json())
      .finally(() => {
        if (cleanupPath) {
          RNFS.unlink(cleanupPath).catch(() => undefined);
        }
      })
      .catch(error => {
        console.error('Upload file error:', error);
        throw error;
      });
  }

  async saveScreenshotFrom(
    input: string,
    options?: { fallbackAsBase64?: boolean; imageType?: string },
  ) {
    const pathInfo = await AppScreenshotFS.uriToPath(input, {
      fallbackAsBase64: options?.fallbackAsBase64,
    });
    if (!pathInfo) return null;

    const targetPath = AppScreenshotFS.makeScreenshotFilePath(
      options?.imageType || 'jpeg',
    );

    if (pathInfo.type === 'fs') {
      await RNFS.persistFile(pathInfo.data, targetPath, {
        mode: 'copy',
        overwrite: true,
        ensureParent: true,
        NSURLIsExcludedFromBackupKey: false,
      });
    } else if (pathInfo.type === 'base64') {
      await RNFS.writeFile(targetPath, pathInfo.data, 'base64');
    }

    return AppScreenshotFS.normalizeFilePath(targetPath);
  }
}

export const appScreenshotFS: AppScreenshotFS = AppScreenshotFS.getInstance();
