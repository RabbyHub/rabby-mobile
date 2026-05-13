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

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function formatBoolean(value: boolean | null | undefined) {
  if (value === null || value === undefined) {
    return '-';
  }

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

function assertVault(storageState: StorageState | null) {
  if (!storageState?.hasVault) {
    throw new Error('No legacy vault is stored.');
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

function TimingRow({ item }: { item: TimingItem }) {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const detail = [
    item.source,
    `${item.durationMs}ms`,
    typeof item.keyringCount === 'number'
      ? `${item.keyringCount} keyrings`
      : null,
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
  const [lastMessage, setLastMessage] = useState('');
  const [lastBiometricHasCachedKey, setLastBiometricHasCachedKey] = useState<
    boolean | null
  >(null);

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

  const handleMeasurePassword = useCallback(() => {
    runAction('Measure password path', async () => {
      assertVault(storageState);
      assertPassword(password);
      setTimings(
        await apisKeyringVaultDebug.measureUnlockPaths({
          password,
          measurePassword: true,
          measureCachedKey: false,
        }),
      );
    });
  }, [password, runAction, storageState]);

  const handleMeasureCachedKey = useCallback(() => {
    runAction('Measure cached-key path', async () => {
      assertVault(storageState);
      let measured = false;

      await apisKeychain.requestGenericPassword({
        purpose: RequestGenericPurpose.DECRYPT_PWD,
        onPlainPassword: async (_plainPassword, credentials) => {
          const trustedVaultKeyString =
            typeof credentials?.vaultKeyString === 'string'
              ? credentials.vaultKeyString
              : undefined;

          setLastBiometricHasCachedKey(!!trustedVaultKeyString);
          measured = true;
          setTimings(
            await apisKeyringVaultDebug.measureUnlockPaths({
              trustedVaultKeyString,
              measurePassword: false,
              measureCachedKey: true,
            }),
          );
        },
      });

      if (!measured) {
        throw new Error('Biometrics did not return a password payload.');
      }
    });
  }, [runAction, storageState]);

  const storageText = useMemo(
    () => formatJson(storageState || {}),
    [storageState],
  );
  const timingText = useMemo(() => formatJson(timings), [timings]);

  const noVault = !storageState?.hasVault;

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

        <Section title="Storage">
          <InfoRow label="hasVault" value={formatBoolean(storageState?.hasVault)} />
          <InfoRow label="vaultBytes" value={formatBytes(storageState?.vaultBytes)} />
          <InfoRow label="vaultHash" value={storageState?.vaultHash || '-'} />
          <InfoRow label="hasBooted" value={formatBoolean(storageState?.hasBooted)} />
          <InfoRow
            label="unencrypted"
            value={`${storageState?.unencryptedKeyringCount || 0} records`}
          />
          <InfoRow
            label="hasEncrypted"
            value={formatBoolean(storageState?.hasEncryptedKeyringData)}
          />
        </Section>

        <Section title="Measure">
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
            title="Measure Password Path"
            type="primary"
            height={48}
            containerStyle={styles.rowWrapper}
            loading={busy === 'Measure password path'}
            disabled={!!busy || noVault}
            onPress={handleMeasurePassword}
          />
          <Button
            title="Measure Cached-Key Path"
            type="ghost"
            height={48}
            containerStyle={styles.rowWrapper}
            loading={busy === 'Measure cached-key path'}
            disabled={!!busy || noVault}
            onPress={handleMeasureCachedKey}
          />
          <InfoRow
            label="cachedKey"
            value={formatBoolean(lastBiometricHasCachedKey)}
          />
          {lastMessage ? (
            <Text selectable style={styles.message}>
              {lastMessage}
            </Text>
          ) : null}
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
