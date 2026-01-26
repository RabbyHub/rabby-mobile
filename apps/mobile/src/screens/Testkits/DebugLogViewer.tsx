import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Clipboard,
  Alert,
  Button,
  Pressable,
} from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { debugLogService } from '@/core/services';
import type { DebugLogEntry } from '@/core/services/debugLogService';
import { toast } from '@/components2024/Toast';
import dayjs from 'dayjs';

const LOG_LEVEL_COLORS = {
  info: '#3B82F6',
  warn: '#F59E0B',
  error: '#EF4444',
  debug: '#8B5CF6',
};

function LogEntryView({ entry }: { entry: DebugLogEntry }) {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const levelColor = LOG_LEVEL_COLORS[entry.level];
  const timeStr = dayjs(entry.timestamp).format('HH:mm:ss.SSS');

  return (
    <View style={styles.logEntry}>
      <View style={styles.logHeader}>
        <Text
          style={[
            styles.logLevel,
            { backgroundColor: levelColor + '20', color: levelColor },
          ]}>
          {entry.level.toUpperCase()}
        </Text>
        <Text style={styles.logTime}>{timeStr}</Text>
      </View>
      <Text style={styles.logMessage}>{entry.message}</Text>
      {entry.data !== undefined && entry.data !== null ? (
        <Text style={styles.logData}>
          {typeof entry.data === 'string'
            ? entry.data
            : JSON.stringify(entry.data, null, 2)}
        </Text>
      ) : null}
    </View>
  );
}

export default function DebugLogViewerScreen(): JSX.Element {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);

  const refreshLogs = useCallback(() => {
    setLogs(debugLogService.getLogs());
  }, []);

  useEffect(() => {
    refreshLogs();
    const unsubscribe = debugLogService.subscribe(refreshLogs);
    return unsubscribe;
  }, [refreshLogs]);

  const handleCopyAll = useCallback(() => {
    const allLogs = logs
      .map(log => {
        const timeStr = dayjs(log.timestamp).format('YYYY-MM-DD HH:mm:ss.SSS');
        let text = `[${log.level.toUpperCase()}] ${timeStr} - ${log.message}`;
        if (log.data) {
          text += `\nData: ${
            typeof log.data === 'string'
              ? log.data
              : JSON.stringify(log.data, null, 2)
          }`;
        }
        return text;
      })
      .join('\n\n');

    Clipboard.setString(allLogs);
    toast.success('Logs copied to clipboard');
  }, [logs]);

  const handleClearLogs = useCallback(() => {
    Alert.alert('Clear Logs', 'Are you sure you want to clear all logs?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          debugLogService.clearLogs();
          toast.success('Logs cleared');
        },
      },
    ]);
  }, []);

  return (
    <NormalScreenContainer style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Debug Logs</Text>
        <Text style={styles.count}>{logs.length} logs</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, { marginRight: 12 }]}
          onPress={handleCopyAll}
          disabled={logs.length === 0}>
          <Text style={styles.buttonText}>Copy All</Text>
        </Pressable>
        <Pressable
          style={styles.button}
          onPress={handleClearLogs}
          disabled={logs.length === 0}>
          <Text
            style={[styles.buttonText, { color: colors2024['red-default'] }]}>
            Clear All
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView}>
        {logs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No logs yet</Text>
            <Text style={styles.emptyHint}>
              Use debugLogService to add logs from anywhere in the app
            </Text>
          </View>
        ) : (
          logs.map((log, index) => <LogEntryView key={index} entry={log} />)
        )}
      </ScrollView>
    </NormalScreenContainer>
  );
}

const getStyles = createGetStyles2024(ctx => {
  return {
    container: {
      flex: 1,
      backgroundColor: ctx.colors2024['neutral-bg-1'],
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: ctx.colors2024['neutral-line'],
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: ctx.colors2024['neutral-title-1'],
    },
    count: {
      fontSize: 14,
      color: ctx.colors2024['neutral-body'],
    },
    actions: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: ctx.colors2024['neutral-line'],
    },
    button: {
      flex: 1,
      height: 40,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: ctx.colors2024['neutral-line'],
      backgroundColor: ctx.colors2024['neutral-card-2'],
    },
    buttonText: {
      fontSize: 14,
      fontWeight: '500',
      color: ctx.colors2024['blue-default'],
    },
    scrollView: {
      flex: 1,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '500',
      color: ctx.colors2024['neutral-body'],
      marginBottom: 8,
    },
    emptyHint: {
      fontSize: 13,
      color: ctx.colors2024['neutral-foot'],
      textAlign: 'center',
    },
    logEntry: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: ctx.colors2024['neutral-line'],
    },
    logHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    logLevel: {
      fontSize: 11,
      fontWeight: '600',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      marginRight: 8,
      overflow: 'hidden',
    },
    logTime: {
      fontSize: 12,
      color: ctx.colors2024['neutral-foot'],
      fontFamily: 'Menlo',
    },
    logMessage: {
      fontSize: 14,
      color: ctx.colors2024['neutral-title-1'],
      lineHeight: 20,
      marginBottom: 4,
    },
    logData: {
      fontSize: 12,
      color: ctx.colors2024['neutral-body'],
      fontFamily: 'Menlo',
      backgroundColor: ctx.colors2024['neutral-card-2'],
      padding: 8,
      borderRadius: 6,
      marginTop: 4,
    },
  };
});
