import React, { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import RNFS from 'react-native-fs';
import dayjs from 'dayjs';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { Text } from '@/components/Typography';
import { toast } from '@/components2024/Toast';
import debugLogService, {
  DebugLogEntry,
} from '@/core/services/debugLogService';
import { useTheme2024 } from '@/hooks/theme';
import { shareLocalFile } from '@/utils/shareLocalFile';
import { createGetStyles2024 } from '@/utils/styles';

function LogEntry({
  entry,
  colors,
  styles,
}: {
  entry: DebugLogEntry;
  colors: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  styles: any;
}) {
  const [expanded, setExpanded] = useState(false);

  const levelColor =
    entry.level === 'error'
      ? colors['red-default'] || '#ff4d4f'
      : entry.level === 'warn'
      ? colors['orange-default'] || '#faad14'
      : entry.level === 'debug'
      ? colors['neutral-foot'] || '#999'
      : colors['neutral-title-1'] || '#333';

  return (
    <TouchableOpacity
      style={styles.entry}
      onPress={() => setExpanded(prev => !prev)}
      activeOpacity={0.7}>
      <View style={styles.entryHeader}>
        <Text style={[styles.level, { color: levelColor }]}>
          {entry.level.toUpperCase()}
        </Text>
        <Text style={styles.message} numberOfLines={expanded ? undefined : 2}>
          {entry.message}
        </Text>
        <Text style={styles.time}>
          {dayjs(entry.timestamp).format('HH:mm:ss.SSS')}
        </Text>
      </View>
      {expanded && entry.data ? (
        <Text style={styles.data} selectable>
          {JSON.stringify(entry.data, null, 2)}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default function InMemoryLogViewerScreen(): JSX.Element {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [logs, setLogs] = useState<DebugLogEntry[]>(() =>
    debugLogService.getLogs(),
  );

  useEffect(() => {
    debugLogService.setFilter(entry =>
      entry.message.includes('[RabbyUnlockPerf:keychain]'),
    );
    setLogs(debugLogService.getLogs());

    const unsubscribe = debugLogService.subscribe(() => {
      setLogs(debugLogService.getLogs());
    });

    return () => {
      debugLogService.clearFilter();
      unsubscribe();
    };
  }, []);

  const handleClear = useCallback(() => {
    debugLogService.clearLogs();
    setLogs([]);
    toast.success('In-memory logs cleared');
  }, []);

  const handleShare = useCallback(async () => {
    const lines = logs.map(
      entry =>
        `[${dayjs(entry.timestamp).format(
          'YYYY-MM-DD HH:mm:ss.SSS',
        )}] ${entry.level.toUpperCase()} ${entry.message}${
          entry.data ? ` ${JSON.stringify(entry.data)}` : ''
        }`,
    );
    const content = lines.join('\n');
    const tmpDir = RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath;
    const tmpPath = `${tmpDir}/rabby-keychain-perf-${Date.now()}.log`;

    await RNFS.writeFile(tmpPath, content, 'utf8');
    await shareLocalFile({
      path: tmpPath,
      mimeType: 'text/plain',
      title: 'Share Keychain Perf Logs',
      subject: 'Rabby keychain perf logs',
      message: `Rabby keychain perf logs (${logs.length} entries)`,
      cleanupPaths: [tmpPath],
    });
  }, [logs]);

  return (
    <NormalScreenContainer noHeader style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerCount}>
          {logs.length} entries (newest first)
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            disabled={logs.length === 0}
            onPress={handleShare}>
            <Text style={styles.headerBtnTitle}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            disabled={logs.length === 0}
            onPress={handleClear}>
            <Text style={styles.headerBtnTitle}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView
        style={styles.list}
        contentContainerStyle={
          logs.length === 0 ? styles.emptyContainer : undefined
        }
        showsVerticalScrollIndicator>
        {logs.length === 0 ? (
          <Text style={styles.emptyText}>No in-memory logs yet.</Text>
        ) : (
          logs.map((entry, index) => (
            <LogEntry
              key={`${entry.timestamp}-${index}`}
              entry={entry}
              colors={colors2024}
              styles={styles}
            />
          ))
        )}
      </ScrollView>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: ctx.colors2024['neutral-line'],
    },
    headerActions: {
      flexDirection: 'row',
      gap: 2,
    },
    headerBtn: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    headerBtnTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: ctx.colors2024['brand-default'],
    },
    headerCount: {
      fontSize: 14,
      fontWeight: '600',
      color: ctx.colors2024['neutral-title-1'],
    },
    list: {
      flex: 1,
      paddingHorizontal: 10,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: ctx.colors2024['neutral-foot'],
    },
    entry: {
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderBottomWidth: 1,
      borderBottomColor: ctx.colors2024['neutral-line'],
      gap: 8,
    },
    entryHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    level: {
      fontSize: 11,
      fontWeight: '700',
      fontFamily: monoFont,
      minWidth: 44,
      paddingTop: 1,
    },
    message: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: ctx.colors2024['neutral-title-1'],
      fontFamily: monoFont,
    },
    time: {
      fontSize: 11,
      color: ctx.colors2024['neutral-foot'],
      fontFamily: monoFont,
    },
    data: {
      fontSize: 11,
      lineHeight: 16,
      color: ctx.colors2024['neutral-body'],
      fontFamily: monoFont,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      padding: 8,
      borderRadius: 8,
      overflow: 'hidden',
    },
  };
});
