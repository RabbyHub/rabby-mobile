import { Platform, Share } from 'react-native';
import RNFS from 'react-native-fs';

import RNHelpers from '@/core/native/RNHelpers';

export type ShareLocalFileOptions = {
  path: string;
  name?: string;
  mimeType: string;
  title?: string;
  subject?: string;
  message?: string;
  cleanupPaths?: string[];
};

export type ShareLocalFileResult = {
  dismissed: boolean;
};

function getFileBaseName(filePath: string) {
  return filePath.split('/').pop() || filePath;
}

export async function shareLocalFile({
  path,
  name,
  mimeType,
  title,
  subject,
  message,
  cleanupPaths,
}: ShareLocalFileOptions): Promise<ShareLocalFileResult> {
  try {
    if (!(await RNFS.exists(path))) {
      throw new Error(`Share source file missing: ${path}`);
    }

    const fileName = name || getFileBaseName(path);

    if (Platform.OS === 'ios') {
      const result = await Share.share(
        {
          title: title || fileName,
          url: `file://${path}`,
          message,
        },
        {
          subject: subject || fileName,
        },
      );

      return {
        dismissed: result.action === Share.dismissedAction,
      };
    }

    await RNHelpers.shareFile({
      filePath: path,
      mimeType,
      title: title || fileName,
      subject: subject || fileName,
    });

    return {
      dismissed: false,
    };
  } finally {
    if (cleanupPaths?.length) {
      await Promise.allSettled(
        cleanupPaths.map(async cleanupPath => {
          if (await RNFS.exists(cleanupPath)) {
            await RNFS.unlink(cleanupPath);
          }
        }),
      );
    }
  }
}
