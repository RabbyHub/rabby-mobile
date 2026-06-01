const mockShare = jest.fn();
const mockExists = jest.fn();
const mockUnlink = jest.fn();
const mockShareFile = jest.fn();

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  Share: {
    dismissedAction: 'dismissedAction',
    share: (...args: unknown[]) => mockShare(...args),
  },
}));

jest.mock('react-native-fs', () => ({
  exists: (...args: unknown[]) => mockExists(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
}));

jest.mock('@/core/native/RNHelpers', () => ({
  shareFile: (...args: unknown[]) => mockShareFile(...args),
}));

import { Platform, Share } from 'react-native';
import { shareLocalFile } from './shareLocalFile';

describe('shareLocalFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
    mockExists.mockResolvedValue(true);
    mockShare.mockResolvedValue({ action: 'sharedAction' });
    mockShareFile.mockResolvedValue(undefined);
  });

  it('shares existing files through iOS Share with file URLs and fallback names', async () => {
    mockShare.mockResolvedValue({ action: Share.dismissedAction });

    await expect(
      shareLocalFile({
        path: '/tmp/export/report.csv',
        mimeType: 'text/csv',
        message: 'exported',
      }),
    ).resolves.toEqual({ dismissed: true });

    expect(mockShare).toHaveBeenCalledWith(
      {
        title: 'report.csv',
        url: 'file:///tmp/export/report.csv',
        message: 'exported',
      },
      {
        subject: 'report.csv',
      },
    );
    expect(mockShareFile).not.toHaveBeenCalled();
  });

  it('shares existing files through the Android native helper', async () => {
    (Platform as any).OS = 'android';

    await expect(
      shareLocalFile({
        path: '/tmp/export/wallet.json',
        name: 'backup.json',
        mimeType: 'application/json',
        title: 'Wallet backup',
        subject: 'Backup subject',
      }),
    ).resolves.toEqual({ dismissed: false });

    expect(mockShareFile).toHaveBeenCalledWith({
      filePath: '/tmp/export/wallet.json',
      mimeType: 'application/json',
      title: 'Wallet backup',
      subject: 'Backup subject',
    });
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('throws when the source file is missing and still cleans existing cleanup paths', async () => {
    mockExists.mockImplementation(async (path: string) => {
      return path === '/tmp/export/cleanup.tmp';
    });

    await expect(
      shareLocalFile({
        path: '/tmp/export/missing.csv',
        mimeType: 'text/csv',
        cleanupPaths: [
          '/tmp/export/cleanup.tmp',
          '/tmp/export/already-gone.tmp',
        ],
      }),
    ).rejects.toThrow('Share source file missing: /tmp/export/missing.csv');

    expect(mockUnlink).toHaveBeenCalledWith('/tmp/export/cleanup.tmp');
    expect(mockUnlink).not.toHaveBeenCalledWith('/tmp/export/already-gone.tmp');
  });

  it('cleans temporary files after successful sharing', async () => {
    const existingPaths = new Set([
      '/tmp/export/report.csv',
      '/tmp/a',
      '/tmp/b',
    ]);
    mockExists.mockImplementation(async (path: string) =>
      existingPaths.has(path),
    );

    await shareLocalFile({
      path: '/tmp/export/report.csv',
      mimeType: 'text/csv',
      cleanupPaths: ['/tmp/a', '/tmp/b'],
    });

    expect(mockUnlink).toHaveBeenCalledWith('/tmp/a');
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/b');
  });
});
