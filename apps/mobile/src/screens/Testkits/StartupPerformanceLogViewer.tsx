import dayjs from 'dayjs';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { toast } from '@/components2024/Toast';
import { useTheme2024 } from '@/hooks/theme';
import {
  getStartupPerformanceLogSummary,
  STARTUP_PERFORMANCE_LOG_ROOT_PATH,
  type StartupPerformanceLogSummary,
} from '@/startup/performance/fileStore';
import { prepareStartupPerformanceLogsForSharing } from '@/startup/performance/persistence';
import { getStartupPerformanceRecorderSnapshot } from '@/startup/performance/recorder';
import { shareLocalFile } from '@/utils/shareLocalFile';
import { createGetStyles2024 } from '@/utils/styles';

type PageSnapshot = {
  storage: StartupPerformanceLogSummary;
  recorder: ReturnType<typeof getStartupPerformanceRecorderSnapshot>;
  refreshedAt: string;
};

function formatBytes(bytes: number) {
  if (!bytes) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${
    units[unitIndex]
  }`;
}

function StatusRow({ label, value }: { label: string; value: string }) {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text
        style={styles.statusValue}
        selectable
        numberOfLines={2}
        ellipsizeMode="middle">
        {value}
      </Text>
    </View>
  );
}

export default function StartupPerformanceLogViewer(): JSX.Element {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const [snapshot, setSnapshot] = useState<PageSnapshot | null>(null);
  const [busyKey, setBusyKey] = useState<'refresh' | 'share' | null>(null);

  const refreshSnapshot = useCallback(async () => {
    const storage = await getStartupPerformanceLogSummary();
    setSnapshot({
      storage,
      recorder: getStartupPerformanceRecorderSnapshot(),
      refreshedAt: new Date().toISOString(),
    });
  }, []);

  useEffect(() => {
    refreshSnapshot().catch(error => {
      toast.error(error instanceof Error ? error.message : String(error));
    });
  }, [refreshSnapshot]);

  const handleRefresh = useCallback(async () => {
    if (busyKey) {
      return;
    }

    setBusyKey('refresh');
    try {
      await refreshSnapshot();
      toast.success('Startup performance logs refreshed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyKey(null);
    }
  }, [busyKey, refreshSnapshot]);

  const handleShare = useCallback(async () => {
    if (busyKey) {
      return;
    }

    setBusyKey('share');
    try {
      const artifact = await prepareStartupPerformanceLogsForSharing();
      if (!artifact) {
        toast.info('No startup performance logs available');
        return;
      }

      const result = await shareLocalFile({
        path: artifact.path,
        name: artifact.name,
        mimeType: artifact.mimeType,
        title: 'Share startup performance logs',
        subject: artifact.name,
        message: `Rabby startup performance logs (${artifact.fileCount} files)`,
        cleanupPaths: artifact.cleanupPaths,
      });
      if (!result.dismissed) {
        toast.success(`${artifact.fileCount} log files ready to share`);
      }
      await refreshSnapshot();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyKey(null);
    }
  }, [busyKey, refreshSnapshot]);

  const storage = snapshot?.storage;
  const recorder = snapshot?.recorder;

  return (
    <NormalScreenContainer noHeader style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Real Device Test Lab</Text>
          <Text style={styles.title}>Startup Performance Logs</Text>
          <Text style={styles.description}>
            Startup events stay in memory on the critical path, then persist to
            a dedicated rotated log through native file I/O after Home is idle
            or immediately before sharing.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current State</Text>
          <StatusRow
            label="Recorder"
            value={
              recorder
                ? `${recorder.stopped ? 'stopped' : 'recording'} · ${
                    recorder.pendingEventCount
                  } pending · ${recorder.droppedEventCount} dropped`
                : 'loading'
            }
          />
          <StatusRow
            label="Stored logs"
            value={
              storage
                ? `${storage.fileCount} files · ${formatBytes(
                    storage.totalBytes,
                  )}`
                : 'loading'
            }
          />
          <StatusRow
            label="Native I/O"
            value={
              storage
                ? `stream=${
                    storage.nativeAsyncFileIOAvailable ? 'yes' : 'no'
                  } · zip=${storage.nativeZipArchiveAvailable ? 'yes' : 'no'}`
                : 'loading'
            }
          />
          <StatusRow
            label="Latest"
            value={
              storage?.latestFileName
                ? `${storage.latestFileName} · ${formatBytes(
                    storage.latestFileSize,
                  )} · ${dayjs(storage.latestFileModifiedAt).format(
                    'YYYY-MM-DD HH:mm:ss',
                  )}`
                : 'none'
            }
          />
          <StatusRow label="Root" value={STARTUP_PERFORMANCE_LOG_ROOT_PATH} />
          <StatusRow
            label="Refreshed"
            value={
              snapshot
                ? dayjs(snapshot.refreshedAt).format('YYYY-MM-DD HH:mm:ss')
                : 'loading'
            }
          />
        </View>

        <View style={styles.actions}>
          <Button
            title="Share Startup Performance Logs"
            type="primary"
            height={48}
            disabled={!!busyKey}
            loading={busyKey === 'share'}
            showTextOnLoading
            onPress={handleShare}
          />
          <Button
            title="Refresh"
            type="ghost"
            height={48}
            disabled={!!busyKey}
            loading={busyKey === 'refresh'}
            showTextOnLoading
            onPress={handleRefresh}
          />
        </View>
      </ScrollView>
    </NormalScreenContainer>
  );
}

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  hero: {
    paddingVertical: 8,
    gap: 8,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    color: ctx.colors2024['brand-default'],
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: ctx.colors2024['neutral-title-1'],
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: ctx.colors2024['neutral-body'],
  },
  section: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: ctx.colors2024['neutral-card-1'],
    borderWidth: 1,
    borderColor: ctx.colors2024['neutral-line'],
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
  },
  statusRow: {
    gap: 4,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: ctx.colors2024['neutral-foot'],
  },
  statusValue: {
    fontSize: 14,
    lineHeight: 20,
    color: ctx.colors2024['neutral-title-1'],
  },
  actions: {
    gap: 10,
  },
}));
