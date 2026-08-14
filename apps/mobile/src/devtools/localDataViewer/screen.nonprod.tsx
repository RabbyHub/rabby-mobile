import Clipboard from '@react-native-clipboard/clipboard';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  ScrollView,
  View,
} from 'react-native';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { toast } from '@/components2024/Toast';
import {
  APPLICATION_ID,
  APP_VERSIONS,
  isNonPublicProductionEnv,
} from '@/constant';
import { APP_RUNTIME_ENV, BUILD_CHANNEL } from '@/constant/env';
import { ALL_KNOWN_MMKV_INSTANCES } from '@/core/storage/mmkvInstances';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import {
  createLocalDataSnapshot,
  type LocalDataSnapshot,
  type LocalDataStorageDump,
} from './storageSnapshot';

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function StorageSection({
  storageId,
  storage,
}: {
  storageId: string;
  storage: LocalDataStorageDump;
}): JSX.Element {
  const { styles } = useTheme2024({ getStyle });
  const rawJson = useMemo(() => formatJson(storage), [storage]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{storageId}</Text>
        <Text style={styles.keyCount}>{storage.keyCount} keys</Text>
      </View>
      <ScrollView
        nestedScrollEnabled
        style={styles.rawVerticalScroll}
        contentContainerStyle={styles.rawVerticalContent}>
        <ScrollView horizontal nestedScrollEnabled>
          <Text selectable style={styles.mono}>
            {rawJson}
          </Text>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

export default function LocalDataViewerScreen(): JSX.Element | null {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [snapshot, setSnapshot] = useState<LocalDataSnapshot | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isNonPublicProductionEnv) {
      return;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      try {
        setSnapshot(
          createLocalDataSnapshot(
            {
              generatedAt: new Date().toISOString(),
              app: {
                applicationId: APPLICATION_ID,
                buildChannel: BUILD_CHANNEL,
                runtimeEnv: APP_RUNTIME_ENV,
                version: APP_VERSIONS.fromNative,
                buildNumber: APP_VERSIONS.buildNumber,
              },
            },
            ALL_KNOWN_MMKV_INSTANCES,
          ),
        );
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : String(nextError),
        );
      }
    });

    return () => task.cancel();
  }, []);

  const handleCopy = useCallback(() => {
    if (!snapshot) {
      return;
    }

    Clipboard.setString(formatJson(snapshot));
    toast.success('ALL LOCAL DATA COPIED');
  }, [snapshot]);

  if (!isNonPublicProductionEnv) {
    return null;
  }

  return (
    <NormalScreenContainer
      noHeader
      style={styles.screen}
      overwriteStyle={{ backgroundColor: colors2024['neutral-card-1'] }}>
      <ScrollView
        nestedScrollEnabled
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Local Data</Text>
        <Text style={styles.warning}>
          This snapshot contains sensitive wallet data. Only copy it to a
          trusted destination.
        </Text>

        <Button
          type="primary"
          title="Copy All Data"
          height={48}
          disabled={!snapshot}
          onPress={handleCopy}
        />

        {!snapshot && !error ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors2024['brand-default']} />
            <Text style={styles.loadingText}>Reading local storage...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text selectable style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : null}

        {snapshot ? (
          <>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Snapshot</Text>
              <Text style={styles.summaryText}>
                {Object.keys(snapshot.storages).length} storages ·{' '}
                {snapshot.totalKeyCount} keys
              </Text>
              <Text selectable style={styles.summaryMeta}>
                {snapshot.generatedAt}
              </Text>
            </View>

            {Object.entries(snapshot.storages).map(([storageId, storage]) => (
              <StorageSection
                key={storageId}
                storageId={storageId}
                storage={storage}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    </NormalScreenContainer>
  );
}

const getStyle = createGetStyles2024(ctx => ({
  screen: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 24,
    fontWeight: '700',
  },
  warning: {
    color: ctx.colors2024['orange-default'],
    fontSize: 13,
    lineHeight: 18,
  },
  loading: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: ctx.colors2024['neutral-secondary'],
    fontSize: 14,
  },
  summary: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: ctx.colors2024['neutral-card-2'],
    gap: 6,
  },
  summaryTitle: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '600',
  },
  summaryText: {
    color: ctx.colors2024['neutral-body'],
    fontSize: 14,
  },
  summaryMeta: {
    color: ctx.colors2024['neutral-foot'],
    fontSize: 12,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: ctx.colors2024['neutral-card-2'],
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    flex: 1,
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 15,
    fontWeight: '600',
  },
  keyCount: {
    color: ctx.colors2024['neutral-foot'],
    fontSize: 12,
  },
  rawVerticalScroll: {
    maxHeight: 360,
    borderRadius: 8,
    backgroundColor: ctx.colors2024['neutral-card-1'],
  },
  rawVerticalContent: {
    padding: 12,
  },
  mono: {
    color: ctx.colors2024['neutral-body'],
    fontFamily: 'Courier',
    fontSize: 11,
    lineHeight: 16,
  },
  errorCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: ctx.colors2024['red-light'],
  },
  errorText: {
    color: ctx.colors2024['red-default'],
    fontSize: 13,
    lineHeight: 18,
  },
}));
