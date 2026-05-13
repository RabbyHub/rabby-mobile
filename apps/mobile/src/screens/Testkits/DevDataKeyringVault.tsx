import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { apisKeychain, apisKeyringVaultDebug } from '@/core/apis';
import { RequestGenericPurpose } from '@/core/apis/keychain';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

type TimingResult = Awaited<
  ReturnType<typeof apisKeyringVaultDebug.measureUnlockPaths>
>;
type StorageState = ReturnType<
  typeof apisKeyringVaultDebug.getVaultStorageDebugState
>;
type TimingItem = TimingResult[number];
type RecordItem = StorageState['sharded']['records'][number];

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function formatBoolean(value: boolean) {
  return value ? 'true' : 'false';
}

function formatBytes(value: number | null | undefined) {
  if (!value) {
    return '0 B';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  return `${(value / 1024).toFixed(1)} KB`;
}

function assertPassword(password: string) {
  if (!password) {
    throw new Error('Input the wallet password first.');
  }
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text selectable style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

function RecordRow({ record }: { record: RecordItem }) {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.recordRow}>
      <Text style={styles.recordTitle}>
        #{record.index} {record.keyringType}
      </Text>
      <Text selectable style={styles.recordMeta}>
        {record.id}
      </Text>
      <Text style={styles.recordMeta}>
        cipher {formatBytes(record.cipherBytes)} / plain{' '}
        {formatBytes(record.plainBytesHint)}
      </Text>
    </View>
  );
}

function TimingRow({ item }: { item: TimingItem }) {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const detail = [
    item.source,
    `${item.durationMs}ms`,
    typeof item.keyringCount === 'number'
      ? `${item.keyringCount} keyrings`
      : null,
    typeof item.recordCount === 'number' ? `${item.recordCount} records` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.timingRow}>
      <View style={styles.timingHeader}>
        <Text style={styles.timingTitle}>{item.label}</Text>
        <Text style={item.success ? styles.successText : styles.errorText}>
          {item.success ? 'PASS' : 'FAIL'}
        </Text>
      </View>
      <Text style={styles.recordMeta}>{detail}</Text>
      {item.error ? (
        <Text selectable style={styles.errorText}>
          {item.error}
        </Text>
      ) : null}
    </View>
  );
}

export default function DevDataKeyringVaultScreen(): JSX.Element {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [password, setPassword] = useState('');
  const [storageState, setStorageState] = useState<StorageState | null>(null);
  const [timings, setTimings] = useState<TimingResult>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string>('');

  const refresh = useCallback(() => {
    setStorageState(apisKeyringVaultDebug.getVaultStorageDebugState());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runAction = useCallback(
    async (label: string, action: () => Promise<void>) => {
      setBusy(label);
      setLastMessage('');
      try {
        await action();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setLastMessage(message);
        Alert.alert(label, message);
      } finally {
        setBusy(null);
        refresh();
      }
    },
    [refresh],
  );

  const handleMigrate = useCallback(() => {
    runAction('Migrate sharded vault', async () => {
      assertPassword(password);
      const result = await apisKeyringVaultDebug.migrateShardedVault(password);
      setLastMessage(
        `Migrated ${result.recordCount} records in ${result.durationMs}ms.`,
      );
    });
  }, [password, runAction]);

  const handleMeasureWithPassword = useCallback(() => {
    runAction('Measure password paths', async () => {
      assertPassword(password);
      setTimings(
        await apisKeyringVaultDebug.measureUnlockPaths({
          password,
        }),
      );
    });
  }, [password, runAction]);

  const handleMeasureWithBiometrics = useCallback(() => {
    runAction('Measure biometric paths', async () => {
      let measured = false;
      await apisKeychain.requestGenericPassword({
        purpose: RequestGenericPurpose.DECRYPT_PWD,
        onPlainPassword: async (plainPassword, credentials) => {
          measured = true;
          setTimings(
            await apisKeyringVaultDebug.measureUnlockPaths({
              password: plainPassword,
              trustedVaultDataKeyString:
                typeof credentials?.vaultDataKeyString === 'string'
                  ? credentials.vaultDataKeyString
                  : undefined,
            }),
          );
        },
      });
      if (!measured) {
        throw new Error('Biometrics did not return a password payload.');
      }
    });
  }, [runAction]);

  const storageText = useMemo(
    () => formatJson(storageState || {}),
    [storageState],
  );
  const timingText = useMemo(() => formatJson(timings), [timings]);

  return (
    <NormalScreenContainer
      noHeader
      style={styles.screen}
      overwriteStyle={{ backgroundColor: colors2024['neutral-card-1'] }}>
      <ScrollView
        nestedScrollEnabled
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.areaTitle}>Keyring Vault</Text>

        <Section title="Actions">
          <TextInput
            value={password}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Wallet password"
            placeholderTextColor={colors2024['neutral-foot']}
            onChangeText={setPassword}
            style={styles.input}
          />
          <Button
            title="Refresh"
            type="ghost"
            height={48}
            containerStyle={styles.rowWrapper}
            disabled={!!busy}
            onPress={refresh}
          />
          <Button
            title="Migrate"
            type="primary"
            height={48}
            containerStyle={styles.rowWrapper}
            loading={busy === 'Migrate sharded vault'}
            disabled={!!busy}
            onPress={handleMigrate}
          />
          <Button
            title="Measure Password"
            type="ghost"
            height={48}
            containerStyle={styles.rowWrapper}
            loading={busy === 'Measure password paths'}
            disabled={!!busy}
            onPress={handleMeasureWithPassword}
          />
          <Button
            title="Measure Biometrics"
            type="ghost"
            height={48}
            containerStyle={styles.rowWrapper}
            loading={busy === 'Measure biometric paths'}
            disabled={!!busy}
            onPress={handleMeasureWithBiometrics}
          />
          {lastMessage ? (
            <Text selectable style={styles.message}>
              {lastMessage}
            </Text>
          ) : null}
        </Section>

        <Section title="Legacy Vault">
          <InfoRow
            label="hasVault"
            value={formatBoolean(!!storageState?.legacy.hasVault)}
          />
          <InfoRow
            label="vaultBytes"
            value={formatBytes(storageState?.legacy.vaultBytes)}
          />
          <InfoRow
            label="vaultHash"
            value={storageState?.legacy.vaultHash || '-'}
          />
          <InfoRow
            label="hasBooted"
            value={formatBoolean(!!storageState?.legacy.hasBooted)}
          />
          <InfoRow
            label="unencrypted"
            value={`${
              storageState?.legacy.unencryptedKeyringCount || 0
            } records`}
          />
        </Section>

        <Section title="Sharded Vault">
          <InfoRow
            label="hasVault"
            value={formatBoolean(!!storageState?.sharded.hasVault)}
          />
          <InfoRow
            label="fresh"
            value={formatBoolean(!!storageState?.sharded.freshForLegacyVault)}
          />
          <InfoRow
            label="records"
            value={`${storageState?.sharded.recordCount || 0}`}
          />
          <InfoRow
            label="encrypted"
            value={formatBytes(storageState?.sharded.encryptedBytes)}
          />
          <InfoRow
            label="wrappedKey"
            value={formatBytes(storageState?.sharded.wrappedDataKeyBytes)}
          />
          <InfoRow
            label="sourceHash"
            value={storageState?.sharded.sourceVaultHash || '-'}
          />
          <View style={styles.recordsList}>
            {(storageState?.sharded.records || []).map(record => (
              <RecordRow key={record.id} record={record} />
            ))}
          </View>
        </Section>

        <Section title="Timing Results">
          {timings.length ? (
            timings.map(item => <TimingRow key={item.label} item={item} />)
          ) : (
            <Text style={styles.emptyText}>No timing results.</Text>
          )}
        </Section>

        <Section title="Raw Storage State">
          <Text selectable style={styles.mono}>
            {storageText}
          </Text>
        </Section>

        <Section title="Raw Timing Results">
          <Text selectable style={styles.mono}>
            {timingText}
          </Text>
        </Section>
      </ScrollView>
    </NormalScreenContainer>
  );
}

const getStyles = createGetStyles2024(colors => {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors['neutral-card-1'],
    },
    content: {
      minHeight: '100%',
      paddingHorizontal: 12,
      paddingBottom: 64,
    },
    areaTitle: {
      fontSize: 36,
      marginBottom: 12,
      color: colors['neutral-title-1'],
    },
    section: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      paddingTop: 16,
      paddingBottom: 12,
      borderTopWidth: 2,
      borderStyle: 'dotted',
      borderTopColor: colors['neutral-foot'],
      width: '100%',
    },
    sectionBody: {
      width: '100%',
      gap: 10,
    },
    sectionTitle: {
      color: colors['blue-default'],
      textAlign: 'left',
      fontSize: 24,
      marginBottom: 12,
    },
    rowWrapper: {
      width: '100%',
      marginTop: 0,
    },
    input: {
      height: 48,
      borderRadius: 8,
      paddingHorizontal: 12,
      color: colors['neutral-title-1'],
      backgroundColor: colors['neutral-bg-1'],
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors['neutral-line'],
      width: '100%',
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      width: '100%',
      gap: 12,
    },
    infoLabel: {
      width: 116,
      fontSize: 13,
      color: colors['neutral-foot'],
    },
    infoValue: {
      flex: 1,
      fontSize: 13,
      color: colors['neutral-title-1'],
      textAlign: 'right',
    },
    message: {
      fontSize: 13,
      lineHeight: 18,
      color: colors['neutral-body'],
    },
    recordsList: {
      width: '100%',
      gap: 8,
      marginTop: 4,
    },
    recordRow: {
      width: '100%',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors['neutral-line'],
      borderRadius: 8,
      padding: 10,
      gap: 4,
    },
    recordTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors['neutral-title-1'],
    },
    recordMeta: {
      fontSize: 12,
      lineHeight: 16,
      color: colors['neutral-body'],
    },
    timingRow: {
      width: '100%',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors['neutral-line'],
      borderRadius: 8,
      padding: 10,
      gap: 4,
    },
    timingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    timingTitle: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
      color: colors['neutral-title-1'],
    },
    successText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors['green-default'],
    },
    errorText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      color: colors['red-default'],
    },
    emptyText: {
      fontSize: 13,
      color: colors['neutral-foot'],
    },
    mono: {
      fontFamily: 'Menlo',
      fontSize: 11,
      lineHeight: 16,
      color: colors['neutral-body'],
    },
  });
});
