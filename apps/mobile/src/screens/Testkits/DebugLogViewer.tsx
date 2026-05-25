import { Buffer } from '@craftzdog/react-native-buffer';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import RNFS from 'react-native-fs';
import dayjs from 'dayjs';
import { strFromU8, Unzip, UnzipInflate, unzipSync, zipSync } from 'fflate';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
} from '@/components/customized/BottomSheet';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import { Text } from '@/components/Typography';
import { useNavigation } from '@react-navigation/native';
import { StackActions } from '@react-navigation/native';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { toast } from '@/components2024/Toast';
import { APP_RUNTIME_ENV } from '@/constant/env';
import { RootNames } from '@/constant/layout';
import { getOnlineConfig, subscribeOnlineConfig } from '@/core/config/online';
import { useTheme2024 } from '@/hooks/theme';
import { APP_FILE_LOGGING_ONLINE_SWITCH } from '@/utils/logging/policy';
import { shareLocalFile } from '@/utils/shareLocalFile';
import {
  subscribeAppLogFileSettings,
  useAppLogFileSwitch,
} from '@/utils/logging/settings';
import { APP_LOG_ROOT_PATH, logger } from '@/utils/logger';
import { createGetStyles2024 } from '@/utils/styles';

type LoggerSnapshot = ReturnType<typeof logger.getState>;

type ArchiveFileItem = {
  name: string;
  path: string;
  size: number;
  kind: 'zip' | 'partial' | 'other';
  createdAt: string | null;
  modifiedAt: string | null;
};

type ArchiveKindDisplay = {
  label: string;
  description: string;
};

type ShareableFileTarget = {
  path: string;
  name: string;
  mimeType: string;
  title: string;
  subject: string;
  message: string;
  successMessage: string;
  cleanupPaths?: string[];
};

type ArchiveEntriesMap = Record<string, Uint8Array>;

type PreparedArchiveShare = {
  archive: ArchiveFileItem;
  extractedEntries?: ArchiveEntriesMap;
  cleanupPaths: string[];
  preferredLatestLogEntryPath?: string | null;
};

type ZipValidationResult = {
  archiveName: string;
  archivePath: string;
  checkedAt: string;
  entryCount: number;
  totalBytes: number;
  entryNames: string[];
  firstEntryPath: string | null;
  firstLinePreview: string | null;
};

type PageSnapshot = {
  loggerState: LoggerSnapshot;
  rootExists: boolean;
  files: ArchiveFileItem[];
  prodOnlineEnabled: boolean;
  refreshedAt: string;
};

const BURST_LINE_COUNT = 10;
const BURST_LINE_SIZE = 120 * 1024;

function noop() {}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getFileBaseName(filePath: string) {
  return filePath.split('/').pop() || filePath;
}

function formatBytes(bytes: number) {
  if (!bytes) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${
    value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)
  } ${units[unitIndex]}`;
}

function formatDateTime(value?: string | number | Date | null) {
  if (!value) {
    return 'n/a';
  }

  const nextValue = dayjs(value);
  return nextValue.isValid() ? nextValue.format('YYYY-MM-DD HH:mm:ss') : 'n/a';
}

function formatArchiveTimeRange(
  file: Pick<ArchiveFileItem, 'createdAt' | 'modifiedAt'>,
) {
  const startAt = file.createdAt || file.modifiedAt;
  const endAt = file.modifiedAt || file.createdAt;

  if (!startAt && !endAt) {
    return 'n/a';
  }

  return `${formatDateTime(startAt)} -> ${formatDateTime(endAt)}`;
}

function getFileKind(name: string): ArchiveFileItem['kind'] {
  if (name.endsWith('.zip.partial')) {
    return 'partial';
  }

  if (name.endsWith('.zip')) {
    return 'zip';
  }

  return 'other';
}

function makeArchiveFileRef(
  filePath: string,
  kind: ArchiveFileItem['kind'] = 'zip',
): ArchiveFileItem {
  return {
    name: getFileBaseName(filePath),
    path: filePath,
    size: 0,
    kind,
    createdAt: null,
    modifiedAt: null,
  };
}

function isSamePath(left?: string | null, right?: string | null) {
  return !!left && !!right && left === right;
}

function getArchiveKindDisplay(
  kind: ArchiveFileItem['kind'],
): ArchiveKindDisplay {
  if (kind === 'zip') {
    return {
      label: 'ZIP',
      description: 'Finalized archive ready for validation or sharing.',
    };
  }

  if (kind === 'partial') {
    return {
      label: 'ZIP PARTIAL',
      description:
        'Live archive still being written. Share flow exports it first.',
    };
  }

  return {
    label: 'OTHER',
    description: 'Non-archive file under applogs.',
  };
}

function getShareTempDir() {
  return `${
    RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath || APP_LOG_ROOT_PATH
  }/rabby-log-share`;
}

async function ensureShareTempDir() {
  const shareTempDir = getShareTempDir();

  await RNFS.mkdir(shareTempDir, {
    NSURLIsExcludedFromBackupKey: true,
  });

  return shareTempDir;
}

function joinUint8Chunks(chunks: Uint8Array[], totalBytes: number) {
  const merged = new Uint8Array(totalBytes);
  let offset = 0;

  chunks.forEach(chunk => {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  });

  return merged;
}

async function listArchiveFiles() {
  const exists = await RNFS.exists(APP_LOG_ROOT_PATH);
  if (!exists) {
    return {
      exists,
      files: [] as ArchiveFileItem[],
    };
  }

  const entries = await RNFS.readDir(APP_LOG_ROOT_PATH);
  const files = entries
    .filter(item => item.isFile())
    .map(item => ({
      name: item.name,
      path: item.path,
      size: item.size,
      kind: getFileKind(item.name),
      createdAt: item.ctime ? item.ctime.toISOString() : null,
      modifiedAt: item.mtime ? item.mtime.toISOString() : null,
    }))
    .sort((left, right) => {
      const rightTs = right.modifiedAt ? dayjs(right.modifiedAt).valueOf() : 0;
      const leftTs = left.modifiedAt ? dayjs(left.modifiedAt).valueOf() : 0;

      if (rightTs !== leftTs) {
        return rightTs - leftTs;
      }

      return right.name.localeCompare(left.name);
    });

  return {
    exists,
    files,
  };
}

async function validateArchiveFile(file: ArchiveFileItem) {
  const base64 = await RNFS.readFile(file.path, 'base64');
  const archive = unzipSync(Uint8Array.from(Buffer.from(base64, 'base64')));
  const entryNames = Object.keys(archive).sort((left, right) =>
    left.localeCompare(right),
  );
  const firstEntryPath = entryNames[0] || null;
  const firstLinePreview = firstEntryPath
    ? strFromU8(archive[firstEntryPath] || new Uint8Array())
        .split('\n')[0]
        ?.slice(0, 180) || null
    : null;
  const totalBytes = Object.values(archive).reduce(
    (sum, chunk) => sum + chunk.byteLength,
    0,
  );

  return {
    archiveName: file.name,
    archivePath: file.path,
    checkedAt: new Date().toISOString(),
    entryCount: entryNames.length,
    totalBytes,
    entryNames,
    firstEntryPath,
    firstLinePreview,
  } satisfies ZipValidationResult;
}

async function waitForFileReady(filePath: string, timeoutMs = 3000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await RNFS.exists(filePath)) {
      return true;
    }

    await sleep(80);
  }

  return RNFS.exists(filePath);
}

async function extractCompleteEntriesFromPartialArchive(
  archive: Pick<ArchiveFileItem, 'name' | 'path'>,
) {
  const partialBase64 = await RNFS.readFile(archive.path, 'base64');
  const partialBytes = Uint8Array.from(Buffer.from(partialBase64, 'base64'));
  const extractedEntries: ArchiveEntriesMap = {};
  const extractionTasks: Promise<void>[] = [];
  const unzipper = new Unzip(file => {
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    const extractionTask = new Promise<void>((resolve, reject) => {
      file.ondata = (error, data, final) => {
        if (error) {
          reject(error);
          return;
        }

        if (data?.length) {
          chunks.push(new Uint8Array(data));
          totalBytes += data.byteLength;
        }

        if (final) {
          extractedEntries[file.name] = joinUint8Chunks(chunks, totalBytes);
          resolve();
        }
      };
    });

    extractionTasks.push(extractionTask);
    file.start();
  });
  unzipper.register(UnzipInflate);

  let unzipError: unknown = null;

  try {
    unzipper.push(partialBytes, true);
  } catch (error) {
    unzipError = error;
  }

  const extractionResults = await Promise.allSettled(extractionTasks);
  const firstExtractionFailure = extractionResults.find(
    item => item.status === 'rejected',
  );

  if (!Object.keys(extractedEntries).length) {
    if (firstExtractionFailure?.status === 'rejected') {
      throw firstExtractionFailure.reason;
    }

    if (unzipError) {
      throw unzipError;
    }

    throw new Error(
      `No complete entries could be recovered from ${archive.name}`,
    );
  }

  return extractedEntries;
}

async function exportPartialArchiveForSharing(
  archive: ArchiveFileItem,
): Promise<PreparedArchiveShare> {
  const shareTempDir = await ensureShareTempDir();
  const exportedArchiveName = `${archive.name.replace(
    /\.zip\.partial$/,
    '',
  )}-share-${Date.now()}.zip`;
  const exportedArchivePath = `${shareTempDir}/${exportedArchiveName}`;
  const activePartialPath = logger.getState().activeArchiveTempPath;

  if (activePartialPath && activePartialPath === archive.path) {
    await logger.flush();

    const snapshotPath = await logger.exportArchiveSnapshot(
      exportedArchivePath,
    );

    if (!snapshotPath) {
      throw new Error(
        `Active partial archive could not be exported from ${archive.name}`,
      );
    }

    await waitForFileReady(snapshotPath);

    return {
      archive: {
        name: getFileBaseName(snapshotPath),
        path: snapshotPath,
        size: 0,
        kind: 'zip',
        createdAt: null,
        modifiedAt: null,
      } satisfies ArchiveFileItem,
      cleanupPaths: [snapshotPath],
      preferredLatestLogEntryPath: logger.getState().activeEntryPath,
    } satisfies PreparedArchiveShare;
  }

  const extractedEntries = await extractCompleteEntriesFromPartialArchive(
    archive,
  );
  const exportedArchiveBytes = zipSync(extractedEntries, {
    level: 6,
  });

  await RNFS.writeFile(
    exportedArchivePath,
    Buffer.from(exportedArchiveBytes).toString('base64'),
    'base64',
  );

  return {
    archive: {
      name: exportedArchiveName,
      path: exportedArchivePath,
      size: exportedArchiveBytes.byteLength,
      kind: 'zip',
      createdAt: null,
      modifiedAt: null,
    } satisfies ArchiveFileItem,
    extractedEntries,
    cleanupPaths: [exportedArchivePath],
  } satisfies PreparedArchiveShare;
}

async function finalizeActiveArchiveForSharing(
  activePartialPath: string,
): Promise<PreparedArchiveShare | null> {
  const loggerState = logger.getState();

  if (!isSamePath(loggerState.activeArchiveTempPath, activePartialPath)) {
    return null;
  }

  await logger.flush();
  const finalizedArchivePath = await logger.finalizeArchive();

  if (!finalizedArchivePath) {
    return null;
  }

  await waitForFileReady(finalizedArchivePath);

  return {
    archive: makeArchiveFileRef(finalizedArchivePath, 'zip'),
    cleanupPaths: [],
    preferredLatestLogEntryPath: loggerState.activeEntryPath,
  } satisfies PreparedArchiveShare;
}

function getLatestLogEntryPath(
  entries: ArchiveEntriesMap,
  preferredEntryPath?: string | null,
) {
  if (preferredEntryPath && entries[preferredEntryPath]) {
    return preferredEntryPath;
  }

  return (
    Object.keys(entries)
      .filter(entryName => entryName.endsWith('.log'))
      .sort((left, right) => right.localeCompare(left))[0] || null
  );
}

async function extractLatestLogFileFromEntries(
  entries: ArchiveEntriesMap,
  archiveName: string,
  extraCleanupPaths: string[] = [],
  preferredEntryPath?: string | null,
) {
  const latestLogEntryPath = getLatestLogEntryPath(entries, preferredEntryPath);

  if (!latestLogEntryPath) {
    throw new Error(`No .log entry found in ${archiveName}`);
  }

  const shareTempDir = await ensureShareTempDir();
  const extractedLogName = getFileBaseName(latestLogEntryPath);
  const extractedLogPath = `${shareTempDir}/${extractedLogName}`;

  if (await RNFS.exists(extractedLogPath)) {
    await RNFS.unlink(extractedLogPath);
  }

  await RNFS.writeFile(
    extractedLogPath,
    strFromU8(entries[latestLogEntryPath] || new Uint8Array()),
    'utf8',
  );

  return {
    entryPath: latestLogEntryPath,
    shareTarget: {
      path: extractedLogPath,
      name: extractedLogName,
      mimeType: 'text/plain',
      title: 'Share latest app log file',
      subject: extractedLogName,
      message: `Rabby app latest log file: ${latestLogEntryPath}`,
      successMessage: `Opened share sheet: ${extractedLogName}`,
      cleanupPaths: [...extraCleanupPaths, extractedLogPath],
    } satisfies ShareableFileTarget,
  };
}

async function extractLatestLogFileFromArchive(
  archive: Pick<ArchiveFileItem, 'name' | 'path'>,
  extraCleanupPaths: string[] = [],
  preferredEntryPath?: string | null,
) {
  const archiveBase64 = await RNFS.readFile(archive.path, 'base64');
  const archiveEntries = unzipSync(
    Uint8Array.from(Buffer.from(archiveBase64, 'base64')),
  );

  return extractLatestLogFileFromEntries(
    archiveEntries,
    archive.name,
    extraCleanupPaths,
    preferredEntryPath,
  );
}

async function writeSampleLogs() {
  const requestId = `verify-${Date.now()}`;
  const timerLabel = `app-log-verification:${requestId}`;

  console.log('[app-log-verification] console log sample', {
    requestId,
    accessToken: logger.mask('sample-access-token'),
    nested: {
      privateKey: logger.mask('sample-private-key'),
    },
  });
  console.warn('[app-log-verification] console warn sample', {
    requestId,
    subsystem: 'zip-writer',
  });
  logger.info('[app-log-verification] logger info sample', {
    requestId,
    endpoint: '/api/log-test',
    responseCode: 200,
  });
  logger.error('[app-log-verification] logger error sample', {
    requestId,
    retryable: false,
  });
  console.time(timerLabel);
  await sleep(32);
  console.timeLog(timerLabel, 'sample midpoint');
  await sleep(16);
  console.timeEnd(timerLabel);

  await logger.flush();
}

async function writeRotationBurst() {
  logger.info('[app-log-verification] rotation burst start', {
    lines: BURST_LINE_COUNT,
    approxBytes: BURST_LINE_COUNT * BURST_LINE_SIZE,
  });

  for (let index = 0; index < BURST_LINE_COUNT; index += 1) {
    const filler = `burst-${index}`.padEnd(BURST_LINE_SIZE, String(index % 10));

    logger.info('[app-log-verification] rotation burst line', {
      index,
      filler,
    });

    if (index > 0 && index % 3 === 0) {
      await sleep(0);
    }
  }

  logger.info('[app-log-verification] rotation burst end');
  await logger.flush();
}

function Section({
  title,
  description,
  children,
}: React.PropsWithChildren<{
  title: string;
  description?: string;
}>) {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? (
        <Text style={styles.sectionDescription}>{description}</Text>
      ) : null}
      {children}
    </View>
  );
}

function MetaRow({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const valueColor =
    tone === 'success'
      ? colors2024['green-default']
      : tone === 'warning'
      ? colors2024['orange-default']
      : colors2024['neutral-title-1'];

  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text
        style={[styles.metaValue, { color: valueColor }]}
        selectable
        numberOfLines={2}
        ellipsizeMode="middle">
        {value}
      </Text>
    </View>
  );
}

export default function DebugLogViewerScreen(): JSX.Element {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const {
    canToggle,
    consoleCaptureEnabled,
    effectiveEnabled,
    isOnlineControlled,
    localDefaultEnabled,
    localFileLoggingEnabled,
    onToggle,
  } = useAppLogFileSwitch();
  const navigation = useNavigation();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isArchiveSharePickerVisible, setIsArchiveSharePickerVisible] =
    useState(false);
  const [lastAction, setLastAction] = useState('Idle');
  const [validationResult, setValidationResult] =
    useState<ZipValidationResult | null>(null);
  const archiveSharePickerRef = useRef<AppBottomSheetModal>(null);
  const canShareArchive = APP_RUNTIME_ENV !== 'production';
  const [snapshot, setSnapshot] = useState<PageSnapshot>(() => ({
    loggerState: logger.getState(),
    rootExists: false,
    files: [],
    prodOnlineEnabled:
      !!getOnlineConfig()?.switches?.[APP_FILE_LOGGING_ONLINE_SWITCH],
    refreshedAt: new Date().toISOString(),
  }));

  const latestFinalizedArchive = useMemo(
    () => snapshot.files.find(item => item.kind === 'zip') || null,
    [snapshot.files],
  );
  const shareableArchives = useMemo(
    () =>
      snapshot.files.filter(
        item => item.kind === 'zip' || item.kind === 'partial',
      ),
    [snapshot.files],
  );
  const archiveSharePickerSnapPoints = useMemo(() => [460], []);

  const refreshSnapshot = useCallback(async () => {
    const fileState = await listArchiveFiles();
    const nextSnapshot = {
      loggerState: logger.getState(),
      rootExists: fileState.exists,
      files: fileState.files,
      prodOnlineEnabled:
        !!getOnlineConfig()?.switches?.[APP_FILE_LOGGING_ONLINE_SWITCH],
      refreshedAt: new Date().toISOString(),
    };

    setSnapshot(nextSnapshot);
    return nextSnapshot;
  }, []);

  useEffect(() => {
    refreshSnapshot().catch(noop);

    const unsubscribeSettings = subscribeAppLogFileSettings(() => {
      refreshSnapshot().catch(noop);
    });
    const unsubscribeOnline = subscribeOnlineConfig(() => {
      refreshSnapshot().catch(noop);
    });

    return () => {
      unsubscribeSettings();
      unsubscribeOnline();
    };
  }, [refreshSnapshot]);

  useEffect(() => {
    if (isArchiveSharePickerVisible) {
      archiveSharePickerRef.current?.present();
    } else {
      archiveSharePickerRef.current?.dismiss();
    }
  }, [isArchiveSharePickerVisible]);

  const markSuccess = useCallback((message: string) => {
    setLastAction(`${dayjs().format('HH:mm:ss')} ${message}`);
    toast.success(message);
  }, []);

  const markInfo = useCallback((message: string) => {
    setLastAction(`${dayjs().format('HH:mm:ss')} ${message}`);
    toast.info(message);
  }, []);

  const markError = useCallback((label: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    setLastAction(`${dayjs().format('HH:mm:ss')} ${label} failed: ${message}`);
    toast.error(message);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (busyKey) {
      return;
    }

    setBusyKey('refresh');
    try {
      await refreshSnapshot();
      markSuccess('App log directory refreshed');
    } catch (error) {
      markError('Refresh', error);
    } finally {
      setBusyKey(null);
    }
  }, [busyKey, markError, markSuccess, refreshSnapshot]);

  const handleWriteSampleLogs = useCallback(async () => {
    if (busyKey) {
      return;
    }

    setBusyKey('sample');
    try {
      await writeSampleLogs();
      await refreshSnapshot();
      markSuccess('Sample logs written and flushed');
    } catch (error) {
      markError('Write sample logs', error);
    } finally {
      setBusyKey(null);
    }
  }, [busyKey, markError, markSuccess, refreshSnapshot]);

  const handleWriteRotationBurst = useCallback(async () => {
    if (busyKey) {
      return;
    }

    setBusyKey('burst');
    try {
      await writeRotationBurst();
      await refreshSnapshot();
      markSuccess('Rotation burst written and flushed');
    } catch (error) {
      markError('Write rotation burst', error);
    } finally {
      setBusyKey(null);
    }
  }, [busyKey, markError, markSuccess, refreshSnapshot]);

  const handleFlush = useCallback(async () => {
    if (busyKey) {
      return;
    }

    setBusyKey('flush');
    try {
      await logger.flush();
      await refreshSnapshot();
      markSuccess('Logger queue flushed');
    } catch (error) {
      markError('Flush queue', error);
    } finally {
      setBusyKey(null);
    }
  }, [busyKey, markError, markSuccess, refreshSnapshot]);

  const handleFinalize = useCallback(async () => {
    if (busyKey) {
      return;
    }

    setBusyKey('finalize');
    try {
      await logger.flush();
      const finalPath = await logger.finalizeArchive();

      if (finalPath) {
        await waitForFileReady(finalPath);
      }

      let nextSnapshot = await refreshSnapshot();

      if (
        finalPath &&
        !nextSnapshot.files.some(
          item => item.kind === 'zip' && item.path === finalPath,
        )
      ) {
        await sleep(120);
        nextSnapshot = await refreshSnapshot();
      }

      if (finalPath) {
        markSuccess(`Log zip ready: ${finalPath.split('/').pop()}`);
      } else {
        markInfo('No active archive to finalize');
      }
    } catch (error) {
      markError('Finalize archive', error);
    } finally {
      setBusyKey(null);
    }
  }, [busyKey, markError, markInfo, markSuccess, refreshSnapshot]);

  const handleValidateLatestZip = useCallback(async () => {
    if (busyKey) {
      return;
    }

    setBusyKey('validate');
    try {
      const nextSnapshot = await refreshSnapshot();
      const latestArchive =
        nextSnapshot.files.find(item => item.kind === 'zip') || null;

      if (!latestArchive) {
        setValidationResult(null);
        markInfo('No finalized zip found under applogs');
        return;
      }

      const result = await validateArchiveFile(latestArchive);
      setValidationResult(result);
      await refreshSnapshot();
      markSuccess(
        `Zip validated: ${result.entryCount} entries / ${formatBytes(
          result.totalBytes,
        )}`,
      );
    } catch (error) {
      markError('Validate latest zip', error);
    } finally {
      setBusyKey(null);
    }
  }, [busyKey, markError, markInfo, markSuccess, refreshSnapshot]);

  const shareLocalFileTarget = useCallback(
    async (file: ShareableFileTarget) => {
      if (!canShareArchive) {
        markInfo('Archive sharing is disabled in production builds');
        return;
      }

      const result = await shareLocalFile({
        path: file.path,
        name: file.name,
        mimeType: file.mimeType,
        title: file.title,
        subject: file.subject,
        message: file.message,
        cleanupPaths: file.cleanupPaths,
      });

      if (result.dismissed) {
        markInfo('Share dismissed');
        return;
      }

      markSuccess(file.successMessage);
    },
    [canShareArchive, markInfo, markSuccess],
  );

  const prepareArchiveForSharing = useCallback(
    async (archive: ArchiveFileItem): Promise<PreparedArchiveShare> => {
      if (archive.kind === 'partial') {
        const finalizedActiveArchive = await finalizeActiveArchiveForSharing(
          archive.path,
        );

        if (finalizedActiveArchive) {
          return finalizedActiveArchive;
        }

        return exportPartialArchiveForSharing(archive);
      }

      return {
        archive,
        cleanupPaths: [],
      } satisfies PreparedArchiveShare;
    },
    [],
  );

  const shareArchiveFile = useCallback(
    async (archive: ArchiveFileItem) => {
      const preparedArchive = await prepareArchiveForSharing(archive);

      await shareLocalFileTarget({
        path: preparedArchive.archive.path,
        name: preparedArchive.archive.name,
        mimeType: 'application/zip',
        title: 'Share app log archive',
        subject: preparedArchive.archive.name,
        message: `Rabby app log archive: ${preparedArchive.archive.name}`,
        successMessage: `Opened share sheet: ${preparedArchive.archive.name}`,
        cleanupPaths: preparedArchive.cleanupPaths,
      });
    },
    [prepareArchiveForSharing, shareLocalFileTarget],
  );

  const resolveLatestArchiveForSharing =
    useCallback(async (): Promise<PreparedArchiveShare | null> => {
      const activePartialPath = logger.getState().activeArchiveTempPath;

      if (activePartialPath) {
        return prepareArchiveForSharing(
          makeArchiveFileRef(activePartialPath, 'partial'),
        );
      }

      const nextSnapshot = await refreshSnapshot();
      const latestArchive =
        nextSnapshot.files.find(item => item.kind === 'zip') || null;

      if (!latestArchive) {
        return null;
      }

      return {
        archive: latestArchive,
        cleanupPaths: [],
      } satisfies PreparedArchiveShare;
    }, [prepareArchiveForSharing, refreshSnapshot]);

  const handleShareLatestZip = useCallback(async () => {
    if (busyKey) {
      return;
    }

    if (!canShareArchive) {
      markInfo('Archive sharing is disabled in production builds');
      return;
    }

    setBusyKey('share');
    try {
      const latestArchive = await resolveLatestArchiveForSharing();

      if (!latestArchive) {
        markInfo('No finalized zip found under applogs');
        return;
      }

      await shareLocalFileTarget({
        path: latestArchive.archive.path,
        name: latestArchive.archive.name,
        mimeType: 'application/zip',
        title: 'Share app log archive',
        subject: latestArchive.archive.name,
        message: `Rabby app log archive: ${latestArchive.archive.name}`,
        successMessage: `Opened share sheet: ${latestArchive.archive.name}`,
        cleanupPaths: latestArchive.cleanupPaths,
      });
    } catch (error) {
      markError('Share latest zip', error);
    } finally {
      setBusyKey(null);
    }
  }, [
    busyKey,
    canShareArchive,
    markError,
    markInfo,
    resolveLatestArchiveForSharing,
    shareLocalFileTarget,
  ]);

  const handleShareLatestLogFile = useCallback(async () => {
    if (busyKey) {
      return;
    }

    if (!canShareArchive) {
      markInfo('Archive sharing is disabled in production builds');
      return;
    }

    setBusyKey('share-log');
    try {
      const latestArchive = await resolveLatestArchiveForSharing();

      if (!latestArchive) {
        markInfo('No finalized zip found under applogs');
        return;
      }

      const latestLogFile = latestArchive.extractedEntries
        ? await extractLatestLogFileFromEntries(
            latestArchive.extractedEntries,
            latestArchive.archive.name,
            latestArchive.cleanupPaths,
            latestArchive.preferredLatestLogEntryPath,
          )
        : await extractLatestLogFileFromArchive(
            latestArchive.archive,
            latestArchive.cleanupPaths,
            latestArchive.preferredLatestLogEntryPath,
          );
      await shareLocalFileTarget(latestLogFile.shareTarget);
    } catch (error) {
      markError('Share latest log file', error);
    } finally {
      setBusyKey(null);
    }
  }, [
    busyKey,
    canShareArchive,
    markError,
    markInfo,
    resolveLatestArchiveForSharing,
    shareLocalFileTarget,
  ]);

  const handleOpenArchiveSharePicker = useCallback(async () => {
    if (busyKey) {
      return;
    }

    if (!canShareArchive) {
      markInfo('Archive sharing is disabled in production builds');
      return;
    }

    try {
      const nextSnapshot = await refreshSnapshot();
      const archives = nextSnapshot.files.filter(
        item => item.kind === 'zip' || item.kind === 'partial',
      );

      if (!archives.length) {
        markInfo('No zip or zip.partial found under applogs');
        return;
      }

      setIsArchiveSharePickerVisible(true);
    } catch (error) {
      markError('Open share picker', error);
    }
  }, [busyKey, canShareArchive, markError, markInfo, refreshSnapshot]);

  const handleShareSelectedArchive = useCallback(
    async (archive: ArchiveFileItem) => {
      if (busyKey) {
        return;
      }

      setBusyKey('share');
      try {
        await shareArchiveFile(archive);
        setIsArchiveSharePickerVisible(false);
      } catch (error) {
        markError('Share selected archive', error);
      } finally {
        setBusyKey(null);
      }
    },
    [busyKey, markError, shareArchiveFile],
  );

  const localPolicyHint =
    APP_RUNTIME_ENV === 'development'
      ? `Development local switch default is ${
          localDefaultEnabled ? 'ON' : 'OFF'
        }. Current local value: ${localFileLoggingEnabled ? 'true' : 'false'}.`
      : `Regression local switch default is ${
          localDefaultEnabled ? 'ON' : 'OFF'
        }. Current local value: ${localFileLoggingEnabled ? 'true' : 'false'}.`;

  return (
    <NormalScreenContainer noHeader style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Real Device Test Lab</Text>
          <Text style={styles.heroTitle}>App Log Verification</Text>
          <Text style={styles.heroDescription}>
            This page exercises the actual `react-native-fs` + zip streaming
            path on device. Use it to write logs, force archive finalization,
            inspect `applogs`, and validate that the latest finalized zip can be
            parsed back.
          </Text>
        </View>

        <Section
          title="Archive Share"
          description="Use sharing near the top of the page when you want to export the latest zip quickly, extract just the newest `.log` entry, or choose another archive by time range. When the logger currently has an active `.zip.partial`, `share latest` now finalizes that live archive first and then shares the finalized zip or its newest `.log` entry directly. The picker still accepts `.zip.partial`; inactive partial files fall back to an exported temporary zip.">
          <Button
            title={busyKey === 'share' ? 'Opening...' : 'Share Latest Zip'}
            type="ghost"
            height={48}
            disabled={!!busyKey || !canShareArchive}
            onPress={handleShareLatestZip}
            containerStyle={styles.singleActionButton}
          />
          <Button
            title={
              busyKey === 'share-log' ? 'Preparing...' : 'Share Latest Log File'
            }
            type="ghost"
            height={48}
            disabled={!!busyKey || !canShareArchive}
            onPress={handleShareLatestLogFile}
            containerStyle={styles.singleActionButton}
          />
          <Button
            title="Choose Archive to Share"
            type="ghost"
            height={48}
            disabled={!!busyKey || !canShareArchive}
            onPress={handleOpenArchiveSharePicker}
            containerStyle={styles.singleActionButton}
          />
          <Text style={styles.sectionHint}>
            {canShareArchive
              ? 'Non-production builds can share the latest archive directly, extract-and-share the newest `.log` entry, or open a picker to choose another finalized `.zip` or `.zip.partial`. Active partial archives are finalized on demand so the share result stays current.'
              : 'Archive sharing is disabled in production builds even if this page is reachable.'}
          </Text>
        </Section>

        <Section
          title="Logging Policy"
          description="Keep this enabled before running the write/flush/finalize flow. Development defaults on, regression defaults off until enabled, and production follows online config only.">
          <View style={styles.policyRow}>
            <View style={styles.policyTextBlock}>
              <Text style={styles.policyLabel}>Effective file logging</Text>
              <Text
                style={[
                  styles.policyValue,
                  {
                    color: effectiveEnabled
                      ? colors2024['green-default']
                      : colors2024['orange-default'],
                  },
                ]}>
                {effectiveEnabled ? 'Enabled' : 'Disabled'}
              </Text>
              <Text style={styles.policyHint}>
                env={APP_RUNTIME_ENV} · __DEV__={__DEV__ ? 'true' : 'false'}
              </Text>
            </View>
            <AppSwitch2024
              disabled={!canToggle}
              value={effectiveEnabled}
              onValueChange={nextValue => {
                if (!canToggle) {
                  return;
                }

                onToggle(nextValue);
                refreshSnapshot().catch(noop);
              }}
            />
          </View>

          <Text style={styles.sectionHint}>
            {isOnlineControlled
              ? `Production is controlled by onlineConfig: ${APP_FILE_LOGGING_ONLINE_SWITCH}`
              : `${localPolicyHint} Console capture follows the same policy.`}
          </Text>

          <MetaRow
            label="Console capture"
            value={consoleCaptureEnabled ? 'enabled' : 'disabled'}
            tone={consoleCaptureEnabled ? 'success' : 'warning'}
          />
          <MetaRow
            label="Prod online switch"
            value={`${APP_FILE_LOGGING_ONLINE_SWITCH} = ${
              snapshot.prodOnlineEnabled ? 'true' : 'false'
            }`}
            tone={snapshot.prodOnlineEnabled ? 'success' : 'warning'}
          />
          <MetaRow label="App log root" value={APP_LOG_ROOT_PATH} />
        </Section>

        <Section
          title="Runtime State"
          description="Watch these values while switching app state or forcing archive finalize.">
          <MetaRow label="Session" value={snapshot.loggerState.sessionId} />
          <MetaRow
            label="Active temp archive"
            value={snapshot.loggerState.activeArchiveTempPath || 'none'}
          />
          <MetaRow
            label="Active final archive"
            value={snapshot.loggerState.activeArchivePath || 'none'}
          />
          <MetaRow
            label="Active entry"
            value={snapshot.loggerState.activeEntryPath || 'none'}
          />
          <MetaRow
            label="Current entry size"
            value={formatBytes(snapshot.loggerState.activeEntryBytes ?? 0)}
          />
          <MetaRow
            label="Console capture"
            value={
              snapshot.loggerState.effectiveConsoleCaptureEnabled
                ? 'enabled'
                : 'disabled'
            }
            tone={
              snapshot.loggerState.effectiveConsoleCaptureEnabled
                ? 'success'
                : 'warning'
            }
          />
          <MetaRow
            label="Last refresh"
            value={formatDateTime(snapshot.refreshedAt)}
          />
          <MetaRow
            label="Last action"
            value={lastAction}
            tone={lastAction.includes('failed') ? 'warning' : 'default'}
          />
        </Section>

        <Section
          title="In-Memory Logs"
          description="View the live in-memory log buffer (newest first) on a dedicated screen for better scrolling performance.">
          <Button
            title="View In-Memory Logs"
            type="ghost"
            height={48}
            onPress={() => {
              navigation.dispatch(
                StackActions.push(RootNames.StackTestkits, {
                  screen: RootNames.InMemoryLogViewer,
                }),
              );
            }}
            containerStyle={styles.singleActionButton}
          />
        </Section>

        <Section
          title="Generate Logs"
          description="Sample logs cover console capture, explicit logger calls, masking, and timer events. The burst action pushes roughly 1.2 MB to help verify entry rotation.">
          <View style={styles.actionRow}>
            <Button
              title={busyKey === 'sample' ? 'Writing...' : 'Write Sample Set'}
              type="ghost"
              height={48}
              disabled={!!busyKey}
              onPress={handleWriteSampleLogs}
              containerStyle={styles.actionButton}
            />
            <Button
              title={
                busyKey === 'burst' ? 'Writing...' : 'Write Rotation Burst'
              }
              type="ghost"
              height={48}
              disabled={!!busyKey}
              onPress={handleWriteRotationBurst}
              containerStyle={styles.actionButton}
            />
          </View>
          <Text style={styles.sectionHint}>
            Burst payload: {BURST_LINE_COUNT} lines x{' '}
            {formatBytes(BURST_LINE_SIZE)} each.
          </Text>
        </Section>

        <Section
          title="Archive Controls"
          description="Flush and finalize let you force the writer into a stable state before validating or exporting the zip.">
          <View style={styles.actionRow}>
            <Button
              title={busyKey === 'flush' ? 'Flushing...' : 'Flush Queue'}
              type="ghost"
              height={48}
              disabled={!!busyKey}
              onPress={handleFlush}
              containerStyle={styles.actionButton}
            />
            <Button
              title={busyKey === 'finalize' ? 'Finalizing...' : 'Finalize Zip'}
              type="ghost"
              height={48}
              disabled={!!busyKey}
              onPress={handleFinalize}
              containerStyle={styles.actionButton}
            />
          </View>
          <View style={styles.actionRow}>
            <Button
              title={busyKey === 'refresh' ? 'Refreshing...' : 'Refresh Dir'}
              type="ghost"
              height={48}
              disabled={!!busyKey}
              onPress={handleRefresh}
              containerStyle={styles.actionButton}
            />
            <Button
              title={
                busyKey === 'validate' ? 'Validating...' : 'Validate Latest Zip'
              }
              type="ghost"
              height={48}
              disabled={!!busyKey}
              onPress={handleValidateLatestZip}
              containerStyle={styles.actionButton}
            />
          </View>
        </Section>

        <Section
          title="Archive Files"
          description="You should see finalized `.zip` files and, while logging is active, a current `.zip.partial`. Each row is explicitly labeled as `ZIP` or `ZIP PARTIAL` so you can tell whether it is already finalized.">
          <MetaRow
            label="Root exists"
            value={snapshot.rootExists ? 'true' : 'false'}
            tone={snapshot.rootExists ? 'success' : 'warning'}
          />
          <MetaRow
            label="Latest finalized zip"
            value={latestFinalizedArchive?.path || 'none'}
          />

          {snapshot.files.length === 0 ? (
            <Text style={styles.emptyText}>No files under applogs yet.</Text>
          ) : (
            snapshot.files.slice(0, 8).map(file => {
              const archiveKindDisplay = getArchiveKindDisplay(file.kind);

              return (
                <View key={file.path} style={styles.fileRow}>
                  <View style={styles.fileHeader}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text
                      style={[
                        styles.fileBadge,
                        file.kind === 'zip'
                          ? styles.fileBadgeZip
                          : file.kind === 'partial'
                          ? styles.fileBadgePartial
                          : styles.fileBadgeOther,
                      ]}>
                      {archiveKindDisplay.label}
                    </Text>
                  </View>
                  <Text style={styles.fileMeta}>
                    {formatBytes(file.size)} · {formatArchiveTimeRange(file)}
                  </Text>
                  <Text style={styles.fileKindHint}>
                    {archiveKindDisplay.description}
                  </Text>
                  <Text
                    style={styles.filePath}
                    numberOfLines={2}
                    ellipsizeMode="middle"
                    selectable>
                    {file.path}
                  </Text>
                </View>
              );
            })
          )}
        </Section>

        <Section
          title="Zip Validation"
          description="Validation reads the latest finalized zip from device storage and parses it in-app with `fflate.unzipSync()`.">
          {validationResult ? (
            <>
              <MetaRow
                label="Archive"
                value={`${validationResult.archiveName} · ${validationResult.entryCount} entries`}
                tone="success"
              />
              <MetaRow
                label="Archive path"
                value={validationResult.archivePath}
              />
              <MetaRow
                label="Uncompressed bytes"
                value={formatBytes(validationResult.totalBytes)}
              />
              <MetaRow
                label="First entry"
                value={validationResult.firstEntryPath || 'none'}
              />
              <MetaRow
                label="First line"
                value={validationResult.firstLinePreview || 'none'}
              />
              <MetaRow
                label="Checked at"
                value={formatDateTime(validationResult.checkedAt)}
              />
              <Text style={styles.validationListLabel}>Entry preview</Text>
              {validationResult.entryNames.slice(0, 5).map(entryName => (
                <Text key={entryName} style={styles.validationEntry}>
                  {entryName}
                </Text>
              ))}
            </>
          ) : (
            <Text style={styles.emptyText}>
              No validation result yet. Finalize a zip first, then tap `Validate
              Latest Zip`.
            </Text>
          )}
        </Section>

        <Section
          title="Suggested Flow"
          description="This is the shortest path to verify whether device-side zip streaming is actually stable.">
          <Text style={styles.checklistItem}>
            1. Confirm file logging is enabled.
          </Text>
          <Text style={styles.checklistItem}>2. Tap `Write Sample Set`.</Text>
          <Text style={styles.checklistItem}>3. Tap `Finalize Zip`.</Text>
          <Text style={styles.checklistItem}>
            4. Tap `Validate Latest Zip`.
          </Text>
          <Text style={styles.checklistItem}>
            5. Export that zip off-device and unzip it again on desktop.
          </Text>
          <Text style={styles.checklistItem}>
            6. Repeat once more with `Write Rotation Burst` and app
            backgrounding.
          </Text>
        </Section>
      </ScrollView>
      <AppBottomSheetModal
        ref={archiveSharePickerRef}
        snapPoints={archiveSharePickerSnapPoints}
        onDismiss={() => setIsArchiveSharePickerVisible(false)}
        enableDismissOnClose
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}>
        <View style={styles.shareSheetContainer}>
          <AppBottomSheetModalTitle title="Choose Archive to Share" />
          <Text style={styles.shareSheetDescription}>
            Finalized `.zip` and live `.zip.partial` are both allowed. Partial
            items are exported to a temporary zip before sharing.
          </Text>
          <BottomSheetScrollView
            contentContainerStyle={styles.shareSheetList}
            showsVerticalScrollIndicator={false}>
            {shareableArchives.length ? (
              shareableArchives.map(file => {
                const archiveKindDisplay = getArchiveKindDisplay(file.kind);

                return (
                  <TouchableOpacity
                    key={file.path}
                    style={styles.shareSheetItem}
                    disabled={busyKey === 'share'}
                    onPress={() => handleShareSelectedArchive(file)}>
                    <View style={styles.shareSheetItemHeader}>
                      <Text
                        style={styles.shareSheetItemTitle}
                        numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text
                        style={[
                          styles.shareSheetItemBadge,
                          file.kind === 'zip'
                            ? styles.shareSheetItemBadgeZip
                            : file.kind === 'partial'
                            ? styles.shareSheetItemBadgePartial
                            : styles.shareSheetItemBadgeOther,
                        ]}>
                        {archiveKindDisplay.label}
                      </Text>
                    </View>
                    <Text style={styles.shareSheetItemMeta}>
                      {formatBytes(file.size)} · {formatArchiveTimeRange(file)}
                    </Text>
                    <Text style={styles.shareSheetItemKindHint}>
                      {archiveKindDisplay.description}
                    </Text>
                    <Text
                      style={styles.shareSheetItemPath}
                      numberOfLines={2}
                      ellipsizeMode="middle">
                      {file.path}
                    </Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.emptyText}>
                No zip or zip.partial files found.
              </Text>
            )}
          </BottomSheetScrollView>
        </View>
      </AppBottomSheetModal>
    </NormalScreenContainer>
  );
}

const getStyles = createGetStyles2024(ctx => {
  const monoFont = Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  });

  return {
    container: {
      flex: 1,
      backgroundColor: ctx.colors2024['neutral-bg-1'],
    },
    contentContainer: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 40,
      gap: 14,
    },
    heroCard: {
      padding: 20,
      borderRadius: 24,
      backgroundColor: ctx.colors2024['neutral-card-1'],
      borderWidth: 1,
      borderColor: ctx.colors2024['neutral-line'],
      gap: 8,
    },
    heroEyebrow: {
      fontSize: 13,
      fontWeight: '700',
      color: ctx.colors2024['brand-default'],
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    heroTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: ctx.colors2024['neutral-title-1'],
    },
    heroDescription: {
      fontSize: 14,
      lineHeight: 22,
      color: ctx.colors2024['neutral-body'],
    },
    sectionCard: {
      padding: 18,
      borderRadius: 20,
      backgroundColor: ctx.colors2024['neutral-card-1'],
      borderWidth: 1,
      borderColor: ctx.colors2024['neutral-line'],
      gap: 12,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
    },
    sectionDescription: {
      fontSize: 13,
      lineHeight: 20,
      color: ctx.colors2024['neutral-body'],
    },
    sectionHint: {
      fontSize: 13,
      lineHeight: 20,
      color: ctx.colors2024['neutral-foot'],
    },
    policyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 4,
    },
    policyTextBlock: {
      flex: 1,
      gap: 4,
    },
    policyLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: ctx.colors2024['neutral-title-1'],
    },
    policyValue: {
      fontSize: 18,
      fontWeight: '700',
    },
    policyHint: {
      fontSize: 12,
      color: ctx.colors2024['neutral-foot'],
    },
    metaRow: {
      gap: 6,
      paddingVertical: 2,
    },
    metaLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: ctx.colors2024['neutral-foot'],
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    metaValue: {
      fontSize: 14,
      lineHeight: 20,
      color: ctx.colors2024['neutral-title-1'],
      fontFamily: monoFont,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 12,
    },
    actionButton: {
      flex: 1,
    },
    singleActionButton: {
      width: '100%',
    },
    shareSheetContainer: {
      flex: 1,
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    shareSheetDescription: {
      fontSize: 13,
      lineHeight: 20,
      color: ctx.colors2024['neutral-foot'],
      marginBottom: 16,
    },
    shareSheetList: {
      gap: 12,
      paddingBottom: 12,
    },
    shareSheetItem: {
      gap: 6,
      padding: 14,
      borderRadius: 16,
      backgroundColor: ctx.colors2024['neutral-card-2'],
      borderWidth: 1,
      borderColor: ctx.colors2024['neutral-line'],
    },
    shareSheetItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    shareSheetItemTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
      fontFamily: monoFont,
    },
    shareSheetItemBadge: {
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    shareSheetItemBadgeZip: {
      color: ctx.colors2024['green-default'],
      backgroundColor: `${ctx.colors2024['green-default']}1F`,
    },
    shareSheetItemBadgePartial: {
      color: ctx.colors2024['orange-default'],
      backgroundColor: `${ctx.colors2024['orange-default']}1F`,
    },
    shareSheetItemBadgeOther: {
      color: ctx.colors2024['neutral-foot'],
      backgroundColor: ctx.colors2024['neutral-line'],
    },
    shareSheetItemMeta: {
      fontSize: 12,
      color: ctx.colors2024['neutral-foot'],
      fontFamily: monoFont,
    },
    shareSheetItemKindHint: {
      fontSize: 12,
      lineHeight: 18,
      color: ctx.colors2024['neutral-body'],
    },
    shareSheetItemPath: {
      fontSize: 12,
      lineHeight: 18,
      color: ctx.colors2024['neutral-body'],
      fontFamily: monoFont,
    },
    emptyText: {
      fontSize: 14,
      lineHeight: 20,
      color: ctx.colors2024['neutral-foot'],
    },
    fileRow: {
      gap: 6,
      padding: 14,
      borderRadius: 16,
      backgroundColor: ctx.colors2024['neutral-card-2'],
      borderWidth: 1,
      borderColor: ctx.colors2024['neutral-line'],
    },
    fileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    fileName: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
      fontFamily: monoFont,
    },
    fileBadge: {
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    fileBadgeZip: {
      color: ctx.colors2024['green-default'],
      backgroundColor: `${ctx.colors2024['green-default']}1F`,
    },
    fileBadgePartial: {
      color: ctx.colors2024['orange-default'],
      backgroundColor: `${ctx.colors2024['orange-default']}1F`,
    },
    fileBadgeOther: {
      color: ctx.colors2024['neutral-foot'],
      backgroundColor: ctx.colors2024['neutral-line'],
    },
    fileMeta: {
      fontSize: 12,
      color: ctx.colors2024['neutral-foot'],
      fontFamily: monoFont,
    },
    fileKindHint: {
      fontSize: 12,
      lineHeight: 18,
      color: ctx.colors2024['neutral-body'],
    },
    filePath: {
      fontSize: 12,
      lineHeight: 18,
      color: ctx.colors2024['neutral-body'],
      fontFamily: monoFont,
    },
    validationListLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: ctx.colors2024['neutral-foot'],
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    validationEntry: {
      fontSize: 13,
      lineHeight: 18,
      color: ctx.colors2024['neutral-title-1'],
      fontFamily: monoFont,
    },
    checklistItem: {
      fontSize: 14,
      lineHeight: 20,
      color: ctx.colors2024['neutral-title-1'],
    },
  };
});
