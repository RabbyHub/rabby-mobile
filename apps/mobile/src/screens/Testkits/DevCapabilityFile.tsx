import Clipboard from '@react-native-clipboard/clipboard';
import {
  BottomSheetFlatList,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import {
  useFocusEffect,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import dayjs from 'dayjs';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import RNFS, {
  type NativeFSAsyncReadStreamStats,
  type NativeFSAsyncWriteStreamStats,
  type NativeFSDiagnosticEvent,
  type NativeFSWriteStreamStats,
} from '@rabby-wallet/react-native-fs';

import { AppBottomSheetModal, AppBottomSheetModalTitle } from '@/components';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { NextSearchBar } from '@/components2024/SearchBar';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { toast } from '@/components2024/Toast';
import {
  getFileCapabilitySnapshot,
  listAccessibleVisualMedia,
  requestVisualMediaAccess,
  type NativeAccessibleVisualMediaItem,
  type NativeFileCapabilitySnapshot,
} from '@/core/native/fileCapability';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { useTheme2024 } from '@/hooks/theme';
import { PillsSwitch } from '@/components2024/PillSwitch';
import { createGetStyles2024 } from '@/utils/styles';
import { RootNames } from '@/constant/layout';

const TAB_OPTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'debug', label: 'Debug' },
] as const;

type TabKey = (typeof TAB_OPTIONS)[number]['key'];

type RNFSReadDirItem = Awaited<ReturnType<typeof RNFS.readDir>>[number];

type AppOwnedFileItem = {
  scopeKey: string;
  scopeLabel: string;
  name: string;
  path: string;
  relativePath: string;
  sizeBytes: number;
  sizeLabel: string;
  modifiedAt: number;
  modifiedAtLabel: string;
  searchText: string;
};

type AppOwnedFileSnapshot = {
  files: AppOwnedFileItem[];
  scannedDirCount: number;
  truncated: boolean;
  errors: string[];
  refreshedAt: string;
};

type AccessibleImageItem = NativeAccessibleVisualMediaItem & {
  sizeLabel: string;
  dimensionLabel: string;
  dateAddedLabel: string;
  searchText: string;
};

type AccessibleImageSnapshot = {
  items: AccessibleImageItem[];
  truncated: boolean;
  limit: number;
  refreshedAt: string;
};

type ByteIoTestResult = {
  operation: 'write' | 'read';
  path: string;
  jsiAvailable: boolean;
  byteLength: number;
  checksum: string;
  durationMs: number;
  verified: boolean;
  updatedAt: string;
};

type OwnedStreamTestResult = {
  path: string;
  jsiAvailable: boolean;
  totalBytes: number;
  chunkBytes: number;
  bufferCount: number;
  commits: number;
  writeDurationMs: number;
  readDurationMs: number;
  checksum: string;
  verified: boolean;
  staleCommitRejected: boolean;
  stats: NativeFSWriteStreamStats;
  updatedAt: string;
};

type AsyncStreamTestResult = {
  path: string;
  jsiAvailable: boolean;
  asyncAvailable: boolean;
  totalBytes: number;
  chunkBytes: number;
  bufferCount: number;
  commits: number;
  reads: number;
  writeDurationMs: number;
  readDurationMs: number;
  checksum: string;
  verified: boolean;
  writeStats: NativeFSAsyncWriteStreamStats;
  readStats: NativeFSAsyncReadStreamStats;
  updatedAt: string;
};

type BatchedAsyncStreamTestResult = AsyncStreamTestResult & {
  batchBytes: number;
  writeBatches: number;
  readBatches: number;
};

type PersistFileTestResult = {
  sourcePath: string;
  copyTargetPath: string;
  moveTargetPath: string;
  totalBytes: number;
  copyBytes: number;
  moveBytes: number;
  copyDurationMs: number;
  moveDurationMs: number;
  readDurationMs: number;
  checksum: string;
  verified: boolean;
  sourceRemoved: boolean;
  updatedAt: string;
};

const APP_FILE_SCAN_LIMIT = 300;
const APP_FILE_SCAN_DEPTH = 4;
const FILE_SHEET_PAGE_SIZE = 10;
const ACCESSIBLE_IMAGE_QUERY_LIMIT = IS_IOS ? 20 : 60;
const BYTE_IO_TEST_BYTES = 16 * 1024 * 1024;
const BYTE_IO_TEST_DIR = `${
  RNFS.CachesDirectoryPath || RNFS.DocumentDirectoryPath
}/rabby-file-playground`;
const BYTE_IO_TEST_PATH = `${BYTE_IO_TEST_DIR}/typed-array-io.bin`;
const OWNED_STREAM_TEST_BYTES = 16 * 1024 * 1024;
const OWNED_STREAM_CHUNK_BYTES = 256 * 1024;
const OWNED_STREAM_BUFFER_COUNT = 2;
const OWNED_STREAM_TEST_PATH = `${BYTE_IO_TEST_DIR}/owned-stream-io.bin`;
const ASYNC_STREAM_TEST_BYTES = 16 * 1024 * 1024;
const ASYNC_STREAM_CHUNK_BYTES = 256 * 1024;
const ASYNC_STREAM_BUFFER_COUNT = 2;
const ASYNC_STREAM_TEST_PATH = `${BYTE_IO_TEST_DIR}/async-stream-io.bin`;
const ASYNC_BATCH_STREAM_TEST_BYTES = 16 * 1024 * 1024;
const ASYNC_BATCH_STREAM_CHUNK_BYTES = 256 * 1024;
const ASYNC_BATCH_STREAM_CHUNKS_PER_BATCH = 16;
const ASYNC_BATCH_STREAM_BUFFER_COUNT = ASYNC_BATCH_STREAM_CHUNKS_PER_BATCH;
const ASYNC_BATCH_STREAM_BATCH_BYTES =
  ASYNC_BATCH_STREAM_CHUNK_BYTES * ASYNC_BATCH_STREAM_CHUNKS_PER_BATCH;
const ASYNC_BATCH_STREAM_TEST_PATH = `${BYTE_IO_TEST_DIR}/async-stream-batch-io.bin`;
const PERSIST_FILE_TEST_BYTES = 16 * 1024 * 1024;
const PERSIST_FILE_SOURCE_PATH = `${BYTE_IO_TEST_DIR}/persist-file-source.bin`;
const PERSIST_FILE_COPY_PATH = `${BYTE_IO_TEST_DIR}/persist-file-copy.bin`;
const PERSIST_FILE_MOVE_PATH = `${BYTE_IO_TEST_DIR}/persist-file-move.bin`;

const APP_OWNED_FILE_DIRS = [
  { key: 'documents', label: 'Documents', path: RNFS.DocumentDirectoryPath },
  { key: 'cache', label: 'Cache', path: RNFS.CachesDirectoryPath },
  { key: 'temp', label: 'Temp', path: RNFS.TemporaryDirectoryPath },
  {
    key: 'external-documents',
    label: 'External Documents',
    path: RNFS.ExternalDirectoryPath,
  },
  {
    key: 'external-cache',
    label: 'External Cache',
    path: RNFS.ExternalCachesDirectoryPath,
  },
];

function formatBytes(bytes: number) {
  if (bytes <= 0) {
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
    value >= 100 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)
  } ${units[unitIndex]}`;
}

function formatPermissionState(value: string) {
  switch (value) {
    case 'full':
      return 'Full';
    case 'limited':
      return 'Limited';
    case 'partial':
      return 'Partial';
    case 'selection-required':
      return 'Needs picker';
    case 'broad-read':
      return 'Broad read';
    case 'all-files':
      return 'All files';
    case 'not-determined':
      return 'Not determined';
    case 'not-applicable':
      return 'N/A';
    default:
      if (!value) {
        return '-';
      }

      return value
        .split('-')
        .map(item => item.charAt(0).toUpperCase() + item.slice(1))
        .join(' ');
  }
}

function toneForState(value: string) {
  switch (value) {
    case 'full':
    case 'granted':
    case 'all-files':
    case 'broad-read':
      return 'success';
    case 'limited':
    case 'partial':
    case 'selection-required':
      return 'warning';
    case 'denied':
    case 'restricted':
    case 'unavailable':
      return 'danger';
    default:
      return 'default';
  }
}

function resolveRenderableImageUri(
  item?: Pick<NativeAccessibleVisualMediaItem, 'uri' | 'previewUri'> | null,
) {
  const candidate = item?.previewUri || item?.uri || '';
  if (!candidate) {
    return null;
  }

  if (candidate.startsWith('ph://')) {
    return null;
  }

  return candidate;
}

function nowMs() {
  return Date.now();
}

function formatDurationMs(durationMs?: number | null) {
  if (durationMs === null || durationMs === undefined) {
    return '-';
  }

  return `${durationMs.toFixed(1)} ms`;
}

function formatDurationUs(durationUs?: number | null) {
  if (durationUs === null || durationUs === undefined) {
    return '-';
  }

  return `${(durationUs / 1000).toFixed(1)} ms`;
}

function formatNativeFsDiagnosticEvent(event: NativeFSDiagnosticEvent) {
  const status = event.isError ? 'error' : event.category;
  const message = event.message ? ` · ${event.message}` : '';

  return `${status}:${event.operation} · ${formatBytes(
    event.bytes,
  )} · ${formatDurationUs(event.durationUs)} · tid=${event.tid}${message}`;
}

function normalizeChecksum(checksum: number) {
  return checksum.toString(16).padStart(8, '0');
}

function updateChecksum(checksum: number, value: number, index: number) {
  return (checksum + value * ((index % 251) + 1)) >>> 0;
}

function getPatternByte(index: number) {
  return (index * 31 + 17) & 0xff;
}

function checksumPattern(length: number) {
  let checksum = 0;

  for (let index = 0; index < length; index += 1) {
    checksum = updateChecksum(checksum, getPatternByte(index), index);
  }

  return normalizeChecksum(checksum);
}

function createByteIoPayload(length: number) {
  const bytes = new Uint8Array(length);
  let checksum = 0;

  for (let index = 0; index < length; index += 1) {
    const value = getPatternByte(index);
    bytes[index] = value;
    checksum = updateChecksum(checksum, value, index);
  }

  return {
    bytes,
    checksum: normalizeChecksum(checksum),
  };
}

function checksumBytes(bytes: Uint8Array) {
  let checksum = 0;

  for (let index = 0; index < bytes.byteLength; index += 1) {
    checksum = updateChecksum(checksum, bytes[index], index);
  }

  return normalizeChecksum(checksum);
}

async function listAppOwnedFiles(): Promise<AppOwnedFileSnapshot> {
  const dedupedDirs = APP_OWNED_FILE_DIRS.filter(
    (dir, index, list): dir is { key: string; label: string; path: string } =>
      !!dir.path && list.findIndex(item => item.path === dir.path) === index,
  );
  const files: AppOwnedFileItem[] = [];
  const errors: string[] = [];
  let scannedDirCount = 0;
  let truncated = false;

  const visitDir = async (
    rootDir: { key: string; label: string; path: string },
    currentPath: string,
    depth: number,
  ) => {
    if (truncated) {
      return;
    }

    let entries: RNFSReadDirItem[];
    try {
      entries = await RNFS.readDir(currentPath);
      scannedDirCount += 1;
    } catch (error) {
      errors.push(`${rootDir.label}: ${currentPath}`);
      return;
    }

    for (const entry of entries) {
      if (files.length >= APP_FILE_SCAN_LIMIT) {
        truncated = true;
        return;
      }

      if (entry.isDirectory()) {
        if (depth < APP_FILE_SCAN_DEPTH) {
          await visitDir(rootDir, entry.path, depth + 1);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const sizeBytes = Number(entry.size) || 0;
      const modifiedAt =
        entry.mtime instanceof Date ? entry.mtime.getTime() : 0;
      const relativePath =
        entry.path.indexOf(rootDir.path) === 0
          ? entry.path.slice(rootDir.path.length).replace(/^\/+/, '') ||
            entry.name
          : entry.name;

      files.push({
        scopeKey: rootDir.key,
        scopeLabel: rootDir.label,
        name: entry.name,
        path: entry.path,
        relativePath,
        sizeBytes,
        sizeLabel: formatBytes(sizeBytes),
        modifiedAt,
        modifiedAtLabel: modifiedAt
          ? dayjs(modifiedAt).format('YYYY/MM/DD HH:mm:ss')
          : '-',
        searchText:
          `${rootDir.label} ${entry.name} ${entry.path}`.toLowerCase(),
      });
    }
  };

  for (const dir of dedupedDirs) {
    await visitDir(dir, dir.path, 0);
    if (truncated) {
      break;
    }
  }

  files.sort(
    (left, right) =>
      right.modifiedAt - left.modifiedAt ||
      right.sizeBytes - left.sizeBytes ||
      left.path.localeCompare(right.path),
  );

  return {
    files,
    scannedDirCount,
    truncated,
    errors,
    refreshedAt: new Date().toISOString(),
  };
}

function DevCapabilityFile() {
  const route = useRoute<
    RouteProp<
      {
        [RootNames.DevCapabilityFile]: {
          tab?: TabKey;
        };
      },
      typeof RootNames.DevCapabilityFile
    >
  >();
  const routeTabKey = route.params?.tab;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });
  const [tabKey, setTabKey] = useState<TabKey>(routeTabKey || 'overview');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState('Idle');
  const [capabilitySnapshot, setCapabilitySnapshot] =
    useState<NativeFileCapabilitySnapshot | null>(null);
  const [fileSnapshot, setFileSnapshot] = useState<AppOwnedFileSnapshot | null>(
    null,
  );
  const [accessibleImageSnapshot, setAccessibleImageSnapshot] =
    useState<AccessibleImageSnapshot | null>(null);
  const [selectedAccessibleImage, setSelectedAccessibleImage] =
    useState<AccessibleImageItem | null>(null);
  const [byteIoResult, setByteIoResult] = useState<ByteIoTestResult | null>(
    null,
  );
  const [ownedStreamResult, setOwnedStreamResult] =
    useState<OwnedStreamTestResult | null>(null);
  const [asyncStreamResult, setAsyncStreamResult] =
    useState<AsyncStreamTestResult | null>(null);
  const [batchedAsyncStreamResult, setBatchedAsyncStreamResult] =
    useState<BatchedAsyncStreamTestResult | null>(null);
  const [persistFileResult, setPersistFileResult] =
    useState<PersistFileTestResult | null>(null);
  const [nativeFsDiagnostics, setNativeFsDiagnostics] = useState<
    NativeFSDiagnosticEvent[]
  >([]);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [fileSheetVisible, setFileSheetVisible] = useState(false);
  const [accessibleImageSheetVisible, setAccessibleImageSheetVisible] =
    useState(false);
  const [fileKeyword, setFileKeyword] = useState('');
  const [accessibleImageKeyword, setAccessibleImageKeyword] = useState('');
  const [visibleFileCount, setVisibleFileCount] =
    useState(FILE_SHEET_PAGE_SIZE);
  const actionSheetRef = useRef<AppBottomSheetModal>(null);
  const fileSheetRef = useRef<AppBottomSheetModal>(null);
  const accessibleImageSheetRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (routeTabKey) {
      setTabKey(routeTabKey);
    }
  }, [routeTabKey]);

  const panelMaxHeight = useMemo(
    () => Math.floor(windowHeight * 0.46),
    [windowHeight],
  );
  const previewMaxHeight = useMemo(
    () => Math.floor(windowHeight * 0.5),
    [windowHeight],
  );
  const actionSheetSnapPoints = useMemo(() => [380], []);
  const fileSheetSnapPoints = useMemo(
    () => [Math.min(Math.floor(windowHeight * 0.82), 720)],
    [windowHeight],
  );
  const accessibleImageSheetSnapPoints = useMemo(
    () => [Math.min(Math.floor(windowHeight * 0.82), 720)],
    [windowHeight],
  );

  const loadCapabilitySnapshot = useCallback(async () => {
    const nextCapabilitySnapshot = await getFileCapabilitySnapshot();
    setCapabilitySnapshot(nextCapabilitySnapshot);
    return nextCapabilitySnapshot;
  }, []);

  const loadFileSnapshot = useCallback(async () => {
    const nextFileSnapshot = await listAppOwnedFiles();
    setFileSnapshot(nextFileSnapshot);
    return nextFileSnapshot;
  }, []);

  const refreshAll = useCallback(async () => {
    setBusyKey('refresh');
    try {
      await Promise.all([loadCapabilitySnapshot(), loadFileSnapshot()]);
      setLastAction(
        `${dayjs().format('HH:mm:ss')} Refreshed capability + files`,
      );
    } catch (error) {
      console.error('refreshAll failed', error);
      toast.error('Failed to refresh file capability snapshot');
      setLastAction(`${dayjs().format('HH:mm:ss')} Refresh failed`);
    } finally {
      setBusyKey(null);
    }
  }, [loadCapabilitySnapshot, loadFileSnapshot]);

  useFocusEffect(
    useCallback(() => {
      refreshAll().catch(error => {
        console.error(error);
      });
    }, [refreshAll]),
  );

  const handleRefreshCapabilitySnapshot = useCallback(async () => {
    setBusyKey('refresh-capability');
    try {
      await loadCapabilitySnapshot();
      setLastAction(`${dayjs().format('HH:mm:ss')} Loaded permission snapshot`);
      toast.success('Loaded permission snapshot');
    } catch (error) {
      console.error('handleRefreshCapabilitySnapshot failed', error);
      toast.error('Failed to load permission snapshot');
      setLastAction(
        `${dayjs().format('HH:mm:ss')} Permission snapshot load failed`,
      );
    } finally {
      setBusyKey(null);
    }
  }, [loadCapabilitySnapshot]);

  const handleRefreshFileSnapshot = useCallback(async () => {
    setBusyKey('refresh-files');
    try {
      await loadFileSnapshot();
      setLastAction(`${dayjs().format('HH:mm:ss')} Scanned app-owned files`);
      toast.success('Scanned app-owned files');
    } catch (error) {
      console.error('handleRefreshFileSnapshot failed', error);
      toast.error('Failed to scan app-owned files');
      setLastAction(`${dayjs().format('HH:mm:ss')} File scan failed`);
    } finally {
      setBusyKey(null);
    }
  }, [loadFileSnapshot]);

  useEffect(() => {
    if (actionSheetVisible) {
      actionSheetRef.current?.present();
    } else {
      actionSheetRef.current?.dismiss();
    }
  }, [actionSheetVisible]);

  useEffect(() => {
    if (fileSheetVisible) {
      fileSheetRef.current?.present();
    } else {
      fileSheetRef.current?.dismiss();
    }
  }, [fileSheetVisible]);

  useEffect(() => {
    if (accessibleImageSheetVisible) {
      accessibleImageSheetRef.current?.present();
    } else {
      accessibleImageSheetRef.current?.dismiss();
    }
  }, [accessibleImageSheetVisible]);

  useEffect(() => {
    setVisibleFileCount(FILE_SHEET_PAGE_SIZE);
  }, [fileKeyword, fileSnapshot?.refreshedAt]);

  const filteredFiles = useMemo(() => {
    const keyword = fileKeyword.trim().toLowerCase();
    const files = fileSnapshot?.files || [];

    if (!keyword) {
      return files;
    }

    return files.filter(item => item.searchText.includes(keyword));
  }, [fileKeyword, fileSnapshot?.files]);

  const visibleFiles = useMemo(() => {
    return filteredFiles.slice(0, visibleFileCount);
  }, [filteredFiles, visibleFileCount]);

  const filteredAccessibleImages = useMemo(() => {
    const keyword = accessibleImageKeyword.trim().toLowerCase();
    const items = accessibleImageSnapshot?.items || [];

    if (!keyword) {
      return items;
    }

    return items.filter(item => item.searchText.includes(keyword));
  }, [accessibleImageKeyword, accessibleImageSnapshot?.items]);

  const selectedAccessibleImagePreviewSize = useMemo(() => {
    const maxWidth = Math.min(windowWidth - 72, 520);
    const fallbackWidth = maxWidth;
    const fallbackHeight = Math.min(
      previewMaxHeight,
      Math.floor(maxWidth * 0.72),
    );
    const sourceWidth = Math.max(selectedAccessibleImage?.width || 0, 1);
    const sourceHeight = Math.max(selectedAccessibleImage?.height || 0, 1);

    if (!selectedAccessibleImage?.width || !selectedAccessibleImage?.height) {
      return {
        width: fallbackWidth,
        height: fallbackHeight,
      };
    }

    const scale = Math.min(
      maxWidth / sourceWidth,
      previewMaxHeight / sourceHeight,
    );

    return {
      width: Math.max(1, Math.floor(sourceWidth * scale)),
      height: Math.max(1, Math.floor(sourceHeight * scale)),
    };
  }, [
    previewMaxHeight,
    selectedAccessibleImage?.height,
    selectedAccessibleImage?.width,
    windowWidth,
  ]);
  const selectedAccessibleImageSourceUri = useMemo(() => {
    return resolveRenderableImageUri(selectedAccessibleImage);
  }, [selectedAccessibleImage]);

  const canTriggerVisualMediaAccess = useMemo(() => {
    if (IS_ANDROID) {
      return true;
    }

    return !!(
      capabilitySnapshot?.visualMedia.canRequest ||
      capabilitySnapshot?.visualMedia.canReselect
    );
  }, [
    capabilitySnapshot?.visualMedia.canRequest,
    capabilitySnapshot?.visualMedia.canReselect,
  ]);

  const visualMediaActionTitle = useMemo(() => {
    if (capabilitySnapshot?.visualMedia.canReselect) {
      return IS_IOS ? 'Select more photos' : 'Re-select more photos/videos';
    }

    return IS_IOS ? 'Request photo access' : 'Request photo & video access';
  }, [capabilitySnapshot?.visualMedia.canReselect]);

  const FileSeparator = useCallback(
    () => <View style={styles.fileListGap} />,
    [styles.fileListGap],
  );

  const debugPayload = useMemo(
    () =>
      JSON.stringify(
        {
          lastAction,
          capabilitySnapshot,
          fileSnapshot: fileSnapshot
            ? {
                ...fileSnapshot,
                files: fileSnapshot.files.map(item => ({
                  scopeLabel: item.scopeLabel,
                  name: item.name,
                  relativePath: item.relativePath,
                  sizeBytes: item.sizeBytes,
                  modifiedAt: item.modifiedAt,
                })),
              }
            : null,
          accessibleImages: accessibleImageSnapshot
            ? {
                count: accessibleImageSnapshot.items.length,
                truncated: accessibleImageSnapshot.truncated,
                limit: accessibleImageSnapshot.limit,
                refreshedAt: accessibleImageSnapshot.refreshedAt,
                preview: accessibleImageSnapshot.items
                  .slice(0, 8)
                  .map(item => ({
                    name: item.name,
                    sizeBytes: item.sizeBytes,
                    width: item.width,
                    height: item.height,
                  })),
              }
            : null,
          selectedAccessibleImage: selectedAccessibleImage
            ? {
                name: selectedAccessibleImage.name,
                mimeType: selectedAccessibleImage.mimeType,
                sizeBytes: selectedAccessibleImage.sizeBytes,
                width: selectedAccessibleImage.width,
                height: selectedAccessibleImage.height,
              }
            : null,
          byteIoResult,
          ownedStreamResult,
          asyncStreamResult,
          batchedAsyncStreamResult,
          persistFileResult,
          nativeFsDiagnostics: nativeFsDiagnostics.slice(-16),
        },
        null,
        2,
      ),
    [
      accessibleImageSnapshot,
      asyncStreamResult,
      batchedAsyncStreamResult,
      byteIoResult,
      capabilitySnapshot,
      fileSnapshot,
      lastAction,
      nativeFsDiagnostics,
      ownedStreamResult,
      persistFileResult,
      selectedAccessibleImage,
    ],
  );

  const handleOpenSettings = useCallback(async () => {
    setActionSheetVisible(false);
    try {
      await Linking.openSettings();
      setLastAction(`${dayjs().format('HH:mm:ss')} Opened system settings`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to open system settings');
    }
  }, []);

  const handleOpenFileSheet = useCallback(() => {
    setActionSheetVisible(false);
    setFileSheetVisible(true);
  }, []);

  const handleCopyDebugPayload = useCallback(() => {
    Clipboard.setString(debugPayload);
    toast.success('Copied');
  }, [debugPayload]);

  const handleRequestVisualMediaAccess = useCallback(async () => {
    setBusyKey('visual-media');
    try {
      const nextSnapshot = await requestVisualMediaAccess({
        includeImages: true,
        includeVideos: true,
      });

      setCapabilitySnapshot(nextSnapshot);
      setActionSheetVisible(false);
      setLastAction(
        `${dayjs().format('HH:mm:ss')} Updated ${
          IS_IOS ? 'iOS photo access' : 'Android media access'
        }`,
      );
      toast.success(
        nextSnapshot.visualMedia.canReselect
          ? IS_IOS
            ? 'Limited photo selection updated'
            : 'Selected-media access updated'
          : 'Visual media access checked',
      );
    } catch (error) {
      console.error(error);
      toast.error(
        `Failed to update ${
          IS_IOS ? 'iOS photo' : 'Android visual media'
        } access`,
      );
      setLastAction(
        `${dayjs().format('HH:mm:ss')} ${
          IS_IOS ? 'iOS photo access' : 'Android media access'
        } update failed`,
      );
    } finally {
      setBusyKey(null);
    }
  }, []);

  const handleBrowseAccessibleImages = useCallback(async () => {
    setBusyKey('accessible-images');
    try {
      const result = await listAccessibleVisualMedia({
        mediaType: 'image',
        limit: ACCESSIBLE_IMAGE_QUERY_LIMIT,
      });
      const items = result.items.map(item => ({
        ...item,
        sizeLabel:
          item.sizeBytes > 0
            ? formatBytes(item.sizeBytes)
            : 'Unknown file size',
        dimensionLabel:
          item.width > 0 && item.height > 0
            ? `${item.width} x ${item.height}`
            : 'Unknown size',
        dateAddedLabel: item.dateAddedMs
          ? dayjs(item.dateAddedMs).format('YYYY/MM/DD HH:mm:ss')
          : '-',
        searchText: `${item.name} ${item.mimeType} ${item.uri}`.toLowerCase(),
      }));

      setAccessibleImageSnapshot({
        items,
        truncated: result.truncated,
        limit: result.limit,
        refreshedAt: new Date().toISOString(),
      });
      setAccessibleImageKeyword('');
      setAccessibleImageSheetVisible(true);
      setLastAction(
        `${dayjs().format('HH:mm:ss')} Loaded ${
          items.length
        } accessible images`,
      );
    } catch (error) {
      console.error(error);
      toast.error('Failed to load accessible images');
      setLastAction(
        `${dayjs().format('HH:mm:ss')} Accessible image query failed`,
      );
    } finally {
      setBusyKey(null);
    }
  }, []);

  const handleSelectAccessibleImage = useCallback(
    (item: AccessibleImageItem) => {
      setSelectedAccessibleImage(item);
      setAccessibleImageSheetVisible(false);
      setLastAction(
        `${dayjs().format('HH:mm:ss')} Selected image ${item.name}`,
      );
    },
    [],
  );

  const handleClearAccessibleImage = useCallback(() => {
    setSelectedAccessibleImage(null);
    setLastAction(`${dayjs().format('HH:mm:ss')} Cleared image preview`);
  }, []);

  const refreshNativeFsDiagnostics = useCallback(() => {
    try {
      setNativeFsDiagnostics(RNFS.getDiagnosticsSnapshot());
    } catch (error) {
      console.warn('Failed to read native FS diagnostics', error);
    }
  }, []);

  const handleWriteByteIoFile = useCallback(async () => {
    setBusyKey('byte-write');
    try {
      const jsiAvailable = RNFS.isJSIAvailable();

      if (!jsiAvailable) {
        throw new Error('Rabby native FS JSI binding is unavailable');
      }

      RNFS.clearDiagnostics();

      await RNFS.mkdir(BYTE_IO_TEST_DIR, {
        NSURLIsExcludedFromBackupKey: true,
      });

      const { bytes, checksum } = createByteIoPayload(BYTE_IO_TEST_BYTES);
      const startedAt = nowMs();
      RNFS.writeFileBytes(BYTE_IO_TEST_PATH, bytes);
      const durationMs = nowMs() - startedAt;

      const result = {
        operation: 'write',
        path: BYTE_IO_TEST_PATH,
        jsiAvailable,
        byteLength: bytes.byteLength,
        checksum,
        durationMs,
        verified: RNFS.existsSync(BYTE_IO_TEST_PATH),
        updatedAt: new Date().toISOString(),
      } satisfies ByteIoTestResult;

      setByteIoResult(result);
      refreshNativeFsDiagnostics();
      await loadFileSnapshot();
      setLastAction(
        `${dayjs().format('HH:mm:ss')} Wrote ${formatBytes(
          result.byteLength,
        )} via JSI bytes`,
      );
      toast.success('Byte file written');
    } catch (error) {
      console.error('handleWriteByteIoFile failed', error);
      toast.error('Failed to write byte file');
      setLastAction(`${dayjs().format('HH:mm:ss')} Byte write failed`);
    } finally {
      setBusyKey(null);
    }
  }, [loadFileSnapshot, refreshNativeFsDiagnostics]);

  const handleReadByteIoFile = useCallback(async () => {
    setBusyKey('byte-read');
    try {
      const jsiAvailable = RNFS.isJSIAvailable();

      if (!jsiAvailable) {
        throw new Error('Rabby native FS JSI binding is unavailable');
      }

      RNFS.clearDiagnostics();

      const startedAt = nowMs();
      const bytes = RNFS.readFileBytes(BYTE_IO_TEST_PATH);
      const durationMs = nowMs() - startedAt;
      const checksum = checksumBytes(bytes);
      const expectedChecksum = checksumPattern(BYTE_IO_TEST_BYTES);
      const verified =
        bytes.byteLength === BYTE_IO_TEST_BYTES &&
        checksum === expectedChecksum;

      const result = {
        operation: 'read',
        path: BYTE_IO_TEST_PATH,
        jsiAvailable,
        byteLength: bytes.byteLength,
        checksum,
        durationMs,
        verified,
        updatedAt: new Date().toISOString(),
      } satisfies ByteIoTestResult;

      setByteIoResult(result);
      refreshNativeFsDiagnostics();
      setLastAction(
        `${dayjs().format('HH:mm:ss')} Read ${formatBytes(
          result.byteLength,
        )} via JSI bytes`,
      );
      toast.success(verified ? 'Byte file verified' : 'Byte file read');
    } catch (error) {
      console.error('handleReadByteIoFile failed', error);
      toast.error('Failed to read byte file');
      setLastAction(`${dayjs().format('HH:mm:ss')} Byte read failed`);
    } finally {
      setBusyKey(null);
    }
  }, [refreshNativeFsDiagnostics]);

  const handleWriteOwnedStreamFile = useCallback(async () => {
    setBusyKey('owned-stream-write');
    try {
      const jsiAvailable = RNFS.isJSIAvailable();

      if (!jsiAvailable) {
        throw new Error('Rabby native FS JSI binding is unavailable');
      }

      RNFS.clearDiagnostics();

      await RNFS.mkdir(BYTE_IO_TEST_DIR, {
        NSURLIsExcludedFromBackupKey: true,
      });

      const writer = RNFS.createWriteStream(OWNED_STREAM_TEST_PATH, {
        bufferSize: OWNED_STREAM_CHUNK_BYTES,
        bufferCount: OWNED_STREAM_BUFFER_COUNT,
      });
      let offset = 0;
      let checksum = 0;
      let commits = 0;
      let staleCommitRejected = false;

      const writeStartedAt = nowMs();
      while (offset < OWNED_STREAM_TEST_BYTES) {
        const buffer = writer.acquireBuffer();
        const length = Math.min(
          buffer.byteLength,
          OWNED_STREAM_TEST_BYTES - offset,
        );

        for (let index = 0; index < length; index += 1) {
          const absoluteIndex = offset + index;
          const value = getPatternByte(absoluteIndex);
          buffer[index] = value;
          checksum = updateChecksum(checksum, value, absoluteIndex);
        }

        writer.commit(buffer, length);
        commits += 1;

        if (!staleCommitRejected) {
          try {
            writer.commit(buffer, length);
          } catch (_error) {
            staleCommitRejected = true;
          }
        }

        offset += length;
      }
      writer.close();
      const writeDurationMs = nowMs() - writeStartedAt;
      const stats = writer.stats();

      const readStartedAt = nowMs();
      const bytes = RNFS.readFileBytes(OWNED_STREAM_TEST_PATH);
      const readDurationMs = nowMs() - readStartedAt;
      const readChecksum = checksumBytes(bytes);
      const expectedChecksum = normalizeChecksum(checksum);
      const verified =
        bytes.byteLength === OWNED_STREAM_TEST_BYTES &&
        readChecksum === expectedChecksum &&
        stats.bytesWritten === OWNED_STREAM_TEST_BYTES &&
        stats.commits === commits &&
        staleCommitRejected;

      const result = {
        path: OWNED_STREAM_TEST_PATH,
        jsiAvailable,
        totalBytes: OWNED_STREAM_TEST_BYTES,
        chunkBytes: OWNED_STREAM_CHUNK_BYTES,
        bufferCount: OWNED_STREAM_BUFFER_COUNT,
        commits,
        writeDurationMs,
        readDurationMs,
        checksum: readChecksum,
        verified,
        staleCommitRejected,
        stats,
        updatedAt: new Date().toISOString(),
      } satisfies OwnedStreamTestResult;

      setOwnedStreamResult(result);
      refreshNativeFsDiagnostics();
      await loadFileSnapshot();
      setLastAction(
        `${dayjs().format('HH:mm:ss')} Wrote ${formatBytes(
          result.totalBytes,
        )} via owned buffers`,
      );
      toast.success(
        verified
          ? 'Owned buffer stream verified'
          : 'Owned buffer stream finished',
      );
    } catch (error) {
      console.error('handleWriteOwnedStreamFile failed', error);
      toast.error('Failed to run owned buffer stream test');
      setLastAction(`${dayjs().format('HH:mm:ss')} Owned stream test failed`);
    } finally {
      setBusyKey(null);
    }
  }, [loadFileSnapshot, refreshNativeFsDiagnostics]);

  const handleRunAsyncStreamFile = useCallback(async () => {
    setBusyKey('async-stream-run');
    try {
      const jsiAvailable = RNFS.isJSIAvailable();
      const asyncAvailable = RNFS.isNativeAsyncFileIOAvailable();

      if (!jsiAvailable) {
        throw new Error('Rabby native FS JSI binding is unavailable');
      }
      if (!asyncAvailable) {
        throw new Error('Rabby native FS async stream is unavailable');
      }

      RNFS.clearDiagnostics();

      await RNFS.mkdir(BYTE_IO_TEST_DIR, {
        NSURLIsExcludedFromBackupKey: true,
      });

      const writer = RNFS.createAsyncWriteStream(ASYNC_STREAM_TEST_PATH, {
        bufferSize: ASYNC_STREAM_CHUNK_BYTES,
        bufferCount: ASYNC_STREAM_BUFFER_COUNT,
      });

      let offset = 0;
      let checksum = 0;
      let commits = 0;

      const writeStartedAt = nowMs();
      while (offset < ASYNC_STREAM_TEST_BYTES) {
        const buffer = writer.acquireBuffer();
        const length = Math.min(
          buffer.byteLength,
          ASYNC_STREAM_TEST_BYTES - offset,
        );

        for (let index = 0; index < length; index += 1) {
          const absoluteIndex = offset + index;
          const value = getPatternByte(absoluteIndex);
          buffer[index] = value;
          checksum = updateChecksum(checksum, value, absoluteIndex);
        }

        await writer.commit(buffer, length);
        commits += 1;
        offset += length;
      }

      const writeStats = await writer.close();
      const writeDurationMs = nowMs() - writeStartedAt;

      const reader = RNFS.createAsyncReadStream(ASYNC_STREAM_TEST_PATH, {
        bufferSize: ASYNC_STREAM_CHUNK_BYTES,
      });

      let readBytes = 0;
      let reads = 0;
      let readChecksum = 0;
      const readStartedAt = nowMs();

      while (true) {
        const chunk = await reader.readChunk(ASYNC_STREAM_CHUNK_BYTES);
        if (!chunk) {
          break;
        }

        for (let index = 0; index < chunk.byteLength; index += 1) {
          readChecksum = updateChecksum(
            readChecksum,
            chunk[index],
            readBytes + index,
          );
        }

        readBytes += chunk.byteLength;
        reads += 1;
      }

      const readStats = await reader.close();
      const readDurationMs = nowMs() - readStartedAt;
      const expectedChecksum = normalizeChecksum(checksum);
      const actualChecksum = normalizeChecksum(readChecksum);
      const verified =
        readBytes === ASYNC_STREAM_TEST_BYTES &&
        actualChecksum === expectedChecksum &&
        writeStats.bytesWritten === ASYNC_STREAM_TEST_BYTES &&
        writeStats.commits === commits &&
        readStats.bytesRead === ASYNC_STREAM_TEST_BYTES &&
        readStats.reads === reads;

      const result = {
        path: ASYNC_STREAM_TEST_PATH,
        jsiAvailable,
        asyncAvailable,
        totalBytes: ASYNC_STREAM_TEST_BYTES,
        chunkBytes: ASYNC_STREAM_CHUNK_BYTES,
        bufferCount: ASYNC_STREAM_BUFFER_COUNT,
        commits,
        reads,
        writeDurationMs,
        readDurationMs,
        checksum: actualChecksum,
        verified,
        writeStats,
        readStats,
        updatedAt: new Date().toISOString(),
      } satisfies AsyncStreamTestResult;

      setAsyncStreamResult(result);
      refreshNativeFsDiagnostics();
      setLastAction(
        `${dayjs().format(
          'HH:mm:ss',
        )} Ran native async stream for ${formatBytes(result.totalBytes)}`,
      );
      toast.success(
        verified ? 'Async native stream verified' : 'Async stream finished',
      );
    } catch (error) {
      console.error('handleRunAsyncStreamFile failed', error);
      toast.error('Failed to run async native stream test');
      setLastAction(`${dayjs().format('HH:mm:ss')} Async stream test failed`);
    } finally {
      setBusyKey(null);
    }
  }, [refreshNativeFsDiagnostics]);

  const handleRunBatchedAsyncStreamFile = useCallback(async () => {
    setBusyKey('async-stream-batch-run');
    try {
      const jsiAvailable = RNFS.isJSIAvailable();
      const asyncAvailable = RNFS.isNativeAsyncFileIOAvailable();

      if (!jsiAvailable) {
        throw new Error('Rabby native FS JSI binding is unavailable');
      }
      if (!asyncAvailable) {
        throw new Error('Rabby native FS async stream is unavailable');
      }

      RNFS.clearDiagnostics();

      await RNFS.mkdir(BYTE_IO_TEST_DIR, {
        NSURLIsExcludedFromBackupKey: true,
      });

      const writer = RNFS.createAsyncWriteStream(ASYNC_BATCH_STREAM_TEST_PATH, {
        bufferSize: ASYNC_BATCH_STREAM_CHUNK_BYTES,
        bufferCount: ASYNC_BATCH_STREAM_BUFFER_COUNT,
      });

      let offset = 0;
      let checksum = 0;
      let commits = 0;
      let writeBatches = 0;

      const writeStartedAt = nowMs();
      while (offset < ASYNC_BATCH_STREAM_TEST_BYTES) {
        const buffers: Uint8Array[] = [];
        const lengths: number[] = [];

        while (
          buffers.length < ASYNC_BATCH_STREAM_CHUNKS_PER_BATCH &&
          offset < ASYNC_BATCH_STREAM_TEST_BYTES
        ) {
          const buffer = writer.acquireBuffer();
          const length = Math.min(
            buffer.byteLength,
            ASYNC_BATCH_STREAM_TEST_BYTES - offset,
          );

          for (let index = 0; index < length; index += 1) {
            const absoluteIndex = offset + index;
            const value = getPatternByte(absoluteIndex);
            buffer[index] = value;
            checksum = updateChecksum(checksum, value, absoluteIndex);
          }

          buffers.push(buffer);
          lengths.push(length);
          offset += length;
        }

        await writer.commitBatch(buffers, lengths);
        commits += buffers.length;
        writeBatches += 1;
      }

      const writeStats = await writer.close();
      const writeDurationMs = nowMs() - writeStartedAt;

      const reader = RNFS.createAsyncReadStream(ASYNC_BATCH_STREAM_TEST_PATH, {
        bufferSize: ASYNC_BATCH_STREAM_BATCH_BYTES,
      });

      let readBytes = 0;
      let reads = 0;
      let readBatches = 0;
      let readChecksum = 0;
      const readStartedAt = nowMs();

      while (true) {
        const chunk = await reader.readBatch(ASYNC_BATCH_STREAM_BATCH_BYTES);
        if (!chunk) {
          break;
        }

        for (let index = 0; index < chunk.byteLength; index += 1) {
          readChecksum = updateChecksum(
            readChecksum,
            chunk[index],
            readBytes + index,
          );
        }

        readBytes += chunk.byteLength;
        reads += 1;
        readBatches += 1;
      }

      const readStats = await reader.close();
      const readDurationMs = nowMs() - readStartedAt;
      const expectedChecksum = normalizeChecksum(checksum);
      const actualChecksum = normalizeChecksum(readChecksum);
      const verified =
        readBytes === ASYNC_BATCH_STREAM_TEST_BYTES &&
        actualChecksum === expectedChecksum &&
        writeStats.bytesWritten === ASYNC_BATCH_STREAM_TEST_BYTES &&
        writeStats.commits === commits &&
        readStats.bytesRead === ASYNC_BATCH_STREAM_TEST_BYTES &&
        readStats.reads === reads;

      const result = {
        path: ASYNC_BATCH_STREAM_TEST_PATH,
        jsiAvailable,
        asyncAvailable,
        totalBytes: ASYNC_BATCH_STREAM_TEST_BYTES,
        chunkBytes: ASYNC_BATCH_STREAM_CHUNK_BYTES,
        batchBytes: ASYNC_BATCH_STREAM_BATCH_BYTES,
        bufferCount: ASYNC_BATCH_STREAM_BUFFER_COUNT,
        commits,
        reads,
        writeBatches,
        readBatches,
        writeDurationMs,
        readDurationMs,
        checksum: actualChecksum,
        verified,
        writeStats,
        readStats,
        updatedAt: new Date().toISOString(),
      } satisfies BatchedAsyncStreamTestResult;

      setBatchedAsyncStreamResult(result);
      refreshNativeFsDiagnostics();
      setLastAction(
        `${dayjs().format(
          'HH:mm:ss',
        )} Ran batched native async stream for ${formatBytes(
          result.totalBytes,
        )}`,
      );
      toast.success(
        verified
          ? 'Batched async stream verified'
          : 'Batched async stream finished',
      );
    } catch (error) {
      console.error('handleRunBatchedAsyncStreamFile failed', error);
      toast.error('Failed to run batched async stream test');
      setLastAction(
        `${dayjs().format('HH:mm:ss')} Batched async stream test failed`,
      );
    } finally {
      setBusyKey(null);
    }
  }, [refreshNativeFsDiagnostics]);

  const handleRunPersistFileTest = useCallback(async () => {
    setBusyKey('persist-file-run');
    try {
      const jsiAvailable = RNFS.isJSIAvailable();

      if (!jsiAvailable) {
        throw new Error('Rabby native FS JSI binding is unavailable');
      }

      RNFS.clearDiagnostics();

      await RNFS.mkdir(BYTE_IO_TEST_DIR, {
        NSURLIsExcludedFromBackupKey: true,
      });

      const { bytes, checksum } = createByteIoPayload(PERSIST_FILE_TEST_BYTES);
      RNFS.writeFileBytes(PERSIST_FILE_SOURCE_PATH, bytes);

      const copyResult = await RNFS.persistFile(
        PERSIST_FILE_SOURCE_PATH,
        PERSIST_FILE_COPY_PATH,
        {
          mode: 'copy',
          overwrite: true,
          ensureParent: true,
          NSURLIsExcludedFromBackupKey: true,
        },
      );
      const moveResult = await RNFS.persistFile(
        PERSIST_FILE_SOURCE_PATH,
        PERSIST_FILE_MOVE_PATH,
        {
          mode: 'move',
          overwrite: true,
          ensureParent: true,
          NSURLIsExcludedFromBackupKey: true,
        },
      );

      const readStartedAt = nowMs();
      const copyBytes = RNFS.readFileBytes(PERSIST_FILE_COPY_PATH);
      const moveBytes = RNFS.readFileBytes(PERSIST_FILE_MOVE_PATH);
      const readDurationMs = nowMs() - readStartedAt;
      const copyChecksum = checksumBytes(copyBytes);
      const moveChecksum = checksumBytes(moveBytes);
      const sourceRemoved = !RNFS.existsSync(PERSIST_FILE_SOURCE_PATH);
      const verified =
        copyBytes.byteLength === PERSIST_FILE_TEST_BYTES &&
        moveBytes.byteLength === PERSIST_FILE_TEST_BYTES &&
        copyResult.bytesWritten === PERSIST_FILE_TEST_BYTES &&
        moveResult.bytesWritten === PERSIST_FILE_TEST_BYTES &&
        copyChecksum === checksum &&
        moveChecksum === checksum &&
        sourceRemoved;

      const result = {
        sourcePath: PERSIST_FILE_SOURCE_PATH,
        copyTargetPath: PERSIST_FILE_COPY_PATH,
        moveTargetPath: PERSIST_FILE_MOVE_PATH,
        totalBytes: PERSIST_FILE_TEST_BYTES,
        copyBytes: copyResult.bytesWritten,
        moveBytes: moveResult.bytesWritten,
        copyDurationMs: copyResult.durationMs,
        moveDurationMs: moveResult.durationMs,
        readDurationMs,
        checksum: copyChecksum,
        verified,
        sourceRemoved,
        updatedAt: new Date().toISOString(),
      } satisfies PersistFileTestResult;

      setPersistFileResult(result);
      refreshNativeFsDiagnostics();
      await loadFileSnapshot();
      setLastAction(
        `${dayjs().format('HH:mm:ss')} Persisted ${formatBytes(
          result.totalBytes,
        )} by native path copy/move`,
      );
      toast.success(
        verified ? 'Native persist file verified' : 'Persist file finished',
      );
    } catch (error) {
      console.error('handleRunPersistFileTest failed', error);
      toast.error('Failed to run native persist file test');
      setLastAction(`${dayjs().format('HH:mm:ss')} Persist file test failed`);
    } finally {
      setBusyKey(null);
    }
  }, [loadFileSnapshot, refreshNativeFsDiagnostics]);

  const handleClearNativeFsDiagnostics = useCallback(() => {
    try {
      RNFS.clearDiagnostics();
      setNativeFsDiagnostics([]);
      setLastAction(
        `${dayjs().format('HH:mm:ss')} Cleared native FS diagnostics`,
      );
    } catch (error) {
      console.warn('Failed to clear native FS diagnostics', error);
      toast.error('Failed to clear native FS diagnostics');
    }
  }, []);

  const summaryBadges = useMemo(() => {
    if (!capabilitySnapshot) {
      return ['Loading...'];
    }

    return [
      capabilitySnapshot.platform.toUpperCase(),
      `Media: ${formatPermissionState(capabilitySnapshot.visualMedia.access)}`,
      `Files: ${formatPermissionState(capabilitySnapshot.sharedFiles.access)}`,
      `App files: ${fileSnapshot?.files.length || 0}`,
    ];
  }, [capabilitySnapshot, fileSnapshot?.files.length]);

  const renderBadge = useCallback(
    (text: string, key: string) => (
      <View key={key} style={styles.summaryBadge}>
        <Text style={styles.summaryBadgeText}>{text}</Text>
      </View>
    ),
    [styles.summaryBadge, styles.summaryBadgeText],
  );

  const renderStatusRow = useCallback(
    ({
      label,
      value,
      hint,
      displayValue,
    }: {
      label: string;
      value: string;
      hint?: string;
      displayValue?: string;
    }) => {
      const tone = toneForState(value);
      const valueColor =
        tone === 'success'
          ? colors2024['green-default']
          : tone === 'warning'
          ? colors2024['orange-default']
          : tone === 'danger'
          ? colors2024['red-default']
          : colors2024['neutral-title-1'];

      return (
        <View key={`${label}-${value}`} style={styles.statusRow}>
          <View style={styles.statusLabelBlock}>
            <Text style={styles.statusLabel}>{label}</Text>
            {hint ? <Text style={styles.statusHint}>{hint}</Text> : null}
          </View>
          <Text style={[styles.statusValue, { color: valueColor }]}>
            {displayValue || formatPermissionState(value)}
          </Text>
        </View>
      );
    },
    [
      colors2024,
      styles.statusHint,
      styles.statusLabel,
      styles.statusLabelBlock,
      styles.statusRow,
      styles.statusValue,
    ],
  );

  const renderOverview = () => {
    return (
      <>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Manual Trigger</Text>
          <Text style={styles.noteText}>
            These controls remain available for isolating the native permission
            snapshot and sandbox file scan independently.
          </Text>
          <View style={styles.sectionActionsRow}>
            <Button
              title="Load permission snapshot"
              type="primary"
              height={40}
              loading={busyKey === 'refresh-capability'}
              containerStyle={styles.sectionActionButton}
              onPress={handleRefreshCapabilitySnapshot}
            />
            <Button
              title="Scan app files"
              type="warning"
              height={40}
              loading={busyKey === 'refresh-files'}
              containerStyle={styles.sectionActionButton}
              onPress={handleRefreshFileSnapshot}
            />
            <Button
              title="Refresh both"
              type="ghost"
              height={40}
              loading={busyKey === 'refresh'}
              containerStyle={styles.sectionActionButton}
              onPress={() => {
                refreshAll().catch(error => {
                  console.error(error);
                });
              }}
            />
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Current Status</Text>
          <View style={styles.summaryGrid}>
            {summaryBadges.map((item, index) =>
              renderBadge(item, `summary-${index}`),
            )}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Visual Media Permission</Text>
          {capabilitySnapshot ? (
            <>
              {renderStatusRow({
                label: 'Overall access',
                value: capabilitySnapshot.visualMedia.access,
              })}
              {renderStatusRow({
                label: 'Images',
                value: capabilitySnapshot.visualMedia.image,
              })}
              {renderStatusRow({
                label: 'Videos',
                value: capabilitySnapshot.visualMedia.video,
              })}
              {renderStatusRow({
                label: 'Selected-media grant',
                value: capabilitySnapshot.visualMedia.userSelected,
                hint: IS_ANDROID
                  ? 'Android 14+ partial access indicator'
                  : 'iOS limited-library selection indicator',
              })}
            </>
          ) : (
            <Text style={styles.noteText}>
              Permission snapshot has not been loaded yet.
            </Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>General File Access</Text>
          {capabilitySnapshot ? (
            <>
              {renderStatusRow({
                label: 'Shared files model',
                value: capabilitySnapshot.sharedFiles.access,
              })}
              {renderStatusRow({
                label: 'Manage all files',
                value: capabilitySnapshot.sharedFiles.manageAllFiles,
              })}
              {renderStatusRow({
                label: 'App sandbox',
                value: capabilitySnapshot.sharedFiles.appSandboxReadable
                  ? 'granted'
                  : 'denied',
              })}
              <Text style={styles.noteText}>
                {capabilitySnapshot.sharedFiles.note}
              </Text>
            </>
          ) : (
            <Text style={styles.noteText}>
              File-access capability snapshot has not been loaded yet.
            </Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>App-owned File Snapshot</Text>
          {renderStatusRow({
            label: 'Scanned directories',
            value: 'default',
            displayValue: String(fileSnapshot?.scannedDirCount || 0),
          })}
          {renderStatusRow({
            label: 'Indexed files',
            value: 'default',
            displayValue: String(fileSnapshot?.files.length || 0),
          })}
          {renderStatusRow({
            label: 'Scan truncated',
            value: fileSnapshot?.truncated ? 'limited' : 'default',
            displayValue: fileSnapshot?.truncated ? 'Yes' : 'No',
            hint: fileSnapshot?.truncated
              ? `Stopped after ${APP_FILE_SCAN_LIMIT} files`
              : 'Current scan covered the configured limit',
          })}
          {fileSnapshot?.errors.length ? (
            <Text style={styles.noteText}>
              Scan errors: {fileSnapshot.errors.join(' | ')}
            </Text>
          ) : (
            <Text style={styles.noteText}>
              Use the action sheet to open the bottom sheet file browser with a
              keyword search.
            </Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            {IS_ANDROID
              ? 'Android Selected Photos Access'
              : 'iOS Limited Library Access'}
          </Text>
          <Text style={styles.noteText}>
            {IS_ANDROID
              ? 'When the user chooses selected photos/videos instead of full library access, request the media permission again from an explicit in-app action. Android will reopen the system selection UI and let the user add more items.'
              : "When the user chooses limited photo access, the app can still query the currently readable assets with PhotoKit and explicitly reopen Apple's select-more-photos sheet from an in-app action."}
          </Text>
          {capabilitySnapshot ? (
            <>
              {renderStatusRow({
                label: IS_ANDROID
                  ? 'Can reselect now'
                  : 'Can manage selection now',
                value: capabilitySnapshot.visualMedia.canReselect
                  ? 'granted'
                  : 'denied',
                displayValue: capabilitySnapshot.visualMedia.canReselect
                  ? 'Yes'
                  : 'No',
                hint: capabilitySnapshot.visualMedia.canReselect
                  ? IS_ANDROID
                    ? 'Action sheet will reopen the system picker flow'
                    : "Action sheet can open Apple's select-more-photos UI"
                  : IS_ANDROID
                  ? 'Either full access or no selected-media grant yet'
                  : 'Only available after the user chooses limited access',
              })}
              {IS_ANDROID
                ? renderStatusRow({
                    label: 'Android SDK',
                    value: 'default',
                    displayValue: String(capabilitySnapshot.sdkInt || 0),
                  })
                : renderStatusRow({
                    label: 'Automatic prompt',
                    value: 'default',
                    displayValue: 'Disabled',
                    hint: 'This helper opts into explicit in-app limited-library management',
                  })}
            </>
          ) : (
            <Text style={styles.noteText}>
              Limited-library controls are unavailable until the permission
              snapshot is loaded.
            </Text>
          )}
        </View>
      </>
    );
  };

  const renderDebug = () => {
    return (
      <>
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Debug Summary</Text>
          <View style={styles.summaryGrid}>
            {renderBadge(lastAction, 'lastAction')}
            {renderBadge(
              capabilitySnapshot
                ? `OS: ${capabilitySnapshot.osVersion}`
                : 'OS: -',
              'osVersion',
            )}
            {renderBadge(
              fileSnapshot
                ? `Dirs: ${fileSnapshot.scannedDirCount}`
                : 'Dirs: 0',
              'dirCount',
            )}
            {renderBadge(
              fileSnapshot
                ? `Errors: ${fileSnapshot.errors.length}`
                : 'Errors: 0',
              'errors',
            )}
            {renderBadge(
              accessibleImageSnapshot
                ? `Images: ${accessibleImageSnapshot.items.length}`
                : 'Images: 0',
              'accessible-images',
            )}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Accessible Image Test</Text>
          <Text style={styles.noteText}>
            {IS_ANDROID
              ? "Android does not offer a built-in picker that is already scoped to the app's current photo grants. This test queries MediaStore, which only returns images the app can read right now, then opens a bottom sheet so you can pick one."
              : 'On iOS, PhotoKit only returns assets the app can currently read. This test queries that visible subset, opens a bottom sheet so you can pick one, and pairs with the select-more-photos action when the user is in limited access mode.'}
          </Text>
          {renderStatusRow({
            label: 'Loaded candidates',
            value: accessibleImageSnapshot?.items.length
              ? 'granted'
              : 'default',
            displayValue: String(accessibleImageSnapshot?.items.length || 0),
            hint: accessibleImageSnapshot?.truncated
              ? `Truncated to ${accessibleImageSnapshot.limit} newest images`
              : IS_ANDROID
              ? 'Newest readable images from MediaStore'
              : 'Newest readable images from PhotoKit',
          })}
          {renderStatusRow({
            label: 'Selected image',
            value: selectedAccessibleImage ? 'granted' : 'default',
            displayValue: selectedAccessibleImage ? 'Ready' : 'None',
            hint: selectedAccessibleImage
              ? `${selectedAccessibleImage.name} • ${selectedAccessibleImage.dimensionLabel} • ${selectedAccessibleImage.sizeLabel}`
              : 'Open the picker and choose one readable image',
          })}
          <View style={styles.sectionActionsRow}>
            <Button
              title="Browse accessible images"
              type="primary"
              height={40}
              loading={busyKey === 'accessible-images'}
              containerStyle={styles.sectionActionButton}
              onPress={handleBrowseAccessibleImages}
            />
            {canTriggerVisualMediaAccess ? (
              <Button
                title={visualMediaActionTitle}
                type="warning"
                height={40}
                loading={busyKey === 'visual-media'}
                containerStyle={styles.sectionActionButton}
                onPress={handleRequestVisualMediaAccess}
              />
            ) : selectedAccessibleImage ? (
              <Button
                title="Clear preview"
                type="ghost"
                height={40}
                containerStyle={styles.sectionActionButton}
                onPress={handleClearAccessibleImage}
              />
            ) : null}
          </View>
          {selectedAccessibleImage ? (
            <View style={styles.mediaPreviewCard}>
              <Text style={styles.mediaPreviewTitle} numberOfLines={2}>
                {selectedAccessibleImage.name}
              </Text>
              <Text style={styles.mediaPreviewMeta}>
                {selectedAccessibleImage.dimensionLabel} •{' '}
                {selectedAccessibleImage.sizeLabel}
              </Text>
              <Text style={styles.mediaPreviewMeta} numberOfLines={1}>
                {selectedAccessibleImage.mimeType}
              </Text>
              <Text style={styles.mediaPreviewMeta}>
                Added at {selectedAccessibleImage.dateAddedLabel}
              </Text>
              <View style={styles.mediaPreviewSurface}>
                {selectedAccessibleImageSourceUri ? (
                  <Image
                    source={{ uri: selectedAccessibleImageSourceUri }}
                    resizeMode="contain"
                    style={[
                      styles.mediaPreviewImage,
                      selectedAccessibleImagePreviewSize,
                    ]}
                  />
                ) : (
                  <Text style={styles.noteText}>
                    Preview is unavailable for this asset on the current image
                    loader path.
                  </Text>
                )}
              </View>
            </View>
          ) : null}
          {selectedAccessibleImage && canTriggerVisualMediaAccess ? (
            <View style={styles.sectionActionsRow}>
              <Button
                title="Clear preview"
                type="ghost"
                height={40}
                containerStyle={styles.sectionActionButton}
                onPress={handleClearAccessibleImage}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Large File Byte I/O Test</Text>
          <Text style={styles.noteText}>
            This sample uses the Rabby-owned `react-native-fs` JSI byte APIs to
            write and read a {formatBytes(BYTE_IO_TEST_BYTES)} sandbox file. It
            avoids the old base64 string bridge path so large file content does
            not have to be encoded through JS strings.
          </Text>
          {renderStatusRow({
            label: 'JSI binding',
            value: byteIoResult?.jsiAvailable ? 'granted' : 'default',
            displayValue: byteIoResult
              ? byteIoResult.jsiAvailable
                ? 'Available'
                : 'Unavailable'
              : 'Not checked',
          })}
          {renderStatusRow({
            label: 'Payload size',
            value: 'default',
            displayValue: formatBytes(BYTE_IO_TEST_BYTES),
          })}
          {renderStatusRow({
            label: 'Last operation',
            value: byteIoResult ? 'granted' : 'default',
            displayValue: byteIoResult
              ? `${byteIoResult.operation.toUpperCase()} · ${formatDurationMs(
                  byteIoResult.durationMs,
                )}`
              : 'None',
          })}
          {renderStatusRow({
            label: 'Read/write bytes',
            value: byteIoResult?.byteLength ? 'granted' : 'default',
            displayValue: formatBytes(byteIoResult?.byteLength || 0),
          })}
          {renderStatusRow({
            label: 'Checksum',
            value: byteIoResult?.verified ? 'granted' : 'default',
            displayValue: byteIoResult?.checksum || '-',
            hint: byteIoResult
              ? byteIoResult.verified
                ? 'Readback matched the deterministic payload'
                : 'Write completed or readback has not matched the expected payload yet'
              : 'Write first, then read to verify',
          })}
          <Text style={styles.noteText} selectable>
            {BYTE_IO_TEST_PATH}
          </Text>
          <View style={styles.sectionActionsRow}>
            <Button
              title={
                busyKey === 'byte-write'
                  ? 'Writing large file...'
                  : 'Write Large File'
              }
              type="primary"
              height={40}
              loading={busyKey === 'byte-write'}
              showTextOnLoading
              containerStyle={styles.sectionActionButton}
              onPress={handleWriteByteIoFile}
            />
            <Button
              title={
                busyKey === 'byte-read'
                  ? 'Reading large file...'
                  : 'Read Large File'
              }
              type="warning"
              height={40}
              loading={busyKey === 'byte-read'}
              showTextOnLoading
              containerStyle={styles.sectionActionButton}
              onPress={handleReadByteIoFile}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Owned Buffer Stream Test</Text>
          <Text style={styles.noteText}>
            This sample validates the stable native-owned write stream API. JS
            acquires a native buffer, fills it, commits it to the writer, and
            the native state machine rejects a stale commit after the buffer is
            released.
          </Text>
          {renderStatusRow({
            label: 'Native buffer',
            value: ownedStreamResult?.verified ? 'granted' : 'default',
            displayValue: `${formatBytes(
              OWNED_STREAM_CHUNK_BYTES,
            )} x ${OWNED_STREAM_BUFFER_COUNT}`,
          })}
          {renderStatusRow({
            label: 'Total size',
            value: 'default',
            displayValue: formatBytes(OWNED_STREAM_TEST_BYTES),
          })}
          {renderStatusRow({
            label: 'Write result',
            value: ownedStreamResult?.verified ? 'granted' : 'default',
            displayValue: ownedStreamResult
              ? `${ownedStreamResult.commits} commits · ${formatDurationMs(
                  ownedStreamResult.writeDurationMs,
                )}`
              : 'None',
          })}
          {renderStatusRow({
            label: 'Readback',
            value: ownedStreamResult?.verified ? 'granted' : 'default',
            displayValue: ownedStreamResult
              ? `${formatBytes(
                  ownedStreamResult.totalBytes,
                )} · ${formatDurationMs(ownedStreamResult.readDurationMs)}`
              : 'Not checked',
          })}
          {renderStatusRow({
            label: 'Ownership guard',
            value: ownedStreamResult?.staleCommitRejected
              ? 'granted'
              : 'default',
            displayValue: ownedStreamResult?.staleCommitRejected
              ? 'Stale commit rejected'
              : 'Not checked',
            hint: 'This confirms a committed lease cannot be committed again.',
          })}
          {renderStatusRow({
            label: 'Writer stats',
            value: ownedStreamResult?.verified ? 'granted' : 'default',
            displayValue: ownedStreamResult
              ? `${formatBytes(ownedStreamResult.stats.bytesWritten)} · ${
                  ownedStreamResult.stats.freeBuffers
                }/${ownedStreamResult.stats.bufferCount} free · closed=${
                  ownedStreamResult.stats.closed ? 'yes' : 'no'
                }`
              : '-',
          })}
          {renderStatusRow({
            label: 'Checksum',
            value: ownedStreamResult?.verified ? 'granted' : 'default',
            displayValue: ownedStreamResult?.checksum || '-',
          })}
          <Text style={styles.noteText} selectable>
            {OWNED_STREAM_TEST_PATH}
          </Text>
          <View style={styles.sectionActionsRow}>
            <Button
              title={
                busyKey === 'owned-stream-write'
                  ? 'Writing owned stream...'
                  : 'Run Owned Stream Test'
              }
              type="primary"
              height={40}
              loading={busyKey === 'owned-stream-write'}
              showTextOnLoading
              containerStyle={styles.singleActionButton}
              onPress={handleWriteOwnedStreamFile}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Native Persist File Test</Text>
          <Text style={styles.noteText}>
            This sample validates path-only native file persistence. JS creates
            one source file, then native code copies and moves it without
            reading file content back through JS strings.
          </Text>
          {renderStatusRow({
            label: 'Total size',
            value: 'default',
            displayValue: formatBytes(PERSIST_FILE_TEST_BYTES),
          })}
          {renderStatusRow({
            label: 'Copy result',
            value: persistFileResult?.verified ? 'granted' : 'default',
            displayValue: persistFileResult
              ? `${formatBytes(
                  persistFileResult.copyBytes,
                )} · ${formatDurationMs(persistFileResult.copyDurationMs)}`
              : 'None',
          })}
          {renderStatusRow({
            label: 'Move result',
            value: persistFileResult?.verified ? 'granted' : 'default',
            displayValue: persistFileResult
              ? `${formatBytes(
                  persistFileResult.moveBytes,
                )} · ${formatDurationMs(persistFileResult.moveDurationMs)}`
              : 'None',
          })}
          {renderStatusRow({
            label: 'Readback',
            value: persistFileResult?.verified ? 'granted' : 'default',
            displayValue: persistFileResult
              ? `${formatDurationMs(
                  persistFileResult.readDurationMs,
                )} · source removed=${
                  persistFileResult.sourceRemoved ? 'yes' : 'no'
                }`
              : 'Not checked',
          })}
          {renderStatusRow({
            label: 'Checksum',
            value: persistFileResult?.verified ? 'granted' : 'default',
            displayValue: persistFileResult?.checksum || '-',
          })}
          <Text style={styles.noteText} selectable>
            {PERSIST_FILE_COPY_PATH}
          </Text>
          <Text style={styles.noteText} selectable>
            {PERSIST_FILE_MOVE_PATH}
          </Text>
          <View style={styles.sectionActionsRow}>
            <Button
              title={
                busyKey === 'persist-file-run'
                  ? 'Persisting file...'
                  : 'Run Persist File'
              }
              type="primary"
              height={40}
              loading={busyKey === 'persist-file-run'}
              showTextOnLoading
              containerStyle={styles.singleActionButton}
              onPress={handleRunPersistFileTest}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Async Native Stream Test</Text>
          <Text style={styles.noteText}>
            This sample uses native-owned buffers for writes and a native worker
            for disk I/O. The JS side awaits Promise completion while the file
            read/write work runs off the JS thread.
          </Text>
          {renderStatusRow({
            label: 'Async worker',
            value: asyncStreamResult?.asyncAvailable ? 'granted' : 'default',
            displayValue: asyncStreamResult
              ? asyncStreamResult.asyncAvailable
                ? 'Available'
                : 'Unavailable'
              : RNFS.isNativeAsyncFileIOAvailable()
              ? 'Available'
              : 'Not checked',
          })}
          {renderStatusRow({
            label: 'Native buffer',
            value: asyncStreamResult?.verified ? 'granted' : 'default',
            displayValue: `${formatBytes(
              ASYNC_STREAM_CHUNK_BYTES,
            )} x ${ASYNC_STREAM_BUFFER_COUNT}`,
          })}
          {renderStatusRow({
            label: 'Total size',
            value: 'default',
            displayValue: formatBytes(ASYNC_STREAM_TEST_BYTES),
          })}
          {renderStatusRow({
            label: 'Write result',
            value: asyncStreamResult?.verified ? 'granted' : 'default',
            displayValue: asyncStreamResult
              ? `${asyncStreamResult.commits} commits · ${formatDurationMs(
                  asyncStreamResult.writeDurationMs,
                )}`
              : 'None',
          })}
          {renderStatusRow({
            label: 'Read result',
            value: asyncStreamResult?.verified ? 'granted' : 'default',
            displayValue: asyncStreamResult
              ? `${asyncStreamResult.reads} reads · ${formatDurationMs(
                  asyncStreamResult.readDurationMs,
                )}`
              : 'Not checked',
          })}
          {renderStatusRow({
            label: 'Worker stats',
            value: asyncStreamResult?.verified ? 'granted' : 'default',
            displayValue: asyncStreamResult
              ? `${formatBytes(
                  asyncStreamResult.writeStats.bytesWritten,
                )} written · ${formatBytes(
                  asyncStreamResult.readStats.bytesRead,
                )} read · pending=${
                  asyncStreamResult.writeStats.pendingBuffers
                }`
              : '-',
          })}
          {renderStatusRow({
            label: 'Checksum',
            value: asyncStreamResult?.verified ? 'granted' : 'default',
            displayValue: asyncStreamResult?.checksum || '-',
          })}
          <Text style={styles.noteText} selectable>
            {ASYNC_STREAM_TEST_PATH}
          </Text>
          <View style={styles.sectionActionsRow}>
            <Button
              title={
                busyKey === 'async-stream-run'
                  ? 'Running Async...'
                  : 'Run Async Stream'
              }
              type="primary"
              height={40}
              loading={busyKey === 'async-stream-run'}
              showTextOnLoading
              containerStyle={styles.singleActionButton}
              onPress={handleRunAsyncStreamFile}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Batched Async Stream Test</Text>
          <Text style={styles.noteText}>
            This sample keeps the same 256 KB native-owned buffers as the
            baseline async stream test, but groups 16 chunks into each async
            write and read batch so JS/native Promise round trips drop from 64
            to 4 for the same 16 MB payload.
          </Text>
          {renderStatusRow({
            label: 'Async worker',
            value: batchedAsyncStreamResult?.asyncAvailable
              ? 'granted'
              : 'default',
            displayValue: batchedAsyncStreamResult
              ? batchedAsyncStreamResult.asyncAvailable
                ? 'Available'
                : 'Unavailable'
              : RNFS.isNativeAsyncFileIOAvailable()
              ? 'Available'
              : 'Not checked',
          })}
          {renderStatusRow({
            label: 'Batch shape',
            value: batchedAsyncStreamResult?.verified ? 'granted' : 'default',
            displayValue: `${formatBytes(
              ASYNC_BATCH_STREAM_CHUNK_BYTES,
            )} x ${ASYNC_BATCH_STREAM_CHUNKS_PER_BATCH}`,
          })}
          {renderStatusRow({
            label: 'Total size',
            value: 'default',
            displayValue: formatBytes(ASYNC_BATCH_STREAM_TEST_BYTES),
          })}
          {renderStatusRow({
            label: 'Write result',
            value: batchedAsyncStreamResult?.verified ? 'granted' : 'default',
            displayValue: batchedAsyncStreamResult
              ? `${batchedAsyncStreamResult.writeBatches} batches / ${
                  batchedAsyncStreamResult.commits
                } chunks · ${formatDurationMs(
                  batchedAsyncStreamResult.writeDurationMs,
                )}`
              : 'None',
          })}
          {renderStatusRow({
            label: 'Read result',
            value: batchedAsyncStreamResult?.verified ? 'granted' : 'default',
            displayValue: batchedAsyncStreamResult
              ? `${
                  batchedAsyncStreamResult.readBatches
                } batches · ${formatDurationMs(
                  batchedAsyncStreamResult.readDurationMs,
                )}`
              : 'Not checked',
          })}
          {renderStatusRow({
            label: 'Worker stats',
            value: batchedAsyncStreamResult?.verified ? 'granted' : 'default',
            displayValue: batchedAsyncStreamResult
              ? `${formatBytes(
                  batchedAsyncStreamResult.writeStats.bytesWritten,
                )} written · ${formatBytes(
                  batchedAsyncStreamResult.readStats.bytesRead,
                )} read · pending=${
                  batchedAsyncStreamResult.writeStats.pendingBuffers
                }`
              : '-',
          })}
          {renderStatusRow({
            label: 'Checksum',
            value: batchedAsyncStreamResult?.verified ? 'granted' : 'default',
            displayValue: batchedAsyncStreamResult?.checksum || '-',
          })}
          <Text style={styles.noteText} selectable>
            {ASYNC_BATCH_STREAM_TEST_PATH}
          </Text>
          <View style={styles.sectionActionsRow}>
            <Button
              title={
                busyKey === 'async-stream-batch-run'
                  ? 'Running Batch...'
                  : 'Run Batched Stream'
              }
              type="primary"
              height={40}
              loading={busyKey === 'async-stream-batch-run'}
              showTextOnLoading
              containerStyle={styles.singleActionButton}
              onPress={handleRunBatchedAsyncStreamFile}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Native FS Diagnostics</Text>
          <Text style={styles.noteText}>
            Native-owned in-memory ring buffer for file I/O probes. It records
            byte count, native duration, thread id, operation, and path tail
            without writing diagnostic files from JS.
          </Text>
          {renderStatusRow({
            label: 'Event count',
            value: nativeFsDiagnostics.length ? 'granted' : 'default',
            displayValue: `${nativeFsDiagnostics.length}`,
          })}
          {renderStatusRow({
            label: 'Latest event',
            value: nativeFsDiagnostics.length ? 'granted' : 'default',
            displayValue: nativeFsDiagnostics.length
              ? formatNativeFsDiagnosticEvent(
                  nativeFsDiagnostics[nativeFsDiagnostics.length - 1],
                )
              : 'None',
          })}
          {nativeFsDiagnostics.slice(-5).map(event => (
            <Text
              key={event.id}
              style={styles.noteText}
              numberOfLines={3}
              selectable>
              {formatNativeFsDiagnosticEvent(event)}
            </Text>
          ))}
          <View style={styles.sectionActionsRow}>
            <Button
              title="Clear Native FS Diagnostics"
              type="ghost"
              height={40}
              containerStyle={styles.singleActionButton}
              onPress={handleClearNativeFsDiagnostics}
            />
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Button
            title="Copy JSON"
            type="ghost"
            height={40}
            containerStyle={styles.singleActionButton}
            onPress={handleCopyDebugPayload}
          />
        </View>

        <View style={[styles.jsonCard, { maxHeight: panelMaxHeight }]}>
          <Text style={styles.jsonTitle}>Capability JSON</Text>
          <ScrollView
            nestedScrollEnabled
            bounces={false}
            style={styles.jsonScrollArea}
            contentContainerStyle={styles.jsonScrollContent}>
            <Text style={styles.jsonBody} selectable>
              {debugPayload}
            </Text>
          </ScrollView>
        </View>
      </>
    );
  };

  return (
    <>
      <FooterButtonScreenContainer
        as="View"
        style={styles.screen}
        buttonProps={{
          title:
            busyKey === 'refresh'
              ? 'Refreshing both...'
              : busyKey === 'refresh-capability'
              ? 'Loading permission...'
              : busyKey === 'refresh-files'
              ? 'Scanning files...'
              : busyKey === 'visual-media'
              ? 'Updating...'
              : busyKey === 'accessible-images'
              ? 'Loading images...'
              : busyKey === 'byte-write'
              ? 'Writing large file...'
              : busyKey === 'byte-read'
              ? 'Reading large file...'
              : busyKey === 'owned-stream-write'
              ? 'Writing owned stream...'
              : busyKey === 'persist-file-run'
              ? 'Persisting file...'
              : busyKey === 'async-stream-run'
              ? 'Running async stream...'
              : 'Actions',
          onPress: () => {
            setActionSheetVisible(true);
          },
          disabled: !!busyKey,
        }}
        footerContainerStyle={styles.footerContainer}>
        <ScrollView
          nestedScrollEnabled
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <Text style={styles.pageTitle}>File Capability</Text>
          <Text style={styles.pageDesc}>
            Cross-platform snapshot of visual-media permission, shared-file
            access model, and app-owned sandbox files.
          </Text>

          <PillsSwitch
            value={tabKey}
            options={TAB_OPTIONS}
            onTabChange={key => {
              setTabKey(key);
            }}
            containerStyle={styles.tabSwitcher}
            itemStyle={styles.tabItem}
          />

          {tabKey === 'overview' ? renderOverview() : renderDebug()}
        </ScrollView>
      </FooterButtonScreenContainer>

      <AppBottomSheetModal
        ref={actionSheetRef}
        index={0}
        snapPoints={actionSheetSnapPoints}
        onDismiss={() => {
          setActionSheetVisible(false);
        }}>
        <View style={styles.sheetContainer}>
          <AppBottomSheetModalTitle title="File Actions" />
          <Button
            title="Load permission snapshot"
            type="primary"
            height={44}
            containerStyle={styles.sheetButton}
            loading={busyKey === 'refresh-capability'}
            onPress={handleRefreshCapabilitySnapshot}
          />
          <Button
            title="Scan app files"
            type="warning"
            height={44}
            containerStyle={styles.sheetButton}
            loading={busyKey === 'refresh-files'}
            onPress={handleRefreshFileSnapshot}
          />
          <Button
            title="Refresh both"
            type="ghost"
            height={44}
            containerStyle={styles.sheetButton}
            loading={busyKey === 'refresh'}
            onPress={() => {
              refreshAll().catch(error => {
                console.error(error);
              });
            }}
          />
          <Button
            title="Show app file list"
            type="ghost"
            height={44}
            containerStyle={styles.sheetButton}
            onPress={handleOpenFileSheet}
          />
          {canTriggerVisualMediaAccess ? (
            <Button
              title={visualMediaActionTitle}
              type="warning"
              height={44}
              containerStyle={styles.sheetButton}
              loading={busyKey === 'visual-media'}
              onPress={handleRequestVisualMediaAccess}
            />
          ) : null}
          <Button
            title="Open system settings"
            type="ghost"
            height={44}
            containerStyle={styles.sheetButton}
            onPress={handleOpenSettings}
          />
        </View>
      </AppBottomSheetModal>

      <AppBottomSheetModal
        ref={fileSheetRef}
        index={0}
        snapPoints={fileSheetSnapPoints}
        onDismiss={() => {
          setFileSheetVisible(false);
        }}>
        <View style={styles.fileSheetContainer}>
          <AppBottomSheetModalTitle title="App-owned Files" />
          <View style={styles.summaryGrid}>
            {renderBadge(
              `Matches: ${filteredFiles.length}`,
              'file-match-count',
            )}
            {renderBadge(
              `Showing: ${visibleFiles.length}`,
              'file-visible-count',
            )}
            {renderBadge(
              `Dirs: ${fileSnapshot?.scannedDirCount || 0}`,
              'file-dir-count',
            )}
          </View>
          <NextSearchBar
            as="BottomSheetTextInput"
            value={fileKeyword}
            onChangeText={setFileKeyword}
            placeholder="Search name or path"
            noCancel
            style={styles.fileSearchBar}
          />
          {filteredFiles.length ? (
            <BottomSheetFlatList
              data={visibleFiles}
              keyExtractor={item => item.path}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.fileListContent}
              ItemSeparatorComponent={FileSeparator}
              renderItem={({ item }) => (
                <View style={styles.fileCard}>
                  <View style={styles.fileCardHeader}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.fileScope}>{item.scopeLabel}</Text>
                  </View>
                  <Text style={styles.filePath} numberOfLines={2}>
                    {item.relativePath}
                  </Text>
                  <View style={styles.fileMetaRow}>
                    <Text style={styles.fileMetaText}>{item.sizeLabel}</Text>
                    <Text style={styles.fileMetaText}>
                      {item.modifiedAtLabel}
                    </Text>
                  </View>
                </View>
              )}
              ListFooterComponent={
                filteredFiles.length > visibleFileCount ? (
                  <Button
                    title={`Load ${Math.min(
                      FILE_SHEET_PAGE_SIZE,
                      filteredFiles.length - visibleFileCount,
                    )} more`}
                    type="ghost"
                    height={40}
                    containerStyle={styles.loadMoreButton}
                    onPress={() => {
                      setVisibleFileCount(
                        value => value + FILE_SHEET_PAGE_SIZE,
                      );
                    }}
                  />
                ) : (
                  <View style={styles.fileSheetFooterGap} />
                )
              }
            />
          ) : (
            <BottomSheetScrollView
              contentContainerStyle={styles.fileEmptyContainer}>
              <Text style={styles.emptyTitle}>No files matched</Text>
              <Text style={styles.emptyDesc}>
                Try a different keyword or refresh the sandbox snapshot.
              </Text>
            </BottomSheetScrollView>
          )}
        </View>
      </AppBottomSheetModal>

      <AppBottomSheetModal
        ref={accessibleImageSheetRef}
        index={0}
        snapPoints={accessibleImageSheetSnapPoints}
        onDismiss={() => {
          setAccessibleImageSheetVisible(false);
        }}>
        <View style={styles.mediaSheetContainer}>
          <AppBottomSheetModalTitle title="Accessible Images" />
          <View style={styles.summaryGrid}>
            {renderBadge(
              `Matches: ${filteredAccessibleImages.length}`,
              'accessible-image-match-count',
            )}
            {renderBadge(
              `Loaded: ${accessibleImageSnapshot?.items.length || 0}`,
              'accessible-image-loaded-count',
            )}
            {renderBadge(
              accessibleImageSnapshot?.truncated
                ? `Limit: ${accessibleImageSnapshot.limit}`
                : 'Newest first',
              'accessible-image-limit',
            )}
          </View>
          <NextSearchBar
            as="BottomSheetTextInput"
            value={accessibleImageKeyword}
            onChangeText={setAccessibleImageKeyword}
            placeholder="Search name or mime type"
            noCancel
            style={styles.mediaSearchBar}
          />
          {filteredAccessibleImages.length ? (
            <BottomSheetFlatList
              data={filteredAccessibleImages}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.mediaListContent}
              ItemSeparatorComponent={FileSeparator}
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.mediaListItem}
                  onPress={() => {
                    handleSelectAccessibleImage(item);
                  }}>
                  {resolveRenderableImageUri(item) ? (
                    <Image
                      source={{ uri: resolveRenderableImageUri(item)! }}
                      resizeMode="cover"
                      style={styles.mediaListThumb}
                    />
                  ) : (
                    <View style={styles.mediaListThumbPlaceholder}>
                      <Text style={styles.mediaListThumbPlaceholderText}>
                        IMG
                      </Text>
                    </View>
                  )}
                  <View style={styles.mediaListMeta}>
                    <Text style={styles.mediaListName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.mediaListInfo} numberOfLines={1}>
                      {item.dimensionLabel} • {item.sizeLabel}
                    </Text>
                    <Text style={styles.mediaListInfo} numberOfLines={1}>
                      {item.mimeType}
                    </Text>
                    <Text style={styles.mediaListInfo} numberOfLines={1}>
                      {item.dateAddedLabel}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListFooterComponent={<View style={styles.fileSheetFooterGap} />}
            />
          ) : (
            <BottomSheetScrollView
              contentContainerStyle={styles.fileEmptyContainer}>
              <Text style={styles.emptyTitle}>No accessible images</Text>
              <Text style={styles.emptyDesc}>
                Give the app photo access first, or use the selection-management
                action above.
              </Text>
            </BottomSheetScrollView>
          )}
        </View>
      </AppBottomSheetModal>
    </>
  );
}

const getStyles = createGetStyles2024(ctx =>
  StyleSheet.create({
    screen: {
      backgroundColor: ctx.colors2024['neutral-bg-1'],
    },
    footerContainer: {
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      paddingTop: 12,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 32,
      gap: 16,
    },
    pageTitle: {
      fontSize: 34,
      lineHeight: 40,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
    },
    pageDesc: {
      fontSize: 15,
      lineHeight: 22,
      color: ctx.colors2024['neutral-secondary'],
      marginTop: 6,
    },
    tabSwitcher: {
      marginTop: 10,
      alignSelf: 'flex-start',
    },
    tabItem: {
      minWidth: 104,
    },
    summaryCard: {
      borderRadius: 20,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      padding: 16,
      gap: 14,
    },
    sectionCard: {
      borderRadius: 20,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      padding: 16,
      gap: 12,
    },
    sectionTitle: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    summaryBadge: {
      borderRadius: 999,
      backgroundColor: ctx.colors2024['neutral-bg-5'],
      paddingHorizontal: 12,
      paddingVertical: 8,
      maxWidth: '100%',
    },
    summaryBadgeText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
      color: ctx.colors2024['neutral-title-1'],
    },
    statusRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      borderRadius: 14,
      backgroundColor: ctx.colors2024['neutral-bg-5'],
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    statusLabelBlock: {
      width: 128,
      flexShrink: 0,
      gap: 4,
    },
    statusLabel: {
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '600',
      color: ctx.colors2024['neutral-title-1'],
    },
    statusHint: {
      fontSize: 12,
      lineHeight: 16,
      color: ctx.colors2024['neutral-secondary'],
    },
    statusValue: {
      flex: 1,
      minWidth: 132,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      textAlign: 'right',
      flexShrink: 1,
    },
    noteText: {
      fontSize: 13,
      lineHeight: 19,
      color: ctx.colors2024['neutral-secondary'],
    },
    emptyCard: {
      borderRadius: 20,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      padding: 20,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
    },
    emptyDesc: {
      fontSize: 14,
      lineHeight: 20,
      color: ctx.colors2024['neutral-secondary'],
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    sectionActionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      alignItems: 'center',
    },
    singleActionButton: {
      width: 160,
    },
    sectionActionButton: {
      minWidth: 168,
    },
    jsonCard: {
      borderRadius: 20,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      padding: 16,
      gap: 12,
    },
    jsonTitle: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
    },
    jsonScrollArea: {
      maxHeight: '100%',
    },
    jsonScrollContent: {
      paddingBottom: 12,
    },
    jsonBody: {
      fontSize: 12,
      lineHeight: 18,
      color: ctx.colors2024['neutral-title-1'],
      fontFamily: 'Menlo',
    },
    sheetContainer: {
      paddingHorizontal: 20,
      paddingBottom: 24,
      gap: 12,
    },
    sheetButton: {
      width: '100%',
    },
    fileSheetContainer: {
      flex: 1,
      paddingHorizontal: 20,
      paddingBottom: 16,
      gap: 12,
    },
    mediaSheetContainer: {
      flex: 1,
      paddingHorizontal: 20,
      paddingBottom: 16,
      gap: 12,
    },
    fileSearchBar: {
      marginTop: 4,
    },
    mediaSearchBar: {
      marginTop: 4,
    },
    fileListContent: {
      paddingTop: 4,
      paddingBottom: 24,
    },
    mediaListContent: {
      paddingTop: 4,
      paddingBottom: 24,
    },
    fileListGap: {
      height: 10,
    },
    fileCard: {
      borderRadius: 16,
      backgroundColor: ctx.colors2024['neutral-bg-5'],
      padding: 14,
      gap: 8,
    },
    fileCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    fileName: {
      flex: 1,
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
    },
    fileScope: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
      color: ctx.colors2024['neutral-secondary'],
    },
    filePath: {
      fontSize: 13,
      lineHeight: 18,
      color: ctx.colors2024['neutral-secondary'],
    },
    fileMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    fileMetaText: {
      fontSize: 12,
      lineHeight: 16,
      color: ctx.colors2024['neutral-secondary'],
    },
    mediaListItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      backgroundColor: ctx.colors2024['neutral-bg-5'],
      padding: 12,
    },
    mediaListThumb: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: ctx.colors2024['neutral-bg-4'],
    },
    mediaListThumbPlaceholder: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: ctx.colors2024['neutral-bg-4'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    mediaListThumbPlaceholderText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      color: ctx.colors2024['neutral-secondary'],
    },
    mediaListMeta: {
      flex: 1,
      gap: 3,
    },
    mediaListName: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
    },
    mediaListInfo: {
      fontSize: 12,
      lineHeight: 16,
      color: ctx.colors2024['neutral-secondary'],
    },
    mediaPreviewCard: {
      marginTop: 2,
      borderRadius: 18,
      backgroundColor: ctx.colors2024['neutral-bg-5'],
      padding: 14,
      gap: 8,
    },
    mediaPreviewTitle: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
    },
    mediaPreviewMeta: {
      fontSize: 12,
      lineHeight: 16,
      color: ctx.colors2024['neutral-secondary'],
    },
    mediaPreviewSurface: {
      marginTop: 4,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      padding: 10,
      overflow: 'hidden',
    },
    mediaPreviewImage: {
      borderRadius: 12,
      backgroundColor: ctx.colors2024['neutral-bg-4'],
    },
    loadMoreButton: {
      marginTop: 12,
      marginBottom: 12,
    },
    fileSheetFooterGap: {
      height: 20,
    },
    fileEmptyContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 40,
    },
  }),
);

export default DevCapabilityFile;
