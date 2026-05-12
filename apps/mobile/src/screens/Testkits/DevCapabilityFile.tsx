import Clipboard from '@react-native-clipboard/clipboard';
import {
  BottomSheetFlatList,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useFocusEffect } from '@react-navigation/native';
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
import RNFS from 'react-native-fs';

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

const APP_FILE_SCAN_LIMIT = 300;
const APP_FILE_SCAN_DEPTH = 4;
const FILE_SHEET_PAGE_SIZE = 10;
const ACCESSIBLE_IMAGE_QUERY_LIMIT = IS_IOS ? 20 : 60;

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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });
  const [tabKey, setTabKey] = useState<TabKey>('overview');
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
        },
        null,
        2,
      ),
    [
      accessibleImageSnapshot,
      capabilitySnapshot,
      fileSnapshot,
      lastAction,
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
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderRadius: 14,
      backgroundColor: ctx.colors2024['neutral-bg-5'],
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    statusLabelBlock: {
      flex: 1,
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
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      textAlign: 'right',
      flexShrink: 0,
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
