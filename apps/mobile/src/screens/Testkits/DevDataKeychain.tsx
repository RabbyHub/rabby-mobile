import Clipboard from '@react-native-clipboard/clipboard';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import dayjs from 'dayjs';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import RNFS from 'react-native-fs';

import RcIconQuestionCC from '@/assets/icons/transaction-record/icon-question-cc.svg';
import RcIconEyeCloseCC from '@/assets2024/icons/home/eye-close-cc.svg';
import RcIconEyeCC from '@/assets2024/icons/home/eye-cc.svg';
import AutoLockView from '@/components/AutoLockView';
import { Text } from '@/components/Typography';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
} from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { PillsSwitch } from '@/components2024/PillSwitch';
import { Radio } from '@/components2024/Radio';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { toast } from '@/components2024/Toast';
import {
  apisKeychain,
  apisKeychainDebug,
  apisKeychainV8_2_0,
  apisKeychainV9_0_0,
  apisKeychainV10_0_0,
} from '@/core/apis';
import { IS_ANDROID } from '@/core/native/utils';
import {
  useCurrentKeychainVersion,
  useDebugKeychainStorage,
  type CurrentKeychainVersion,
} from '@/hooks/appSettings';
import { useAppSecurityChain } from '@/hooks/global';
import { useTheme2024 } from '@/hooks/theme';
import { shareLocalFile } from '@/utils/shareLocalFile';
import { logger } from '@/utils/logger';
import { createGetStyles2024 } from '@/utils/styles';

const TAB_OPTIONS = [
  { key: 'current', label: 'Current' },
  { key: '8.2.0-fork', label: '8.2.0' },
  { key: '9.0.0', label: '9.0.0' },
  { key: '10.0.0', label: '10.0.0' },
] as const;

const KEYCHAIN_VERSION_OPTIONS = [
  {
    key: '8.2.0-fork',
    label: '8.2.0-fork',
    sourceLabel: apisKeychainV8_2_0.KEYCHAIN_SOURCE_LABEL,
    description: 'Local fork that matches the current business path.',
  },
  {
    key: '9.0.0',
    label: '9.0.0',
    sourceLabel: apisKeychainV9_0_0.KEYCHAIN_SOURCE_LABEL,
    description: 'Rabby-local 9.x wrapper with the Android prompt patch.',
  },
  {
    key: '10.0.0',
    label: '10.0.0',
    sourceLabel: apisKeychainV10_0_0.KEYCHAIN_SOURCE_LABEL,
    description: 'Official 10.x package wrapped with Rabby business logic.',
  },
] as const;

const KEYCHAIN_VERSION_META: Record<
  CurrentKeychainVersion,
  (typeof KEYCHAIN_VERSION_OPTIONS)[number]
> = {
  '8.2.0-fork': KEYCHAIN_VERSION_OPTIONS[0],
  '9.0.0': KEYCHAIN_VERSION_OPTIONS[1],
  '10.0.0': KEYCHAIN_VERSION_OPTIONS[2],
};

const ANDROID_AUTH_PROMPT_POLICY_OPTIONS = [
  {
    key: apisKeychain.ANDROID_AUTH_PROMPT_POLICIES.INTERACTIVE_FIRST,
    label: 'Interactive First',
    description: 'Always prompt biometrics before the Android RSA key is used.',
  },
  {
    key: apisKeychain.ANDROID_AUTH_PROMPT_POLICIES
      .ALLOW_AUTHENTICATED_SESSION_REUSE,
    label: 'Allow Session',
    description:
      'Try the Android KeyStore directly first and reuse any still-valid authenticated session.',
  },
] as const;

const KEYCHAIN_STORAGE_OPTIONS = [
  {
    key: apisKeychain.KEYCHAIN_STORAGE_TYPES.RSA,
    label: 'RSA / ECB',
    description:
      'Android Keystore RSA path. This is the current biometrics-focused storage.',
  },
  {
    key: apisKeychain.KEYCHAIN_STORAGE_TYPES.AES,
    label: 'AES / CBC',
    description:
      'Android Keystore AES path. Its auth behavior differs from the RSA biometric flow.',
  },
  {
    key: apisKeychain.KEYCHAIN_STORAGE_TYPES.AES_GCM,
    label: 'AES / GCM',
    description:
      'Android Keystore AES-GCM path introduced by react-native-keychain 10.',
  },
  {
    key: apisKeychain.KEYCHAIN_STORAGE_TYPES.KC,
    label: 'iOS Keychain',
    description: 'System keychain storage on iOS / visionOS.',
  },
] as const;

const LEGACY_SIMULATION = {
  service: apisKeychainV8_2_0.KEYCHAIN_DEFAULT_SERVICE,
  action: 'drop-current-cipher-storage-marker-only',
  rewritesCredentialBlobs: false,
  notes: [
    'Keeps the current username/password blobs unchanged.',
    'Removes the current Android cipher marker only.',
    'Use this to emulate legacy marker-missing RSA data without overwriting the stored password.',
  ],
};

const REPEAT_DECRYPT_TEST_STEPS = [
  '1. Clear Keychain for the target version.',
  '2. Re-enable biometrics through the normal wallet lock flow.',
  '3. Return here and run the same unlock request action twice, waiting at least 2 seconds between taps.',
] as const;

const REPEAT_DECRYPT_EXPECTATIONS: Record<CurrentKeychainVersion, string[]> = {
  '8.2.0-fork': [
    'Expected: both Unlock Request taps prompt biometrics.',
    'Regression signal: a later tap succeeds without a fresh biometric prompt.',
  ],
  '9.0.0': [
    'Expected: both Unlock Request taps prompt biometrics, matching 8.2.0-fork.',
    'Regression signal: a later tap succeeds without a fresh biometric prompt.',
  ],
  '10.0.0': [
    'Expected: both Unlock Request taps prompt biometrics, matching 8.2.0-fork and 9.0.0.',
    'Regression signal: a later tap succeeds without a fresh biometric prompt.',
  ],
};

const REPEAT_RAW_READ_TEST_STEPS = [
  '1. Open the 10.0.0 tab and keep the current keychain set to 10.0.0 if you want the business path aligned.',
  '2. Ensure the current service already has a biometrics entry.',
  '3. Run Read Current twice, waiting at least 2 seconds between taps.',
] as const;

const REPEAT_RAW_READ_EXPECTATIONS = [
  'Expected: both Read Current taps prompt biometrics after the RSA prompt patch.',
  'Regression signal: the second read returns without a fresh biometric prompt.',
] as const;

const SESSION_REUSE_TEST_STEPS = [
  '1. Use one of the Allow Session actions below after the current service already has a biometrics entry.',
  '2. Complete biometrics on the first run.',
  '3. Repeat the same allow-session action after a short delay, then again after a longer delay.',
] as const;

const SESSION_REUSE_EXPECTATIONS = [
  'Expected: the first allow-session run still prompts biometrics.',
  'Expected: later runs may skip the prompt only while Android still treats the KeyStore auth session as valid.',
  'If the action keeps succeeding without a fresh prompt far beyond the expected window, export debug info and compare both keychain versions.',
] as const;

type TabKey = (typeof TAB_OPTIONS)[number]['key'];
type DebugStateLike = apisKeychain.KeychainDebugState;
type AndroidDebugStateLike = Extract<DebugStateLike, { platform: 'android' }>;
type IOSDebugStateLike = Extract<DebugStateLike, { platform: 'ios' }>;
type AndroidAuthPromptPolicy = apisKeychain.AndroidAuthPromptPolicy;
type KeychainStorageType = apisKeychain.KeychainStorageType;
type PromptPolicyState<T> = Record<AndroidAuthPromptPolicy, T>;
type BusinessDecryptState = {
  plainPassword: string | null;
  resultMessage: string | null;
  errorMessage: string | null;
};
type BusinessRewriteResult = {
  label: string;
  service: string;
  targetStorage: KeychainStorageType;
  targetAuthTypeLabel?: string;
  rewrittenAt: string;
};
type RawReadState = {
  result: V9ReadResult | null;
  errorMessage: string | null;
};
type BusinessVersionState = {
  debugState: apisKeychain.KeychainDebugState | null;
  decryptStates: PromptPolicyState<BusinessDecryptState>;
  rewriteResult: BusinessRewriteResult | null;
  rewriteErrorMessage: string | null;
  lastActionErrorMessage: string | null;
};
type V9ReadResult = {
  label: string;
  credentials: Awaited<
    ReturnType<typeof apisKeychainDebug.readGenericPassword>
  >;
};
type V9ReadCredentials = Exclude<V9ReadResult['credentials'], false>;
type KeychainWriteResult = Awaited<
  ReturnType<typeof apisKeychainDebug.writeBiometricsEntry>
>;
type SuccessfulKeychainWriteResult = Exclude<KeychainWriteResult, false>;
type V9CurrentBusinessDecryptResult = {
  label: string;
  credentials: V9ReadCredentials;
  decryptedPayload: Awaited<
    ReturnType<typeof apisKeychainV9_0_0.debugDecryptStoredPasswordPayload>
  >;
};
type V9CurrentRewriteResult = {
  label: string;
  service: string;
  writeResult: SuccessfulKeychainWriteResult;
  targetStorage: KeychainStorageType;
  rewrittenAt: string;
};

type ExportableV9ReadCredentials = Omit<V9ReadCredentials, 'password'> & {
  password: string | null;
};

type ExportableV9ReadResult = {
  label: string;
  credentials: false | ExportableV9ReadCredentials;
};

type ExportableRawReadState = {
  result: ExportableV9ReadResult | null;
  errorMessage: string | null;
};

type ExportableV9CurrentBusinessDecryptResult = {
  label: string;
  credentials: ExportableV9ReadCredentials;
  decryptedPayload: {
    password: string | null;
  };
};

type KeychainVersionExportState = BusinessVersionState & {
  sourceLabel: string;
};

type KeychainDebugExportPayload = {
  exportedAt: string;
  app: {
    platform: 'android' | 'ios';
    mode: 'development' | 'production';
    rabbitCode: string | null;
    includesSecretFields: boolean;
  };
  current: {
    effectiveVersion: CurrentKeychainVersion;
    configuredVersion: CurrentKeychainVersion;
    configuredVersionField: string;
    canSwitchCurrentKeychainVersion: boolean;
    sourceLabel: string;
    defaultAndroidAuthPromptPolicy: AndroidAuthPromptPolicy;
    configuredStorageByVersion: Record<
      CurrentKeychainVersion,
      KeychainStorageType
    >;
    effectiveStorageByVersion: Record<
      CurrentKeychainVersion,
      KeychainStorageType
    >;
    supportedStorageTypesByVersion: Record<
      CurrentKeychainVersion,
      KeychainStorageType[]
    >;
  };
  versions: {
    v8_2_0: KeychainVersionExportState;
    v9_0_0: KeychainVersionExportState;
    v10_0_0: KeychainVersionExportState;
  };
  v10Raw: {
    defaultState: apisKeychainDebug.KeychainDebugState | null;
    probeState: apisKeychainDebug.KeychainDebugState | null;
    probeService: string;
    probePassword: string | null;
    currentReadResult: ExportableV9ReadResult | null;
    currentReadErrorMessage: string | null;
    probeReadResult: ExportableV9ReadResult | null;
    probeReadErrorMessage: string | null;
    currentReadStates: PromptPolicyState<ExportableRawReadState>;
    probeReadStates: PromptPolicyState<ExportableRawReadState>;
    currentBusinessDecryptResult: ExportableV9CurrentBusinessDecryptResult | null;
    currentBusinessDecryptErrorMessage: string | null;
    currentRewriteResult: V9CurrentRewriteResult | null;
    currentRewriteErrorMessage: string | null;
    lastReadResult: ExportableV9ReadResult | null;
    lastErrorMessage: string | null;
  };
  mockOldData: typeof LEGACY_SIMULATION;
};

type HelpSheetContext =
  | {
      topic: 'current-selector';
    }
  | {
      topic: 'business-version';
      version: CurrentKeychainVersion;
      isCurrentAlias: boolean;
    }
  | {
      topic: 'raw-v10';
    };

function getPromptPolicyLabel(policy: AndroidAuthPromptPolicy) {
  return (
    ANDROID_AUTH_PROMPT_POLICY_OPTIONS.find(option => option.key === policy)
      ?.label || policy
  );
}

function getKeychainStorageLabel(storage: KeychainStorageType) {
  return (
    KEYCHAIN_STORAGE_OPTIONS.find(option => option.key === storage)?.label ||
    storage
  );
}

function getKeychainStorageDescription(storage: KeychainStorageType) {
  return (
    KEYCHAIN_STORAGE_OPTIONS.find(option => option.key === storage)
      ?.description || storage
  );
}

function getKeychainStorageDebugLabel(storage?: string | null) {
  return (
    KEYCHAIN_STORAGE_OPTIONS.find(option => option.key === storage)?.label ||
    storage ||
    '-'
  );
}

function makePromptPolicyState<T>(
  factory: (policy: AndroidAuthPromptPolicy) => T,
): PromptPolicyState<T> {
  return {
    [apisKeychain.ANDROID_AUTH_PROMPT_POLICIES.INTERACTIVE_FIRST]: factory(
      apisKeychain.ANDROID_AUTH_PROMPT_POLICIES.INTERACTIVE_FIRST,
    ),
    [apisKeychain.ANDROID_AUTH_PROMPT_POLICIES
      .ALLOW_AUTHENTICATED_SESSION_REUSE]: factory(
      apisKeychain.ANDROID_AUTH_PROMPT_POLICIES
        .ALLOW_AUTHENTICATED_SESSION_REUSE,
    ),
  };
}

function mapPromptPolicyState<T, R>(
  state: PromptPolicyState<T>,
  mapper: (value: T, policy: AndroidAuthPromptPolicy) => R,
): PromptPolicyState<R> {
  return {
    [apisKeychain.ANDROID_AUTH_PROMPT_POLICIES.INTERACTIVE_FIRST]: mapper(
      state[apisKeychain.ANDROID_AUTH_PROMPT_POLICIES.INTERACTIVE_FIRST],
      apisKeychain.ANDROID_AUTH_PROMPT_POLICIES.INTERACTIVE_FIRST,
    ),
    [apisKeychain.ANDROID_AUTH_PROMPT_POLICIES
      .ALLOW_AUTHENTICATED_SESSION_REUSE]: mapper(
      state[
        apisKeychain.ANDROID_AUTH_PROMPT_POLICIES
          .ALLOW_AUTHENTICATED_SESSION_REUSE
      ],
      apisKeychain.ANDROID_AUTH_PROMPT_POLICIES
        .ALLOW_AUTHENTICATED_SESSION_REUSE,
    ),
  };
}

function sanitizeReadResult(
  result: V9ReadResult | null,
  includeSecretFields: boolean,
): ExportableV9ReadResult | null {
  if (!result) {
    return null;
  }

  if (!result.credentials) {
    return result;
  }

  return {
    ...result,
    credentials: {
      ...result.credentials,
      password: includeSecretFields ? result.credentials.password : null,
    },
  };
}

function sanitizeBusinessVersionStateForExport(
  sourceLabel: string,
  state: BusinessVersionState,
  includeSecretFields: boolean,
): KeychainVersionExportState {
  return {
    ...state,
    sourceLabel,
    decryptStates: mapPromptPolicyState(state.decryptStates, decryptState => ({
      ...decryptState,
      plainPassword: includeSecretFields ? decryptState.plainPassword : null,
    })),
  };
}

function sanitizeCurrentBusinessDecryptResultForExport(
  result: V9CurrentBusinessDecryptResult | null,
  includeSecretFields: boolean,
): ExportableV9CurrentBusinessDecryptResult | null {
  if (!result) {
    return null;
  }

  return {
    ...result,
    credentials: {
      ...result.credentials,
      password: includeSecretFields ? result.credentials.password : null,
    },
    decryptedPayload: {
      password: includeSecretFields ? result.decryptedPayload.password : null,
    },
  };
}

function getKeychainDebugShareDir() {
  return `${
    RNFS.TemporaryDirectoryPath ||
    RNFS.CachesDirectoryPath ||
    RNFS.DocumentDirectoryPath
  }/rabby-keychain-debug`;
}

async function ensureKeychainDebugShareDir() {
  const shareDir = getKeychainDebugShareDir();
  await RNFS.mkdir(shareDir, {
    NSURLIsExcludedFromBackupKey: true,
  });

  return shareDir;
}

function maskSecret(secret?: string | null) {
  if (!secret) {
    return '';
  }

  return '*'.repeat(Math.max(secret.length, 8));
}

function getReadableErrorMessage(error: unknown) {
  const parsed = apisKeychainV8_2_0.parseKeychainError(error);

  return (
    parsed.sysMessage ||
    (error instanceof Error ? error.message : String(error))
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{desc}</Text>
    </View>
  );
}

function EyeToggleButton({
  visible,
  onPress,
}: {
  visible: boolean;
  onPress: () => void;
}) {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  return (
    <TouchableOpacity
      style={styles.eyeToggleButton}
      hitSlop={8}
      activeOpacity={0.8}
      onPress={onPress}>
      {visible ? (
        <RcIconEyeCC
          color={colors2024['neutral-title-1']}
          width={20}
          height={20}
        />
      ) : (
        <RcIconEyeCloseCC
          color={colors2024['neutral-title-1']}
          width={20}
          height={20}
        />
      )}
    </TouchableOpacity>
  );
}

function ScrollableStatusCard({
  maxHeight,
  children,
}: React.PropsWithChildren<{
  maxHeight?: number;
}>) {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  return (
    <View style={styles.statusCard}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator
        contentContainerStyle={styles.cardHorizontalScrollContent}>
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator
          style={[styles.cardVerticalScroll, maxHeight ? { maxHeight } : null]}
          contentContainerStyle={styles.cardVerticalScrollContent}>
          {children}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

type StatusGridItem = {
  label: string;
  value: string | number | boolean | null | undefined;
  selectable?: boolean;
  allowHorizontalOverflow?: boolean;
};

function chunkStatusGridItems(items: StatusGridItem[], chunkSize: number) {
  const rows: StatusGridItem[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    rows.push(items.slice(index, index + chunkSize));
  }

  return rows;
}

function CompactStatusGrid({
  items,
  maxColumns = 6,
}: {
  items: StatusGridItem[];
  maxColumns?: number;
}) {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });
  const rows = useMemo(
    () => chunkStatusGridItems(items, maxColumns),
    [items, maxColumns],
  );

  return (
    <View style={styles.statusGrid}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.statusCompactRow}>
          {row.map(item => (
            <StatusRow
              key={`${item.label}-${String(item.value)}`}
              label={item.label}
              value={item.value}
              selectable={item.selectable}
              allowHorizontalOverflow={item.allowHorizontalOverflow}
              compact
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function KeychainReadResultCard({
  title,
  result,
  isPasswordVisible,
  onTogglePasswordVisibility,
  maxHeight,
}: {
  title: string;
  result: V9ReadResult | null;
  isPasswordVisible: boolean;
  onTogglePasswordVisibility: () => void;
  maxHeight?: number;
}) {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  if (!result) {
    return null;
  }

  const maskedPassword =
    result.credentials && result.credentials.password
      ? maskSecret(result.credentials.password)
      : '';

  return (
    <ScrollableStatusCard maxHeight={maxHeight}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {__DEV__ && result.credentials ? (
          <EyeToggleButton
            visible={isPasswordVisible}
            onPress={onTogglePasswordVisibility}
          />
        ) : null}
      </View>
      <CompactStatusGrid
        items={[
          {
            label: 'Target',
            value: result.label,
            allowHorizontalOverflow: true,
          },
          ...(result.credentials
            ? [
                {
                  label: 'Storage',
                  value: result.credentials.storage,
                  allowHorizontalOverflow: true,
                },
              ]
            : []),
        ]}
      />
      {result.credentials ? (
        <>
          <StatusRow
            label="Service"
            value={result.credentials.service}
            allowHorizontalOverflow
          />
          <StatusRow
            label="Username"
            value={result.credentials.username}
            selectable
            allowHorizontalOverflow
          />
          <Text style={styles.statusLabel}>Password Output</Text>
          <Text
            style={[
              styles.plainPasswordValue,
              styles.plainPasswordOverflowValue,
            ]}
            selectable={__DEV__}>
            {__DEV__ && isPasswordVisible
              ? result.credentials.password
              : maskedPassword}
          </Text>
        </>
      ) : (
        <Text style={styles.emptyDesc}>No credentials returned.</Text>
      )}
    </ScrollableStatusCard>
  );
}

function StatusRow({
  label,
  value,
  selectable = false,
  allowHorizontalOverflow = false,
  compact = false,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
  selectable?: boolean;
  allowHorizontalOverflow?: boolean;
  compact?: boolean;
}) {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });
  const displayValue =
    value === null || typeof value === 'undefined' || value === ''
      ? '-'
      : String(value);

  return (
    <View style={[styles.statusRow, compact ? styles.statusRowCompact : null]}>
      <Text
        style={[
          styles.statusLabel,
          compact ? styles.statusLabelCompact : null,
        ]}>
        {label}
      </Text>
      <Text
        style={[
          styles.statusValue,
          compact ? styles.statusValueCompact : null,
          allowHorizontalOverflow && !compact ? styles.statusValueNoWrap : null,
        ]}
        selectable={selectable}>
        {displayValue}
      </Text>
    </View>
  );
}

function ActionSheetSection({
  title,
  desc,
  children,
}: React.PropsWithChildren<{
  title: string;
  desc?: string;
}>) {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  return (
    <View style={styles.sheetSection}>
      <Text style={styles.sheetSectionTitle}>{title}</Text>
      {desc ? <Text style={styles.sheetSectionDesc}>{desc}</Text> : null}
      {children}
    </View>
  );
}

function SectionHelpButton({ onPress }: { onPress: () => void }) {
  const { colors2024, styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  return (
    <TouchableOpacity
      style={styles.sectionHelpButton}
      hitSlop={8}
      activeOpacity={0.8}
      onPress={onPress}>
      <RcIconQuestionCC
        color={colors2024['neutral-foot']}
        width={18}
        height={18}
      />
    </TouchableOpacity>
  );
}

function KeychainSummaryCard({
  title,
  state,
}: {
  title: string;
  state: DebugStateLike | null;
}) {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  if (!state) {
    return <EmptyState title={title} desc="Fetching keychain state." />;
  }

  const summaryBadges =
    state.platform === 'android'
      ? [
          `Entry: ${state.hasEntry ? 'true' : 'false'}`,
          `Auth: ${state.authenticationTypeLabel}`,
          `Bio: ${state.supportedBiometryType || '-'}`,
          `Stored: ${state.storedCipherStorageName || '-'}`,
          `Resolved: ${state.resolvedCipherStorageName || '-'}`,
          `Key Alias: ${state.hasKeystoreAlias ? 'true' : 'false'}`,
          `Key Compat: ${
            state.keystoreIsCompatibleWithCurrentCipher === null
              ? '-'
              : state.keystoreIsCompatibleWithCurrentCipher
              ? 'true'
              : 'false'
          }`,
          `Missing marker: ${
            state.isCipherStorageMarkerMissing ? 'true' : 'false'
          }`,
        ]
      : [
          `Entry: ${state.hasEntry ? 'true' : 'false'}`,
          `Auth: ${state.authenticationTypeLabel}`,
          `Bio: ${state.supportedBiometryType || '-'}`,
          `Storage: ${getKeychainStorageDebugLabel(state.storageName)}`,
          `Accessible: ${state.accessible || '-'}`,
          `Access Control: ${state.hasAccessControl ? 'true' : 'false'}`,
          `Sync: ${
            state.synchronizable === null
              ? '-'
              : state.synchronizable
              ? 'true'
              : 'false'
          }`,
          `UI Blocked: ${state.authenticationUIBlocked ? 'true' : 'false'}`,
        ];

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.summaryGrid}>
        {summaryBadges.map(badge => (
          <View key={badge} style={styles.summaryBadge}>
            <Text style={styles.summaryBadgeText}>{badge}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function AndroidKeychainStatusCard({
  title,
  state,
  maxHeight,
}: {
  title: string;
  state: AndroidDebugStateLike | null;
  maxHeight?: number;
}) {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  if (!state) {
    return null;
  }

  const compactItems: StatusGridItem[] = [
    {
      label: 'Platform',
      value: state.platform,
      allowHorizontalOverflow: true,
    },
    {
      label: 'Has Username Blob',
      value: state.hasUsername,
    },
    {
      label: 'Has Password Blob',
      value: state.hasPassword,
    },
    {
      label: 'Has Cipher Marker',
      value: state.hasCipherStorageMarker,
    },
    {
      label: 'Stored Cipher',
      value: state.storedCipherStorageName,
      allowHorizontalOverflow: true,
    },
    {
      label: 'Resolved Cipher',
      value: state.resolvedCipherStorageName,
      allowHorizontalOverflow: true,
    },
    {
      label: 'Username Bytes',
      value: state.usernameByteSize,
    },
    {
      label: 'Password Bytes',
      value: state.passwordByteSize,
    },
    {
      label: 'Has Keystore Alias',
      value: state.hasKeystoreAlias,
    },
    {
      label: 'Keystore Algorithm',
      value: state.keystoreKeyAlgorithm,
      allowHorizontalOverflow: true,
    },
    {
      label: 'Keystore Security Level',
      value: state.keystoreSecurityLevel,
      allowHorizontalOverflow: true,
    },
    {
      label: 'Keystore Inside Secure HW',
      value: state.keystoreInsideSecureHardware,
    },
    {
      label: 'Keystore Auth Required',
      value: state.keystoreUserAuthenticationRequired,
    },
    {
      label: 'Keystore Auth Validity Seconds',
      value: state.keystoreUserAuthenticationValidityDurationSeconds,
    },
    {
      label: 'Keystore Auth Type',
      value: state.keystoreUserAuthenticationType,
    },
    {
      label: 'Keystore Block Modes',
      value: state.keystoreBlockModes,
      selectable: true,
      allowHorizontalOverflow: true,
    },
    {
      label: 'Keystore Purposes',
      value: state.keystorePurposes,
    },
    {
      label: 'Keystore Current Compat',
      value: state.keystoreIsCompatibleWithCurrentCipher,
    },
    {
      label: 'Debug Supported',
      value: state.debugSupported,
    },
  ];

  return (
    <ScrollableStatusCard maxHeight={maxHeight}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <StatusRow
        label="Service"
        value={state.service}
        allowHorizontalOverflow
      />
      <CompactStatusGrid items={compactItems} />
      <StatusRow
        label="Username Base64"
        value={state.storedUsernameBase64}
        selectable
        allowHorizontalOverflow
      />
      <StatusRow
        label="Password Base64"
        value={state.storedPasswordBase64}
        selectable
        allowHorizontalOverflow
      />
      <StatusRow
        label="Cipher Marker Raw"
        value={state.storedCipherStorageMarkerValue}
        selectable
        allowHorizontalOverflow
      />
      <StatusRow
        label="Stored Cipher"
        value={state.storedCipherStorageName}
        allowHorizontalOverflow
      />
      <StatusRow
        label="Resolved Cipher"
        value={state.resolvedCipherStorageName}
        allowHorizontalOverflow
      />
      <StatusRow
        label="Cipher Candidates"
        value={state.candidateCipherStorageNames.join(' -> ')}
        selectable
        allowHorizontalOverflow
      />
      <StatusRow
        label="Cipher Resolution"
        value={state.cipherStorageResolutionStrategy}
        selectable
        allowHorizontalOverflow
      />
      <StatusRow
        label="Keystore Alias"
        value={state.keystoreAlias}
        selectable
        allowHorizontalOverflow
      />
      <StatusRow
        label="Public Key SHA256"
        value={state.keystorePublicKeySha256}
        selectable
        allowHorizontalOverflow
      />
      <StatusRow
        label="Keystore Debug Error"
        value={state.keystoreDebugErrorMessage}
        selectable
        allowHorizontalOverflow
      />
      <StatusRow
        label="Debug Error"
        value={state.debugErrorMessage}
        selectable
        allowHorizontalOverflow
      />
    </ScrollableStatusCard>
  );
}

function IOSKeychainStatusCard({
  title,
  state,
  maxHeight,
}: {
  title: string;
  state: IOSDebugStateLike | null;
  maxHeight?: number;
}) {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  if (!state) {
    return null;
  }

  const compactItems: StatusGridItem[] = [
    {
      label: 'Platform',
      value: state.platform,
      allowHorizontalOverflow: true,
    },
    {
      label: 'Has Username',
      value: state.hasUsername,
    },
    {
      label: 'Has Password',
      value: state.hasPassword,
    },
    {
      label: 'Storage',
      value: getKeychainStorageDebugLabel(state.storageName),
      allowHorizontalOverflow: true,
    },
    {
      label: 'Accessible',
      value: state.accessible,
      allowHorizontalOverflow: true,
    },
    {
      label: 'Synchronizable',
      value: state.synchronizable,
    },
    {
      label: 'Has Access Control',
      value: state.hasAccessControl,
    },
    {
      label: 'Auth UI Blocked',
      value: state.authenticationUIBlocked,
    },
    {
      label: 'Debug Supported',
      value: state.debugSupported,
    },
  ];

  return (
    <ScrollableStatusCard maxHeight={maxHeight}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <StatusRow
        label="Service"
        value={state.service}
        allowHorizontalOverflow
      />
      <CompactStatusGrid items={compactItems} />
      <StatusRow
        label="Account"
        value={state.account}
        selectable
        allowHorizontalOverflow
      />
      <StatusRow
        label="Access Group"
        value={state.accessGroup}
        selectable
        allowHorizontalOverflow
      />
      <StatusRow
        label="Access Control"
        value={state.accessControlDescription}
        selectable
        allowHorizontalOverflow
      />
      <StatusRow
        label="Access Control Constraints"
        value={state.accessControlConstraints}
        selectable
        allowHorizontalOverflow
      />
      <StatusRow
        label="Item Class"
        value={state.itemClass}
        selectable
        allowHorizontalOverflow
      />
      <StatusRow
        label="Native Debug Error"
        value={state.nativeDebugErrorMessage}
        selectable
        allowHorizontalOverflow
      />
      <StatusRow
        label="Debug Error"
        value={state.debugErrorMessage}
        selectable
        allowHorizontalOverflow
      />
    </ScrollableStatusCard>
  );
}

function KeychainStatusCard({
  title,
  state,
  maxHeight,
}: {
  title: string;
  state: DebugStateLike | null;
  maxHeight?: number;
}) {
  if (!state) {
    return null;
  }

  if (state.platform === 'android') {
    return (
      <AndroidKeychainStatusCard
        title={title}
        state={state}
        maxHeight={maxHeight}
      />
    );
  }

  return (
    <IOSKeychainStatusCard title={title} state={state} maxHeight={maxHeight} />
  );
}

function getBusinessApi(version: CurrentKeychainVersion) {
  switch (version) {
    case '10.0.0':
      return apisKeychainV10_0_0;
    case '9.0.0':
      return apisKeychainV9_0_0;
    case '8.2.0-fork':
    default:
      return apisKeychainV8_2_0;
  }
}

function makeInitialBusinessVersionState(): BusinessVersionState {
  return {
    debugState: null,
    decryptStates: makePromptPolicyState(() => ({
      plainPassword: null,
      resultMessage: null,
      errorMessage: null,
    })),
    rewriteResult: null,
    rewriteErrorMessage: null,
    lastActionErrorMessage: null,
  };
}

function makeSafeKeychainDebugLogState(
  state: apisKeychain.KeychainDebugState | null,
) {
  if (!state) {
    return null;
  }

  return {
    sourceLabel: state.sourceLabel,
    platform: state.platform,
    service: state.service,
    hasEntry: state.hasEntry,
    hasUsername: state.hasUsername,
    hasPassword: state.hasPassword,
    authenticationTypeLabel: state.authenticationTypeLabel,
    supportedBiometryType: state.supportedBiometryType,
    debugErrorMessage: state.debugErrorMessage,
    resolvedCipherStorageName:
      state.platform === 'android' ? state.resolvedCipherStorageName : null,
    storedCipherStorageName:
      state.platform === 'android' ? state.storedCipherStorageName : null,
    hasKeystoreAlias:
      state.platform === 'android' ? state.hasKeystoreAlias : null,
    keystoreUserAuthenticationRequired:
      state.platform === 'android'
        ? state.keystoreUserAuthenticationRequired
        : null,
    keystoreIsCompatibleWithCurrentCipher:
      state.platform === 'android'
        ? state.keystoreIsCompatibleWithCurrentCipher
        : null,
  };
}

export default function DevDataKeychain(): JSX.Element {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });
  const { rabbitCode } = useAppSecurityChain();
  const { height: windowHeight } = useWindowDimensions();
  const actionsSheetRef = useRef<AppBottomSheetModal>(null);
  const helpSheetRef = useRef<AppBottomSheetModal>(null);
  const {
    currentKeychainVersion,
    debugCurrentKeychainVersion,
    debugCurrentKeychainVersionField,
    canSwitchCurrentKeychainVersion,
    setCurrentKeychainVersion,
  } = useCurrentKeychainVersion();
  const {
    debugKeychainStorageByVersion,
    canSwitchDebugKeychainStorage,
    setDebugKeychainStorageForVersion,
  } = useDebugKeychainStorage();
  const [tabKey, setTabKey] = useState<TabKey>('current');
  const [helpSheetContext, setHelpSheetContext] =
    useState<HelpSheetContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [businessStates, setBusinessStates] = useState<
    Record<CurrentKeychainVersion, BusinessVersionState>
  >({
    '8.2.0-fork': makeInitialBusinessVersionState(),
    '9.0.0': makeInitialBusinessVersionState(),
    '10.0.0': makeInitialBusinessVersionState(),
  });
  const [businessPasswordVisibility, setBusinessPasswordVisibility] = useState<
    Record<CurrentKeychainVersion, PromptPolicyState<boolean>>
  >({
    '8.2.0-fork': makePromptPolicyState(() => false),
    '9.0.0': makePromptPolicyState(() => false),
    '10.0.0': makePromptPolicyState(() => false),
  });
  const [v9DefaultState, setV9DefaultState] =
    useState<apisKeychainDebug.KeychainDebugState | null>(null);
  const [v9ProbeState, setV9ProbeState] =
    useState<apisKeychainDebug.KeychainDebugState | null>(null);
  const [v9CurrentReadStates, setV9CurrentReadStates] = useState<
    PromptPolicyState<RawReadState>
  >(
    makePromptPolicyState(() => ({
      result: null,
      errorMessage: null,
    })),
  );
  const [v9ProbeReadStates, setV9ProbeReadStates] = useState<
    PromptPolicyState<RawReadState>
  >(
    makePromptPolicyState(() => ({
      result: null,
      errorMessage: null,
    })),
  );
  const [v9CurrentPasswordVisibility, setV9CurrentPasswordVisibility] =
    useState<PromptPolicyState<boolean>>(makePromptPolicyState(() => false));
  const [v9ProbePasswordVisibility, setV9ProbePasswordVisibility] = useState<
    PromptPolicyState<boolean>
  >(makePromptPolicyState(() => false));
  const [v9CurrentBusinessDecryptResult, setV9CurrentBusinessDecryptResult] =
    useState<V9CurrentBusinessDecryptResult | null>(null);
  const [
    v9CurrentBusinessDecryptErrorMessage,
    setV9CurrentBusinessDecryptErrorMessage,
  ] = useState<string | null>(null);
  const [
    isV9CurrentBusinessPasswordVisible,
    setIsV9CurrentBusinessPasswordVisible,
  ] = useState(false);
  const [isRabbitCodeVisible, setIsRabbitCodeVisible] = useState(false);
  const [v9CurrentRewriteResult, setV9CurrentRewriteResult] =
    useState<V9CurrentRewriteResult | null>(null);
  const [v9CurrentRewriteErrorMessage, setV9CurrentRewriteErrorMessage] =
    useState<string | null>(null);
  const [supportedStorageTypesByVersion, setSupportedStorageTypesByVersion] =
    useState<Record<CurrentKeychainVersion, KeychainStorageType[]>>({
      '8.2.0-fork': [apisKeychain.DEFAULT_KEYCHAIN_STORAGE_TYPE],
      '9.0.0': [apisKeychain.DEFAULT_KEYCHAIN_STORAGE_TYPE],
      '10.0.0': [apisKeychain.DEFAULT_KEYCHAIN_STORAGE_TYPE],
    });

  const actionsSheetMaxHeight = useMemo(
    () => Math.max(windowHeight - 160, 420),
    [windowHeight],
  );
  const detailCardMaxHeight = useMemo(
    () => Math.max(Math.floor(windowHeight * 0.5), 240),
    [windowHeight],
  );
  const resolvedTabVersion =
    tabKey === 'current' ? currentKeychainVersion : tabKey;

  const effectiveStorageByVersion = useMemo(
    () =>
      ({
        '8.2.0-fork': (() => {
          const supported = supportedStorageTypesByVersion['8.2.0-fork'];
          const configured = debugKeychainStorageByVersion['8.2.0-fork'];
          return supported.includes(configured)
            ? configured
            : supported[0] || apisKeychain.DEFAULT_KEYCHAIN_STORAGE_TYPE;
        })(),
        '9.0.0': (() => {
          const supported = supportedStorageTypesByVersion['9.0.0'];
          const configured = debugKeychainStorageByVersion['9.0.0'];
          return supported.includes(configured)
            ? configured
            : supported[0] || apisKeychain.DEFAULT_KEYCHAIN_STORAGE_TYPE;
        })(),
        '10.0.0': (() => {
          const supported = supportedStorageTypesByVersion['10.0.0'];
          const configured = debugKeychainStorageByVersion['10.0.0'];
          return supported.includes(configured)
            ? configured
            : supported[0] || apisKeychain.DEFAULT_KEYCHAIN_STORAGE_TYPE;
        })(),
      } satisfies Record<CurrentKeychainVersion, KeychainStorageType>),
    [debugKeychainStorageByVersion, supportedStorageTypesByVersion],
  );

  const openActionsSheet = useCallback(() => {
    actionsSheetRef.current?.present();
  }, []);

  const closeActionsSheet = useCallback(() => {
    actionsSheetRef.current?.close();
  }, []);

  const openHelpSheet = useCallback((context: HelpSheetContext) => {
    setHelpSheetContext(context);
    helpSheetRef.current?.present();
  }, []);

  const handleHelpSheetDismiss = useCallback(() => {
    setHelpSheetContext(null);
  }, []);

  const runSheetAction = useCallback(
    (action: () => void | Promise<void>) => {
      closeActionsSheet();
      setTimeout(() => {
        void action();
      }, 180);
    },
    [closeActionsSheet],
  );

  const updateBusinessState = useCallback(
    (
      version: CurrentKeychainVersion,
      updater:
        | Partial<BusinessVersionState>
        | ((prev: BusinessVersionState) => Partial<BusinessVersionState>),
    ) => {
      setBusinessStates(prev => {
        const nextPartial =
          typeof updater === 'function' ? updater(prev[version]) : updater;

        return {
          ...prev,
          [version]: {
            ...prev[version],
            ...nextPartial,
          },
        };
      });
    },
    [],
  );

  const updateBusinessDecryptState = useCallback(
    (
      version: CurrentKeychainVersion,
      policy: AndroidAuthPromptPolicy,
      updater:
        | Partial<BusinessDecryptState>
        | ((prev: BusinessDecryptState) => Partial<BusinessDecryptState>),
    ) => {
      setBusinessStates(prev => {
        const nextPartial =
          typeof updater === 'function'
            ? updater(prev[version].decryptStates[policy])
            : updater;

        return {
          ...prev,
          [version]: {
            ...prev[version],
            decryptStates: {
              ...prev[version].decryptStates,
              [policy]: {
                ...prev[version].decryptStates[policy],
                ...nextPartial,
              },
            },
          },
        };
      });
    },
    [],
  );

  const refreshState = useCallback(async () => {
    setIsLoading(true);
    try {
      const canReadOfficialV10State =
        !IS_ANDROID || currentKeychainVersion === '10.0.0';
      const [
        v8State,
        v9State,
        v10State,
        nextV10DefaultState,
        nextV10ProbeState,
        nextV8SupportedStorageTypes,
        nextV9SupportedStorageTypes,
        nextV10SupportedStorageTypes,
      ] = await Promise.all([
        apisKeychainV8_2_0.getKeychainDebugState(),
        apisKeychainV9_0_0.getKeychainDebugState(),
        canReadOfficialV10State
          ? apisKeychainV10_0_0.getKeychainDebugState()
          : Promise.resolve(null),
        canReadOfficialV10State
          ? apisKeychainDebug.getKeychainDebugState(
              apisKeychainDebug.KEYCHAIN_DEFAULT_SERVICE,
            )
          : Promise.resolve(null),
        canReadOfficialV10State
          ? apisKeychainDebug.getKeychainDebugState(
              apisKeychainDebug.KEYCHAIN_PROBE_SERVICE,
            )
          : Promise.resolve(null),
        apisKeychainV8_2_0.getSupportedStorageTypes(),
        apisKeychainV9_0_0.getSupportedStorageTypes(),
        apisKeychainV10_0_0.getSupportedStorageTypes(),
      ]);

      if (!canReadOfficialV10State) {
        logger.info(
          '[keychain-debug] skipped official v10 state refresh to avoid Android DataStore migration',
          { currentKeychainVersion },
        );
      }

      setBusinessStates(prev => ({
        ...prev,
        '8.2.0-fork': {
          ...prev['8.2.0-fork'],
          debugState: v8State,
        },
        '9.0.0': {
          ...prev['9.0.0'],
          debugState: v9State,
        },
        '10.0.0': {
          ...prev['10.0.0'],
          debugState: v10State,
        },
      }));
      setV9DefaultState(nextV10DefaultState);
      setV9ProbeState(nextV10ProbeState);
      setSupportedStorageTypesByVersion({
        '8.2.0-fork': nextV8SupportedStorageTypes,
        '9.0.0': nextV9SupportedStorageTypes,
        '10.0.0': nextV10SupportedStorageTypes,
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentKeychainVersion]);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const readCurrentKeychainAndDecryptForBusiness = useCallback(
    async (options?: { syncState?: boolean }) => {
      const { syncState = true } = options || {};
      const credentials = await apisKeychainDebug.readGenericPassword(
        apisKeychainDebug.KEYCHAIN_DEFAULT_SERVICE,
        {
          androidAuthPromptPolicy:
            apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY,
        },
      );
      const nextReadResult: V9ReadResult = {
        label: 'Current Service',
        credentials,
      };

      if (syncState) {
        setV9CurrentReadStates(prev => ({
          ...prev,
          [apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY]: {
            result: nextReadResult,
            errorMessage: null,
          },
        }));
        setV9CurrentPasswordVisibility(prev => ({
          ...prev,
          [apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY]: false,
        }));
      }

      if (!credentials) {
        if (syncState) {
          setV9CurrentBusinessDecryptResult(null);
          setIsV9CurrentBusinessPasswordVisible(false);
        }

        return {
          credentials,
          readResult: nextReadResult,
          decryptResult: null,
        };
      }

      const decryptedPayload =
        await apisKeychainV10_0_0.debugDecryptStoredPasswordPayload(
          credentials.password,
        );
      const nextDecryptResult: V9CurrentBusinessDecryptResult = {
        label: 'Current Service',
        credentials,
        decryptedPayload,
      };

      if (syncState) {
        setV9CurrentBusinessDecryptResult(nextDecryptResult);
        setIsV9CurrentBusinessPasswordVisible(false);
      }

      return {
        credentials,
        readResult: nextReadResult,
        decryptResult: nextDecryptResult,
      };
    },
    [],
  );

  const handleUnlockRequestProbe = useCallback(
    async (
      version: CurrentKeychainVersion,
      policy: AndroidAuthPromptPolicy = apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY,
      options?: {
        useCurrentFacade?: boolean;
      },
    ) => {
      const api = options?.useCurrentFacade
        ? apisKeychain
        : getBusinessApi(version);
      const useCurrentFacade = !!options?.useCurrentFacade;

      try {
        setIsLoading(true);
        updateBusinessDecryptState(version, policy, {
          resultMessage: null,
          errorMessage: null,
        });
        updateBusinessState(version, {
          lastActionErrorMessage: null,
        });
        let decryptedPassword = '';
        let callbackCalled = false;
        let callbackStorage: string | undefined;
        let callbackHasTrustedVaultKeyString = false;
        const startedAt = Date.now();

        logger.info('[keychain-debug] unlock request probe start', {
          version,
          currentKeychainVersion,
          useCurrentFacade,
          policy,
          authTypeLabel: apisKeychain.getAuthenticationTypeLabel(),
          selectedState: makeSafeKeychainDebugLogState(
            businessStates[version]?.debugState ?? null,
          ),
          currentState: makeSafeKeychainDebugLogState(
            businessStates[currentKeychainVersion]?.debugState ?? null,
          ),
          legacyV8State: makeSafeKeychainDebugLogState(
            businessStates['8.2.0-fork']?.debugState ?? null,
          ),
        });

        const requestResult = await api.requestGenericPassword({
          purpose: apisKeychain.RequestGenericPurpose.DECRYPT_PWD,
          androidAuthPromptPolicy: policy,
          shouldAttachTrustedVaultKeyString: !IS_ANDROID,
          skipPostDecryptKeychainRewrite: IS_ANDROID,
          onPlainPassword: (password, credentials) => {
            callbackCalled = true;
            decryptedPassword = password;
            callbackStorage =
              typeof credentials?.storage === 'string'
                ? credentials.storage
                : undefined;
            callbackHasTrustedVaultKeyString =
              typeof credentials?.vaultKeyString === 'string' &&
              !!credentials.vaultKeyString;
          },
        });
        const actionSuccess =
          !!requestResult &&
          'actionSuccess' in requestResult &&
          !!requestResult.actionSuccess;
        const resultStorage =
          requestResult &&
          typeof requestResult.storage === 'string' &&
          requestResult.storage
            ? requestResult.storage
            : callbackStorage;
        const resultMessage = [
          `callback=${callbackCalled ? 'true' : 'false'}`,
          `actionSuccess=${actionSuccess ? 'true' : 'false'}`,
          `storage=${resultStorage || '-'}`,
          `trustedVault=${callbackHasTrustedVaultKeyString ? 'true' : 'false'}`,
          `elapsedMs=${Date.now() - startedAt}`,
        ].join(', ');

        updateBusinessDecryptState(version, policy, {
          plainPassword: decryptedPassword || '(empty)',
          resultMessage,
          errorMessage: null,
        });
        setBusinessPasswordVisibility(prev => ({
          ...prev,
          [version]: {
            ...prev[version],
            [policy]: false,
          },
        }));
        toast.success(
          `${KEYCHAIN_VERSION_META[version].label} ${getPromptPolicyLabel(
            policy,
          )} unlock request ok`,
        );
        logger.info('[keychain-debug] unlock request probe success', {
          version,
          currentKeychainVersion,
          useCurrentFacade,
          policy,
          hasPlainPassword: !!decryptedPassword,
          callbackCalled,
          actionSuccess,
          storage: resultStorage,
          hasTrustedVaultKeyString: callbackHasTrustedVaultKeyString,
          elapsedMs: Date.now() - startedAt,
        });
        await refreshState();
      } catch (error) {
        const parsed = api.parseKeychainError(error);
        const message =
          parsed.sysMessage ||
          (error instanceof Error ? error.message : String(error));

        logger.warn('[keychain-debug] unlock request probe failed', {
          version,
          currentKeychainVersion,
          useCurrentFacade,
          policy,
          parsed,
          message,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : String(error),
        });
        updateBusinessDecryptState(version, policy, {
          resultMessage: null,
          errorMessage: message,
        });
        Alert.alert(
          `${KEYCHAIN_VERSION_META[version].label} ${getPromptPolicyLabel(
            policy,
          )} unlock request failed`,
          message,
        );
        await refreshState();
      } finally {
        setIsLoading(false);
      }
    },
    [
      businessStates,
      currentKeychainVersion,
      refreshState,
      updateBusinessDecryptState,
      updateBusinessState,
    ],
  );

  const handleUnlockPagePathProbe = useCallback(async () => {
    const version = currentKeychainVersion;
    const policy = apisKeychain.ANDROID_AUTH_PROMPT_POLICIES.INTERACTIVE_FIRST;

    try {
      setIsLoading(true);
      updateBusinessDecryptState(version, policy, {
        resultMessage: null,
        errorMessage: null,
      });
      let decryptedPassword = '';
      let callbackCalled = false;
      const startedAt = Date.now();

      logger.info('[keychain-debug] unlock page path probe start', {
        currentKeychainVersion,
        authTypeLabel: apisKeychain.getAuthenticationTypeLabel(),
      });

      const requestResult = await apisKeychain.requestGenericPassword({
        purpose: apisKeychain.RequestGenericPurpose.DECRYPT_PWD,
        shouldAttachTrustedVaultKeyString: !IS_ANDROID,
        skipPostDecryptKeychainRewrite: IS_ANDROID,
        onPlainPassword: password => {
          callbackCalled = true;
          decryptedPassword = password;
        },
      });

      const actionSuccess =
        !!requestResult &&
        'actionSuccess' in requestResult &&
        !!requestResult.actionSuccess;
      const resultMessage = [
        `callback=${callbackCalled ? 'true' : 'false'}`,
        `actionSuccess=${actionSuccess ? 'true' : 'false'}`,
        `elapsedMs=${Date.now() - startedAt}`,
      ].join(', ');

      updateBusinessDecryptState(version, policy, {
        plainPassword: decryptedPassword || '(empty)',
        resultMessage,
        errorMessage: null,
      });
      logger.info('[keychain-debug] unlock page path probe success', {
        currentKeychainVersion,
        callbackCalled,
        actionSuccess,
        hasPlainPassword: !!decryptedPassword,
        elapsedMs: Date.now() - startedAt,
      });
      Alert.alert('Unlock Page Path OK', resultMessage);
    } catch (error) {
      const parsed = apisKeychain.parseKeychainError(error);
      const message =
        parsed.sysMessage ||
        (error instanceof Error ? error.message : String(error));

      logger.warn('[keychain-debug] unlock page path probe failed', {
        currentKeychainVersion,
        parsed,
        message,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : String(error),
      });
      updateBusinessDecryptState(version, policy, {
        resultMessage: null,
        errorMessage: message,
      });
      Alert.alert('Unlock Page Path Failed', message);
    } finally {
      setIsLoading(false);
    }
  }, [currentKeychainVersion, updateBusinessDecryptState]);

  const handleBusinessReset = useCallback(
    async (version: CurrentKeychainVersion) => {
      const api = getBusinessApi(version);

      try {
        setIsLoading(true);
        await api.resetGenericPassword();
        updateBusinessState(version, {
          decryptStates: makePromptPolicyState(() => ({
            plainPassword: null,
            resultMessage: null,
            errorMessage: null,
          })),
          rewriteResult: null,
          rewriteErrorMessage: null,
          lastActionErrorMessage: null,
        });
        setBusinessPasswordVisibility(prev => ({
          ...prev,
          [version]: makePromptPolicyState(() => false),
        }));
        toast.success(`${KEYCHAIN_VERSION_META[version].label} cleared`);
        await refreshState();
      } finally {
        setIsLoading(false);
      }
    },
    [refreshState, updateBusinessState],
  );

  const handleDropCurrentMarker = useCallback(
    async (version: CurrentKeychainVersion) => {
      const api = getBusinessApi(version);
      const currentState = businessStates[version].debugState;

      try {
        setIsLoading(true);
        if (!currentState?.hasEntry) {
          throw new Error(
            'No current biometrics entry exists for com.debank. Create one before simulating legacy markerless data.',
          );
        }

        const wasMarkerMissing =
          currentState.platform === 'android' &&
          currentState.isCipherStorageMarkerMissing;
        await api.debugRemoveCurrentCipherStorageMarker();
        updateBusinessState(version, {
          decryptStates: makePromptPolicyState(() => ({
            plainPassword: null,
            resultMessage: null,
            errorMessage: null,
          })),
          rewriteResult: null,
          rewriteErrorMessage: null,
          lastActionErrorMessage: null,
        });
        setBusinessPasswordVisibility(prev => ({
          ...prev,
          [version]: makePromptPolicyState(() => false),
        }));
        toast.success(
          wasMarkerMissing
            ? `${KEYCHAIN_VERSION_META[version].label} marker already missing`
            : `${KEYCHAIN_VERSION_META[version].label} marker removed`,
        );
        Alert.alert(
          wasMarkerMissing ? 'Already markerless' : 'Legacy simulation ready',
          [
            'Current biometrics entry was left in place.',
            'Username/password blobs were not rewritten.',
            wasMarkerMissing
              ? 'Cipher marker was already missing before this step.'
              : 'Cipher marker was removed to emulate legacy Android data.',
          ].join('\n'),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        updateBusinessState(version, {
          lastActionErrorMessage: message,
        });
        Alert.alert(
          `${KEYCHAIN_VERSION_META[version].label} marker drop failed`,
          message,
        );
      } finally {
        await refreshState();
      }
    },
    [businessStates, refreshState, updateBusinessState],
  );

  const handleReadV9 = useCallback(
    async (
      target: 'current' | 'probe',
      policy: AndroidAuthPromptPolicy = apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY,
    ) => {
      const isCurrent = target === 'current';
      const service = isCurrent
        ? apisKeychainDebug.KEYCHAIN_DEFAULT_SERVICE
        : apisKeychainDebug.KEYCHAIN_PROBE_SERVICE;
      const label = isCurrent ? 'Current Service' : 'Probe Service';
      const promptPolicyLabel = getPromptPolicyLabel(policy);

      try {
        setIsLoading(true);
        if (isCurrent) {
          setV9CurrentReadStates(prev => ({
            ...prev,
            [policy]: {
              ...prev[policy],
              errorMessage: null,
            },
          }));
          setV9CurrentBusinessDecryptResult(null);
          setV9CurrentBusinessDecryptErrorMessage(null);
        } else {
          setV9ProbeReadStates(prev => ({
            ...prev,
            [policy]: {
              ...prev[policy],
              errorMessage: null,
            },
          }));
        }

        const credentials = await apisKeychainDebug.readGenericPassword(
          service,
          {
            androidAuthPromptPolicy: policy,
          },
        );
        const nextResult = { label, credentials };

        if (isCurrent) {
          setV9CurrentReadStates(prev => ({
            ...prev,
            [policy]: {
              result: nextResult,
              errorMessage: null,
            },
          }));
          setV9CurrentPasswordVisibility(prev => ({
            ...prev,
            [policy]: false,
          }));
          setIsV9CurrentBusinessPasswordVisible(false);
        } else {
          setV9ProbeReadStates(prev => ({
            ...prev,
            [policy]: {
              result: nextResult,
              errorMessage: null,
            },
          }));
          setV9ProbePasswordVisibility(prev => ({
            ...prev,
            [policy]: false,
          }));
        }

        toast.success(`Official keychain ${promptPolicyLabel} read completed`);
      } catch (error) {
        const message = getReadableErrorMessage(error);
        if (isCurrent) {
          setV9CurrentReadStates(prev => ({
            ...prev,
            [policy]: {
              ...prev[policy],
              errorMessage: message,
            },
          }));
        } else {
          setV9ProbeReadStates(prev => ({
            ...prev,
            [policy]: {
              ...prev[policy],
              errorMessage: message,
            },
          }));
        }
        Alert.alert(`${label} ${promptPolicyLabel} read failed`, message);
      } finally {
        await refreshState();
      }
    },
    [refreshState],
  );

  const handleReadCurrentV9AndDecrypt = useCallback(async () => {
    let hasReadCurrent = false;

    try {
      setIsLoading(true);
      setV9CurrentReadStates(prev => ({
        ...prev,
        [apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY]: {
          ...prev[apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY],
          errorMessage: null,
        },
      }));
      setV9CurrentBusinessDecryptResult(null);
      setV9CurrentBusinessDecryptErrorMessage(null);
      const result = await readCurrentKeychainAndDecryptForBusiness();
      hasReadCurrent = true;

      if (!result.credentials || !result.decryptResult) {
        setV9CurrentBusinessDecryptResult(null);
        setIsV9CurrentBusinessPasswordVisible(false);
        toast.success('Current service returned no credentials');
        return;
      }
      toast.success('Current service app decrypt completed');
    } catch (error) {
      const message = getReadableErrorMessage(error);
      if (hasReadCurrent) {
        setV9CurrentBusinessDecryptErrorMessage(message);
        Alert.alert('Current payload decrypt failed', message);
      } else {
        setV9CurrentReadStates(prev => ({
          ...prev,
          [apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY]: {
            ...prev[apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY],
            errorMessage: message,
          },
        }));
        Alert.alert('Current Service read failed', message);
      }
    } finally {
      await refreshState();
    }
  }, [readCurrentKeychainAndDecryptForBusiness, refreshState]);

  const handleRewriteCurrentViaKeychain = useCallback(async () => {
    const targetStorage = effectiveStorageByVersion['10.0.0'];

    try {
      setIsLoading(true);
      setV9CurrentReadStates(prev => ({
        ...prev,
        [apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY]: {
          ...prev[apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY],
          errorMessage: null,
        },
      }));
      setV9CurrentBusinessDecryptErrorMessage(null);
      setV9CurrentRewriteErrorMessage(null);
      setV9CurrentRewriteResult(null);

      const result = await readCurrentKeychainAndDecryptForBusiness({
        syncState: false,
      });

      if (!result.credentials || !result.decryptResult) {
        throw new Error('Current service returned no credentials to rewrite.');
      }

      const writeResult = await apisKeychainDebug.writeBiometricsEntry(
        result.decryptResult.decryptedPayload.password,
        apisKeychainDebug.KEYCHAIN_DEFAULT_SERVICE,
        {
          storage: targetStorage,
        },
      );

      if (!writeResult) {
        throw new Error(
          'Keychain returned false when rewriting the current service.',
        );
      }

      setV9CurrentReadStates(prev => ({
        ...prev,
        [apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY]: {
          result: null,
          errorMessage: null,
        },
      }));
      setV9CurrentBusinessDecryptResult(null);
      setV9CurrentPasswordVisibility(prev => ({
        ...prev,
        [apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY]: false,
      }));
      setIsV9CurrentBusinessPasswordVisible(false);
      setV9CurrentRewriteResult({
        label: 'Current Service',
        service: apisKeychainDebug.KEYCHAIN_DEFAULT_SERVICE,
        writeResult,
        targetStorage,
        rewrittenAt: new Date().toISOString(),
      });
      toast.success(
        `Current service rewritten as ${getKeychainStorageLabel(
          targetStorage,
        )}`,
      );
    } catch (error) {
      const message = getReadableErrorMessage(error);
      setV9CurrentRewriteErrorMessage(message);
      Alert.alert('Rewrite current via keychain failed', message);
    } finally {
      await refreshState();
    }
  }, [
    effectiveStorageByVersion,
    readCurrentKeychainAndDecryptForBusiness,
    refreshState,
  ]);

  const handleWriteV9Probe = useCallback(async () => {
    const targetStorage = effectiveStorageByVersion['10.0.0'];

    try {
      setIsLoading(true);
      await apisKeychainDebug.writeBiometricsEntry(undefined, undefined, {
        storage: targetStorage,
      });
      setV9ProbeReadStates(
        makePromptPolicyState(() => ({
          result: null,
          errorMessage: null,
        })),
      );
      setV9ProbePasswordVisibility(makePromptPolicyState(() => false));
      toast.success(
        `Official keychain probe entry written as ${getKeychainStorageLabel(
          targetStorage,
        )}`,
      );
    } catch (error) {
      const message = getReadableErrorMessage(error);
      setV9ProbeReadStates(prev => ({
        ...prev,
        [apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY]: {
          ...prev[apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY],
          errorMessage: message,
        },
      }));
      Alert.alert('Write probe failed', message);
    } finally {
      await refreshState();
    }
  }, [effectiveStorageByVersion, refreshState]);

  const handleRemoveV9ProbeMarker = useCallback(async () => {
    try {
      setIsLoading(true);
      const removed = await apisKeychainDebug.removeCipherMarker();
      setV9ProbeReadStates(
        makePromptPolicyState(() => ({
          result: null,
          errorMessage: null,
        })),
      );
      setV9ProbePasswordVisibility(makePromptPolicyState(() => false));
      toast.success(removed ? 'Probe marker removed' : 'Probe marker missing');
    } catch (error) {
      const message = getReadableErrorMessage(error);
      setV9ProbeReadStates(prev => ({
        ...prev,
        [apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY]: {
          ...prev[apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY],
          errorMessage: message,
        },
      }));
      Alert.alert('Remove probe marker failed', message);
    } finally {
      await refreshState();
    }
  }, [refreshState]);

  const handleClearV9Probe = useCallback(async () => {
    try {
      setIsLoading(true);
      await apisKeychainDebug.clearGenericPassword();
      setV9ProbeReadStates(
        makePromptPolicyState(() => ({
          result: null,
          errorMessage: null,
        })),
      );
      setV9ProbePasswordVisibility(makePromptPolicyState(() => false));
      toast.success('Official keychain probe entry cleared');
    } catch (error) {
      const message = getReadableErrorMessage(error);
      setV9ProbeReadStates(prev => ({
        ...prev,
        [apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY]: {
          ...prev[apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY],
          errorMessage: message,
        },
      }));
      Alert.alert('Clear probe failed', message);
    } finally {
      await refreshState();
    }
  }, [refreshState]);

  const handleBusinessRewrite = useCallback(
    async (
      version: CurrentKeychainVersion,
      options?: {
        targetStorage?: KeychainStorageType;
        persistStorageSelection?: boolean;
      },
    ) => {
      const api = getBusinessApi(version);
      const targetStorage =
        options?.targetStorage ?? effectiveStorageByVersion[version];
      let decryptedPassword = '';

      try {
        setIsLoading(true);
        updateBusinessState(version, {
          rewriteResult: null,
          rewriteErrorMessage: null,
          lastActionErrorMessage: null,
        });

        await api.requestGenericPassword({
          purpose: apisKeychain.RequestGenericPurpose.DECRYPT_PWD,
          androidAuthPromptPolicy:
            apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY,
          onPlainPassword: password => {
            decryptedPassword = password;
          },
        });

        if (!decryptedPassword) {
          throw new Error(
            'Current service returned no plain password to rewrite.',
          );
        }

        await api.setGenericPassword(
          decryptedPassword,
          apisKeychain.KEYCHAIN_AUTH_TYPES.BIOMETRICS,
          {
            storage: targetStorage,
          },
        );

        if (options?.persistStorageSelection) {
          setDebugKeychainStorageForVersion(version, targetStorage);
        }

        updateBusinessState(version, {
          rewriteResult: {
            label: 'Current Service',
            service: apisKeychain.KEYCHAIN_DEFAULT_SERVICE,
            targetStorage,
            rewrittenAt: new Date().toISOString(),
          },
          rewriteErrorMessage: null,
        });
        toast.success(
          `${
            KEYCHAIN_VERSION_META[version].label
          } rewritten as ${getKeychainStorageLabel(targetStorage)}`,
        );
      } catch (error) {
        const parsed = api.parseKeychainError(error);
        const message =
          parsed.sysMessage ||
          (error instanceof Error ? error.message : String(error));

        updateBusinessState(version, {
          rewriteErrorMessage: message,
        });
        Alert.alert(
          `${KEYCHAIN_VERSION_META[version].label} rewrite failed`,
          message,
        );
      } finally {
        await refreshState();
      }
    },
    [
      effectiveStorageByVersion,
      refreshState,
      setDebugKeychainStorageForVersion,
      updateBusinessState,
    ],
  );

  const handleMigrateCurrentToV10BiometricsOrPasscode =
    useCallback(async () => {
      const version: CurrentKeychainVersion = '10.0.0';
      const api = getBusinessApi(version);
      const targetStorage = effectiveStorageByVersion[version];
      let decryptedPassword = '';
      let vaultKeyString: string | undefined;

      try {
        setIsLoading(true);
        updateBusinessState(version, {
          rewriteResult: null,
          rewriteErrorMessage: null,
          lastActionErrorMessage: null,
        });

        await api.requestGenericPassword({
          purpose: apisKeychain.RequestGenericPurpose.DECRYPT_PWD,
          androidAuthPromptPolicy:
            apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY,
          onPlainPassword: (password, credentials) => {
            decryptedPassword = password;
            vaultKeyString =
              typeof credentials.vaultKeyString === 'string'
                ? credentials.vaultKeyString
                : undefined;
          },
        });

        if (!decryptedPassword) {
          throw new Error(
            'Current service returned no plain password to migrate.',
          );
        }

        await api.setGenericPassword(
          decryptedPassword,
          apisKeychain.KEYCHAIN_AUTH_TYPES.BIOMETRICS_OR_PASSCODE,
          {
            storage: targetStorage,
            vaultKeyString,
          },
        );

        setCurrentKeychainVersion(version);

        updateBusinessState(version, {
          rewriteResult: {
            label: 'v10 Bio+Device Migration',
            service: apisKeychain.KEYCHAIN_DEFAULT_SERVICE,
            targetStorage,
            targetAuthTypeLabel: apisKeychain.getAuthenticationTypeLabel(
              apisKeychain.KEYCHAIN_AUTH_TYPES.BIOMETRICS_OR_PASSCODE,
            ),
            rewrittenAt: new Date().toISOString(),
          },
          rewriteErrorMessage: null,
        });
        toast.success('v10 biometrics migration written');
        Alert.alert(
          'v10 migration written',
          [
            'Current com.debank entry was rewritten with BIOMETRICS_OR_PASSCODE.',
            'Restart the app, then test fingerprint and face from the unlock screen.',
            'If face still appears but cannot read the password, export this page for native debug details.',
          ].join('\n'),
        );
      } catch (error) {
        const parsed = api.parseKeychainError(error);
        const message =
          parsed.sysMessage ||
          (error instanceof Error ? error.message : String(error));

        updateBusinessState(version, {
          rewriteErrorMessage: message,
        });
        Alert.alert('v10 biometrics migration failed', message);
      } finally {
        await refreshState();
      }
    }, [
      effectiveStorageByVersion,
      refreshState,
      setCurrentKeychainVersion,
      updateBusinessState,
    ]);

  const handleChangeCurrentVersion = useCallback(
    async (nextVersion: CurrentKeychainVersion) => {
      if (nextVersion === currentKeychainVersion) {
        return;
      }

      setCurrentKeychainVersion(nextVersion);
      toast.success(`Current keychain switched to ${nextVersion}`);
      await refreshState();
    },
    [currentKeychainVersion, refreshState, setCurrentKeychainVersion],
  );

  const handleChangeVersionStorage = useCallback(
    async (
      version: CurrentKeychainVersion,
      nextStorage: KeychainStorageType,
    ) => {
      const currentStorage = effectiveStorageByVersion[version];
      if (nextStorage === currentStorage) {
        return;
      }

      const hasEntry = !!businessStates[version].debugState?.hasEntry;
      if (!hasEntry) {
        setDebugKeychainStorageForVersion(version, nextStorage);
        toast.success(
          `${
            KEYCHAIN_VERSION_META[version].label
          } target storage set to ${getKeychainStorageLabel(nextStorage)}`,
        );
        return;
      }

      await handleBusinessRewrite(version, {
        targetStorage: nextStorage,
        persistStorageSelection: true,
      });
    },
    [
      businessStates,
      effectiveStorageByVersion,
      handleBusinessRewrite,
      setDebugKeychainStorageForVersion,
    ],
  );

  const maskedV9CurrentBusinessPassword = maskSecret(
    v9CurrentBusinessDecryptResult?.decryptedPayload.password,
  );
  const maskedRabbitCode = maskSecret(rabbitCode);
  const includeSecretFieldsInExport = __DEV__;

  const debugExportPayload = useMemo<KeychainDebugExportPayload>(
    () => ({
      exportedAt: new Date().toISOString(),
      app: {
        platform: IS_ANDROID ? 'android' : 'ios',
        mode: __DEV__ ? 'development' : 'production',
        rabbitCode: rabbitCode || null,
        includesSecretFields: includeSecretFieldsInExport,
      },
      current: {
        effectiveVersion: currentKeychainVersion,
        configuredVersion: debugCurrentKeychainVersion,
        configuredVersionField: debugCurrentKeychainVersionField,
        canSwitchCurrentKeychainVersion,
        sourceLabel: apisKeychain.getCurrentKeychainSourceLabel(),
        defaultAndroidAuthPromptPolicy:
          apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY,
        configuredStorageByVersion: debugKeychainStorageByVersion,
        effectiveStorageByVersion,
        supportedStorageTypesByVersion,
      },
      versions: {
        v8_2_0: sanitizeBusinessVersionStateForExport(
          KEYCHAIN_VERSION_META['8.2.0-fork'].sourceLabel,
          businessStates['8.2.0-fork'],
          includeSecretFieldsInExport,
        ),
        v9_0_0: sanitizeBusinessVersionStateForExport(
          KEYCHAIN_VERSION_META['9.0.0'].sourceLabel,
          businessStates['9.0.0'],
          includeSecretFieldsInExport,
        ),
        v10_0_0: sanitizeBusinessVersionStateForExport(
          KEYCHAIN_VERSION_META['10.0.0'].sourceLabel,
          businessStates['10.0.0'],
          includeSecretFieldsInExport,
        ),
      },
      v10Raw: {
        defaultState: v9DefaultState,
        probeState: v9ProbeState,
        probeService: apisKeychainDebug.KEYCHAIN_PROBE_SERVICE,
        probePassword: includeSecretFieldsInExport
          ? apisKeychainDebug.KEYCHAIN_PROBE_PASSWORD
          : null,
        currentReadResult: sanitizeReadResult(
          v9CurrentReadStates[apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY]
            .result,
          includeSecretFieldsInExport,
        ),
        currentReadErrorMessage:
          v9CurrentReadStates[apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY]
            .errorMessage,
        probeReadResult: sanitizeReadResult(
          v9ProbeReadStates[apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY]
            .result,
          includeSecretFieldsInExport,
        ),
        probeReadErrorMessage:
          v9ProbeReadStates[apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY]
            .errorMessage,
        currentReadStates: mapPromptPolicyState(v9CurrentReadStates, state => ({
          ...state,
          result: sanitizeReadResult(state.result, includeSecretFieldsInExport),
        })),
        probeReadStates: mapPromptPolicyState(v9ProbeReadStates, state => ({
          ...state,
          result: sanitizeReadResult(state.result, includeSecretFieldsInExport),
        })),
        currentBusinessDecryptResult:
          sanitizeCurrentBusinessDecryptResultForExport(
            v9CurrentBusinessDecryptResult,
            includeSecretFieldsInExport,
          ),
        currentBusinessDecryptErrorMessage:
          v9CurrentBusinessDecryptErrorMessage,
        currentRewriteResult: v9CurrentRewriteResult,
        currentRewriteErrorMessage: v9CurrentRewriteErrorMessage,
        lastReadResult: sanitizeReadResult(
          v9CurrentReadStates[apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY]
            .result ||
            v9ProbeReadStates[apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY]
              .result,
          includeSecretFieldsInExport,
        ),
        lastErrorMessage:
          v9CurrentRewriteErrorMessage ||
          v9CurrentBusinessDecryptErrorMessage ||
          v9CurrentReadStates[apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY]
            .errorMessage ||
          v9ProbeReadStates[apisKeychain.DEFAULT_ANDROID_AUTH_PROMPT_POLICY]
            .errorMessage,
      },
      mockOldData: LEGACY_SIMULATION,
    }),
    [
      businessStates,
      canSwitchCurrentKeychainVersion,
      currentKeychainVersion,
      debugKeychainStorageByVersion,
      debugCurrentKeychainVersion,
      debugCurrentKeychainVersionField,
      effectiveStorageByVersion,
      includeSecretFieldsInExport,
      rabbitCode,
      supportedStorageTypesByVersion,
      v9CurrentBusinessDecryptErrorMessage,
      v9CurrentBusinessDecryptResult,
      v9CurrentReadStates,
      v9CurrentRewriteErrorMessage,
      v9CurrentRewriteResult,
      v9DefaultState,
      v9ProbeReadStates,
      v9ProbeState,
    ],
  );
  const debugExportJson = useMemo(
    () => JSON.stringify(debugExportPayload, null, 2),
    [debugExportPayload],
  );

  const handleCopyJson = useCallback(() => {
    Clipboard.setString(debugExportJson);
    toast.success('Copied');
  }, [debugExportJson]);

  const handleShareDebugInfo = useCallback(async () => {
    try {
      setIsLoading(true);

      const shareDir = await ensureKeychainDebugShareDir();
      const fileName = `rabby-keychain-debug-${dayjs().format(
        'YYYYMMDD-HHmmss',
      )}.json`;
      const filePath = `${shareDir}/${fileName}`;

      await RNFS.writeFile(filePath, debugExportJson, 'utf8');
      const result = await shareLocalFile({
        path: filePath,
        name: fileName,
        mimeType: 'application/json',
        title: 'Share keychain debug info',
        subject: fileName,
        message: 'Rabby keychain debug info',
      });

      if (result.dismissed) {
        return;
      }

      toast.success('Debug info ready to share');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Share debug info failed', message);
    } finally {
      setIsLoading(false);
    }
  }, [debugExportJson]);

  const renderStorageSelector = (version: CurrentKeychainVersion) => {
    const selectedStorage = effectiveStorageByVersion[version];
    const supportedStorageTypes = supportedStorageTypesByVersion[version];

    return (
      <View style={styles.versionSelectorGroup}>
        {supportedStorageTypes.map(storage => (
          <TouchableOpacity
            key={`${version}-${storage}`}
            activeOpacity={0.8}
            disabled={!canSwitchDebugKeychainStorage}
            style={styles.versionSelectorOption}
            onPress={() => {
              void handleChangeVersionStorage(version, storage);
            }}>
            <Radio
              title={getKeychainStorageLabel(storage)}
              checked={selectedStorage === storage}
              onPress={() => {
                void handleChangeVersionStorage(version, storage);
              }}
              checkedColor={colors2024['brand-default']}
              containerStyle={styles.versionRadio}
              textStyle={styles.versionRadioLabel}
            />
            <Text style={styles.versionRadioMeta}>
              {getKeychainStorageDescription(storage)}
            </Text>
            <Text style={styles.versionRadioMeta} selectable>
              Marker: {storage}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderBusinessVersionSection = (
    version: CurrentKeychainVersion,
    options?: {
      isCurrentAlias?: boolean;
    },
  ) => {
    const versionState = businessStates[version];
    const versionMeta = KEYCHAIN_VERSION_META[version];

    return (
      <>
        <View style={styles.summaryCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              {options?.isCurrentAlias
                ? `Current Keychain -> ${versionMeta.label}`
                : `${versionMeta.label} Business Path`}
            </Text>
            <SectionHelpButton
              onPress={() => {
                openHelpSheet({
                  topic: 'business-version',
                  version,
                  isCurrentAlias: !!options?.isCurrentAlias,
                });
              }}
            />
          </View>
          <StatusRow label="Version" value={versionMeta.label} />
          <StatusRow
            label="Source"
            value={versionMeta.sourceLabel}
            selectable
          />
          <StatusRow
            label="Selected Storage"
            value={getKeychainStorageLabel(effectiveStorageByVersion[version])}
          />
          {renderStorageSelector(version)}
        </View>

        <KeychainSummaryCard
          title={`${versionMeta.label} Summary`}
          state={versionState.debugState}
        />

        <KeychainStatusCard
          title={`${versionMeta.label} Entry Detail`}
          state={versionState.debugState}
          maxHeight={detailCardMaxHeight}
        />

        {ANDROID_AUTH_PROMPT_POLICY_OPTIONS.map(option => {
          const decryptState = versionState.decryptStates[option.key];
          if (
            !decryptState.plainPassword &&
            !decryptState.resultMessage &&
            !decryptState.errorMessage
          ) {
            return null;
          }

          const maskedPlainPassword = maskSecret(decryptState.plainPassword);

          return (
            <View key={option.key} style={styles.statusCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>
                  {option.label} Unlock Request Probe
                </Text>
                {__DEV__ && decryptState.plainPassword ? (
                  <EyeToggleButton
                    visible={businessPasswordVisibility[version][option.key]}
                    onPress={() => {
                      setBusinessPasswordVisibility(prev => ({
                        ...prev,
                        [version]: {
                          ...prev[version],
                          [option.key]: !prev[version][option.key],
                        },
                      }));
                    }}
                  />
                ) : null}
              </View>
              {decryptState.plainPassword ? (
                <>
                  <Text style={styles.plainPasswordValue} selectable={__DEV__}>
                    {__DEV__ && businessPasswordVisibility[version][option.key]
                      ? decryptState.plainPassword
                      : maskedPlainPassword}
                  </Text>
                </>
              ) : null}
              {decryptState.resultMessage ? (
                <Text style={styles.resultText} selectable>
                  {decryptState.resultMessage}
                </Text>
              ) : null}
              {decryptState.errorMessage ? (
                <Text style={styles.errorText} selectable>
                  {decryptState.errorMessage}
                </Text>
              ) : null}
            </View>
          );
        })}

        {versionState.lastActionErrorMessage ? (
          <View style={styles.statusCard}>
            <Text style={styles.sectionTitle}>Last Action Error</Text>
            <Text style={styles.errorText} selectable>
              {versionState.lastActionErrorMessage}
            </Text>
          </View>
        ) : null}

        {versionState.rewriteResult ? (
          <View style={styles.statusCard}>
            <Text style={styles.sectionTitle}>Current Service Rewrite</Text>
            <StatusRow
              label="Service"
              value={versionState.rewriteResult.service}
            />
            <StatusRow
              label="Target Storage"
              value={getKeychainStorageLabel(
                versionState.rewriteResult.targetStorage,
              )}
            />
            <StatusRow
              label="Target Marker"
              value={versionState.rewriteResult.targetStorage}
              selectable
            />
            {versionState.rewriteResult.targetAuthTypeLabel ? (
              <StatusRow
                label="Target Auth"
                value={versionState.rewriteResult.targetAuthTypeLabel}
              />
            ) : null}
            <StatusRow
              label="Rewritten At"
              value={versionState.rewriteResult.rewrittenAt}
              selectable
              allowHorizontalOverflow
            />
          </View>
        ) : null}

        {versionState.rewriteErrorMessage ? (
          <View style={styles.statusCard}>
            <Text style={styles.sectionTitle}>
              Current Service Rewrite Error
            </Text>
            <Text style={styles.errorText} selectable>
              {versionState.rewriteErrorMessage}
            </Text>
          </View>
        ) : null}
      </>
    );
  };

  const renderV9RawSection = () => {
    return (
      <>
        <View style={styles.sectionStandaloneHeader}>
          <Text style={styles.sectionTitle}>Official v10 Raw</Text>
          <SectionHelpButton
            onPress={() => {
              openHelpSheet({
                topic: 'raw-v10',
              });
            }}
          />
        </View>
        <KeychainSummaryCard
          title="Official v10 Raw Current Service"
          state={v9DefaultState}
        />
        <KeychainSummaryCard
          title="Official v10 Raw Probe Service"
          state={v9ProbeState}
        />

        <KeychainStatusCard
          title="Official v10 Raw Current Detail"
          state={v9DefaultState}
          maxHeight={detailCardMaxHeight}
        />
        <KeychainStatusCard
          title="Official v10 Raw Probe Detail"
          state={v9ProbeState}
          maxHeight={detailCardMaxHeight}
        />

        {ANDROID_AUTH_PROMPT_POLICY_OPTIONS.map(option => (
          <React.Fragment key={`current-${option.key}`}>
            <KeychainReadResultCard
              title={`Official v10 Raw Current Read (${option.label})`}
              result={v9CurrentReadStates[option.key].result}
              isPasswordVisible={v9CurrentPasswordVisibility[option.key]}
              maxHeight={detailCardMaxHeight}
              onTogglePasswordVisibility={() => {
                setV9CurrentPasswordVisibility(prev => ({
                  ...prev,
                  [option.key]: !prev[option.key],
                }));
              }}
            />

            {v9CurrentReadStates[option.key].errorMessage ? (
              <View style={styles.statusCard}>
                <Text style={styles.sectionTitle}>
                  Official v10 Raw Current Read Error ({option.label})
                </Text>
                <Text style={styles.errorText} selectable>
                  {v9CurrentReadStates[option.key].errorMessage}
                </Text>
              </View>
            ) : null}
          </React.Fragment>
        ))}

        {ANDROID_AUTH_PROMPT_POLICY_OPTIONS.map(option => (
          <React.Fragment key={`probe-${option.key}`}>
            <KeychainReadResultCard
              title={`Official v10 Raw Probe Read (${option.label})`}
              result={v9ProbeReadStates[option.key].result}
              isPasswordVisible={v9ProbePasswordVisibility[option.key]}
              maxHeight={detailCardMaxHeight}
              onTogglePasswordVisibility={() => {
                setV9ProbePasswordVisibility(prev => ({
                  ...prev,
                  [option.key]: !prev[option.key],
                }));
              }}
            />

            {v9ProbeReadStates[option.key].errorMessage ? (
              <View style={styles.statusCard}>
                <Text style={styles.sectionTitle}>
                  Official v10 Probe Read Error ({option.label})
                </Text>
                <Text style={styles.errorText} selectable>
                  {v9ProbeReadStates[option.key].errorMessage}
                </Text>
              </View>
            ) : null}
          </React.Fragment>
        ))}

        {v9CurrentBusinessDecryptResult ? (
          <ScrollableStatusCard maxHeight={detailCardMaxHeight}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                Current Service App Decrypt
              </Text>
              {__DEV__ ? (
                <EyeToggleButton
                  visible={isV9CurrentBusinessPasswordVisible}
                  onPress={() => {
                    setIsV9CurrentBusinessPasswordVisible(visible => !visible);
                  }}
                />
              ) : null}
            </View>
            <CompactStatusGrid
              items={[
                {
                  label: 'Target',
                  value: v9CurrentBusinessDecryptResult.label,
                  allowHorizontalOverflow: true,
                },
                {
                  label: 'Storage',
                  value: v9CurrentBusinessDecryptResult.credentials.storage,
                  allowHorizontalOverflow: true,
                },
              ]}
            />
            <StatusRow
              label="Service"
              value={v9CurrentBusinessDecryptResult.credentials.service}
              allowHorizontalOverflow
            />
            <StatusRow
              label="Encrypted Payload JSON"
              value={v9CurrentBusinessDecryptResult.credentials.password}
              selectable
              allowHorizontalOverflow
            />
            <Text style={styles.statusLabel}>Final Plain Password</Text>
            <Text
              style={[
                styles.plainPasswordValue,
                styles.plainPasswordOverflowValue,
              ]}
              selectable={__DEV__}>
              {__DEV__ && isV9CurrentBusinessPasswordVisible
                ? v9CurrentBusinessDecryptResult.decryptedPayload.password
                : maskedV9CurrentBusinessPassword}
            </Text>
          </ScrollableStatusCard>
        ) : null}

        {v9CurrentRewriteResult ? (
          <ScrollableStatusCard maxHeight={detailCardMaxHeight}>
            <Text style={styles.sectionTitle}>Current Service Rewrite</Text>
            <CompactStatusGrid
              items={[
                {
                  label: 'Target',
                  value: v9CurrentRewriteResult.label,
                  allowHorizontalOverflow: true,
                },
                {
                  label: 'Write Result Storage',
                  value: v9CurrentRewriteResult.writeResult.storage,
                  allowHorizontalOverflow: true,
                },
                {
                  label: 'Target Storage',
                  value: getKeychainStorageLabel(
                    v9CurrentRewriteResult.targetStorage,
                  ),
                  allowHorizontalOverflow: true,
                },
              ]}
            />
            <StatusRow
              label="Requested Service"
              value={v9CurrentRewriteResult.service}
              allowHorizontalOverflow
            />
            <StatusRow
              label="Write Result Service"
              value={v9CurrentRewriteResult.writeResult.service}
              allowHorizontalOverflow
            />
            <StatusRow
              label="Target Marker"
              value={v9CurrentRewriteResult.targetStorage}
              allowHorizontalOverflow
            />
            <StatusRow
              label="Rewritten At"
              value={v9CurrentRewriteResult.rewrittenAt}
              selectable
              allowHorizontalOverflow
            />
          </ScrollableStatusCard>
        ) : null}

        {v9CurrentBusinessDecryptErrorMessage ? (
          <View style={styles.statusCard}>
            <Text style={styles.sectionTitle}>
              Current Service App Decrypt Error
            </Text>
            <Text style={styles.errorText} selectable>
              {v9CurrentBusinessDecryptErrorMessage}
            </Text>
          </View>
        ) : null}

        {v9CurrentRewriteErrorMessage ? (
          <View style={styles.statusCard}>
            <Text style={styles.sectionTitle}>
              Current Service Rewrite Error
            </Text>
            <Text style={styles.errorText} selectable>
              {v9CurrentRewriteErrorMessage}
            </Text>
          </View>
        ) : null}
      </>
    );
  };

  const renderPromptPolicyHelpSection = () => {
    return (
      <ActionSheetSection
        title="Android Prompt Policies"
        desc="These labels map to the Android auth prompt behavior used by this debug page.">
        {ANDROID_AUTH_PROMPT_POLICY_OPTIONS.map(option => (
          <View key={option.key} style={styles.policyProbeRow}>
            <Text style={styles.policyProbeTitle}>{option.label}</Text>
            <Text style={styles.policyProbeDesc}>{option.description}</Text>
          </View>
        ))}
      </ActionSheetSection>
    );
  };

  const renderManualTestHelpSection = (
    title: string,
    steps: readonly string[],
    expectations: readonly string[],
  ) => {
    return (
      <ActionSheetSection title={title}>
        <Text style={styles.sheetListLabel}>Steps</Text>
        {steps.map(step => (
          <Text key={step} style={styles.sheetListLine}>
            {step}
          </Text>
        ))}
        <Text style={styles.sheetListLabel}>Expected</Text>
        {expectations.map(expectation => (
          <Text key={expectation} style={styles.sheetListLine}>
            {expectation}
          </Text>
        ))}
      </ActionSheetSection>
    );
  };

  const renderHelpSheetContent = () => {
    if (!helpSheetContext) {
      return null;
    }

    if (helpSheetContext.topic === 'current-selector') {
      return (
        <BottomSheetScrollView
          style={styles.sheetScrollView}
          contentContainerStyle={styles.sheetScrollContent}>
          <AutoLockView>
            <AppBottomSheetModalTitle title="Current Keychain Help" />

            <ActionSheetSection
              title="Current Selector"
              desc="This experimental selector only changes the business-facing keychain facade on non-public builds.">
              <Text style={styles.sheetListLine}>
                Effective: the keychain version currently used by
                `apisKeychain`.
              </Text>
              <Text style={styles.sheetListLine}>
                Source: the backing package or wrapper behind that effective
                version.
              </Text>
              <Text style={styles.sheetListLine}>
                Switching the radio option takes effect immediately for unlock,
                biometrics setup, and other business entry points.
              </Text>
              <Text style={styles.sheetListLine}>
                {canSwitchCurrentKeychainVersion
                  ? 'This build can switch between 8.2.0-fork, 9.0.0, and 10.0.0 for migration testing.'
                  : 'Public builds ignore this selector and stay pinned to the default business path.'}
              </Text>
              <Text style={styles.sheetListLine}>
                Android entry storage is primarily recorded inside the system
                keychain marker (`storedCipherStorageName` /
                `storedCipherStorageMarkerValue`), not in Rabby business
                storage.
              </Text>
              <Text style={styles.sheetListLine}>
                The per-version rewrite target storage below is only a debug
                preference stored in app settings. Existing entries still report
                their actual storage from the native keychain state.
              </Text>
            </ActionSheetSection>
          </AutoLockView>
        </BottomSheetScrollView>
      );
    }

    if (helpSheetContext.topic === 'business-version') {
      const versionMeta = KEYCHAIN_VERSION_META[helpSheetContext.version];

      return (
        <BottomSheetScrollView
          style={styles.sheetScrollView}
          contentContainerStyle={styles.sheetScrollContent}>
          <AutoLockView>
            <AppBottomSheetModalTitle title={`${versionMeta.label} Help`} />

            <ActionSheetSection
              title="Business Path"
              desc={
                helpSheetContext.isCurrentAlias
                  ? `Current currently resolves to ${versionMeta.label}.`
                  : versionMeta.description
              }>
              <Text style={styles.sheetListLine}>
                This section follows the Rabby business wrapper, not raw
                `react-native-keychain` APIs.
              </Text>
              <Text style={styles.sheetListLine}>
                Unlock, biometrics setup, and business-side password decrypt
                flow through this version.
              </Text>
              <Text style={styles.sheetListLine}>
                Use the bottom Actions button for unlock request, clear, and
                marker-drop operations.
              </Text>
              <Text style={styles.sheetListLine}>
                Rewrite actions use the selected target storage for this
                version. Compare the resulting marker and native detail card
                after each rewrite.
              </Text>
            </ActionSheetSection>

            {renderPromptPolicyHelpSection()}

            {renderManualTestHelpSection(
              'Manual Test: Repeat Unlock Request Prompt',
              REPEAT_DECRYPT_TEST_STEPS,
              REPEAT_DECRYPT_EXPECTATIONS[helpSheetContext.version],
            )}

            {renderManualTestHelpSection(
              'Manual Test: Allow Authenticated Session Reuse',
              SESSION_REUSE_TEST_STEPS,
              SESSION_REUSE_EXPECTATIONS,
            )}
          </AutoLockView>
        </BottomSheetScrollView>
      );
    }

    return (
      <BottomSheetScrollView
        style={styles.sheetScrollView}
        contentContainerStyle={styles.sheetScrollContent}>
        <AutoLockView>
          <AppBottomSheetModalTitle title="Official v10 Raw Help" />

          <ActionSheetSection
            title="Raw Official Package"
            desc="This section talks directly to the official `react-native-keychain@10.0.0` package and stays outside the Rabby business wrapper.">
            <Text style={styles.sheetListLine}>
              Current Service: reads the real `com.debank` entry already used by
              the app.
            </Text>
            <Text style={styles.sheetListLine}>
              Probe Service: writes and reads a dedicated debug entry without
              touching the business payload.
            </Text>
            <Text style={styles.sheetListLine}>
              Use the bottom Actions button for raw reads, probe writes, and
              current-service rewrite experiments.
            </Text>
            <Text style={styles.sheetListLine}>
              Official v10 on Android can still register multiple storage
              implementations. The selected 10.0.0 target storage is reused by
              both the business wrapper and the raw rewrite/write probes.
            </Text>
          </ActionSheetSection>

          {renderPromptPolicyHelpSection()}

          {renderManualTestHelpSection(
            'Manual Test: Repeat Raw Current Read Prompt',
            REPEAT_RAW_READ_TEST_STEPS,
            REPEAT_RAW_READ_EXPECTATIONS,
          )}

          {renderManualTestHelpSection(
            'Manual Test: Raw Allow Authenticated Session Reuse',
            SESSION_REUSE_TEST_STEPS,
            SESSION_REUSE_EXPECTATIONS,
          )}
        </AutoLockView>
      </BottomSheetScrollView>
    );
  };

  const renderSelectedTab = () => {
    if (tabKey === '10.0.0') {
      return (
        <>
          {renderBusinessVersionSection('10.0.0', {
            isCurrentAlias: false,
          })}
          {renderV9RawSection()}
        </>
      );
    }

    return renderBusinessVersionSection(resolvedTabVersion, {
      isCurrentAlias: tabKey === 'current',
    });
  };

  const renderActionsSheetContent = () => {
    const versionMeta = KEYCHAIN_VERSION_META[resolvedTabVersion];
    const hasBusinessEntry =
      !!businessStates[resolvedTabVersion].debugState?.hasEntry;
    const useCurrentFacadeForBusinessActions =
      resolvedTabVersion === currentKeychainVersion;
    const hasLegacyRecoverableBusinessEntry =
      useCurrentFacadeForBusinessActions &&
      !!businessStates['8.2.0-fork'].debugState?.hasEntry;
    const canTryBusinessDecrypt =
      hasBusinessEntry || hasLegacyRecoverableBusinessEntry;
    const businessActionApiLabel = useCurrentFacadeForBusinessActions
      ? 'current app facade'
      : `${versionMeta.label} raw wrapper`;

    return (
      <BottomSheetScrollView
        style={styles.sheetScrollView}
        contentContainerStyle={styles.sheetScrollContent}>
        <AutoLockView>
          <AppBottomSheetModalTitle
            title={`${
              tabKey === 'current' ? 'Current' : versionMeta.label
            } Actions`}
          />

          <ActionSheetSection
            title="Export"
            desc="Refresh the snapshot, export the combined debug payload, or copy it for quick diffing.">
            <Button
              title={isLoading ? 'Working...' : 'Refresh State'}
              type="ghost"
              height={40}
              disabled={isLoading}
              containerStyle={styles.sheetActionButton}
              onPress={() => {
                runSheetAction(refreshState);
              }}
            />
            <Button
              title="Share Debug Info"
              type="primary"
              height={40}
              disabled={isLoading}
              containerStyle={styles.sheetPrimaryButton}
              onPress={() => {
                runSheetAction(handleShareDebugInfo);
              }}
            />
            <Button
              title="Copy Export JSON"
              type="ghost"
              height={40}
              containerStyle={styles.sheetActionButton}
              onPress={() => {
                runSheetAction(async () => {
                  handleCopyJson();
                });
              }}
            />
          </ActionSheetSection>

          <ActionSheetSection
            title={`${versionMeta.label} Business Actions`}
            desc={`These actions use the ${businessActionApiLabel} and affect the current \`com.debank\` entry. Selected storage: ${getKeychainStorageLabel(
              effectiveStorageByVersion[resolvedTabVersion],
            )}.`}>
            {useCurrentFacadeForBusinessActions ? (
              <Button
                title="Unlock Page Path"
                type="primary"
                disabled={!canTryBusinessDecrypt || isLoading}
                height={40}
                containerStyle={styles.sheetPrimaryButton}
                onPress={() => {
                  runSheetAction(handleUnlockPagePathProbe);
                }}
              />
            ) : null}
            <View style={styles.actionsRow}>
              <Button
                title={
                  useCurrentFacadeForBusinessActions
                    ? 'Unlock Request'
                    : 'Raw Unlock Request'
                }
                type="primary"
                disabled={!canTryBusinessDecrypt || isLoading}
                height={40}
                containerStyle={styles.actionButton}
                onPress={() => {
                  runSheetAction(() =>
                    handleUnlockRequestProbe(
                      resolvedTabVersion,
                      apisKeychain.ANDROID_AUTH_PROMPT_POLICIES
                        .INTERACTIVE_FIRST,
                      {
                        useCurrentFacade: useCurrentFacadeForBusinessActions,
                      },
                    ),
                  );
                }}
              />
              <Button
                title={
                  useCurrentFacadeForBusinessActions
                    ? 'Unlock Request Session'
                    : 'Raw Unlock Request Session'
                }
                type="ghost"
                disabled={!canTryBusinessDecrypt || isLoading || !IS_ANDROID}
                height={40}
                containerStyle={styles.actionButton}
                onPress={() => {
                  runSheetAction(() =>
                    handleUnlockRequestProbe(
                      resolvedTabVersion,
                      apisKeychain.ANDROID_AUTH_PROMPT_POLICIES
                        .ALLOW_AUTHENTICATED_SESSION_REUSE,
                      {
                        useCurrentFacade: useCurrentFacadeForBusinessActions,
                      },
                    ),
                  );
                }}
              />
            </View>
            <Button
              title="Rewrite Current"
              type="primary"
              height={40}
              disabled={!hasBusinessEntry || isLoading}
              containerStyle={styles.sheetActionButton}
              onPress={() => {
                runSheetAction(() => handleBusinessRewrite(resolvedTabVersion));
              }}
            />
            <Button
              title="Clear Keychain"
              type="warning"
              height={40}
              disabled={isLoading}
              containerStyle={styles.sheetActionButton}
              onPress={() => {
                runSheetAction(() => handleBusinessReset(resolvedTabVersion));
              }}
            />
            <Button
              title={IS_ANDROID ? 'Drop Current Marker' : 'Android Only'}
              type="warning"
              height={40}
              disabled={!IS_ANDROID || isLoading || !hasBusinessEntry}
              containerStyle={styles.sheetActionButton}
              onPress={() => {
                runSheetAction(() =>
                  handleDropCurrentMarker(resolvedTabVersion),
                );
              }}
            />
          </ActionSheetSection>

          {tabKey === '10.0.0' ? (
            <ActionSheetSection
              title="v10 Migration Test"
              desc="Rewrite the real `com.debank` entry with the v10 BIOMETRICS_OR_PASSCODE profile for restart testing.">
              <Button
                title="Migrate Current to Bio+Device"
                type="warning"
                height={40}
                disabled={!IS_ANDROID || isLoading || !hasBusinessEntry}
                containerStyle={styles.sheetActionButton}
                onPress={() => {
                  runSheetAction(handleMigrateCurrentToV10BiometricsOrPasscode);
                }}
              />
            </ActionSheetSection>
          ) : null}

          {tabKey === '10.0.0' ? (
            <ActionSheetSection
              title="Official v10 Raw Actions"
              desc={`These are raw \`react-native-keychain@10.0.0\` experiments for comparing Android storage behavior. Selected storage: ${getKeychainStorageLabel(
                effectiveStorageByVersion['10.0.0'],
              )}.`}>
              <View style={styles.actionsRow}>
                <Button
                  title="Read Current"
                  type="primary"
                  height={40}
                  disabled={isLoading}
                  containerStyle={styles.actionButton}
                  onPress={() => {
                    runSheetAction(() =>
                      handleReadV9(
                        'current',
                        apisKeychain.ANDROID_AUTH_PROMPT_POLICIES
                          .INTERACTIVE_FIRST,
                      ),
                    );
                  }}
                />
                <Button
                  title="Read Current Session"
                  type="ghost"
                  height={40}
                  disabled={isLoading || !IS_ANDROID}
                  containerStyle={styles.actionButton}
                  onPress={() => {
                    runSheetAction(() =>
                      handleReadV9(
                        'current',
                        apisKeychain.ANDROID_AUTH_PROMPT_POLICIES
                          .ALLOW_AUTHENTICATED_SESSION_REUSE,
                      ),
                    );
                  }}
                />
              </View>
              <View style={styles.actionsRow}>
                <Button
                  title="Read Probe"
                  type="primary"
                  height={40}
                  disabled={isLoading}
                  containerStyle={styles.actionButton}
                  onPress={() => {
                    runSheetAction(() =>
                      handleReadV9(
                        'probe',
                        apisKeychain.ANDROID_AUTH_PROMPT_POLICIES
                          .INTERACTIVE_FIRST,
                      ),
                    );
                  }}
                />
                <Button
                  title="Read Probe Session"
                  type="ghost"
                  height={40}
                  disabled={isLoading || !IS_ANDROID}
                  containerStyle={styles.actionButton}
                  onPress={() => {
                    runSheetAction(() =>
                      handleReadV9(
                        'probe',
                        apisKeychain.ANDROID_AUTH_PROMPT_POLICIES
                          .ALLOW_AUTHENTICATED_SESSION_REUSE,
                      ),
                    );
                  }}
                />
              </View>
              <Button
                title="Read + App Decrypt Current (Strict)"
                type="primary"
                height={40}
                disabled={isLoading}
                containerStyle={styles.sheetActionButton}
                onPress={() => {
                  runSheetAction(handleReadCurrentV9AndDecrypt);
                }}
              />
              <Button
                title="Rewrite Current via Raw Official Keychain"
                type="warning"
                height={40}
                disabled={isLoading || !v9DefaultState?.hasEntry}
                containerStyle={styles.sheetActionButton}
                onPress={() => {
                  runSheetAction(handleRewriteCurrentViaKeychain);
                }}
              />
              <View style={styles.actionsRow}>
                <Button
                  title="Write Probe"
                  type="primary"
                  height={40}
                  disabled={isLoading || !IS_ANDROID}
                  containerStyle={styles.actionButton}
                  onPress={() => {
                    runSheetAction(handleWriteV9Probe);
                  }}
                />
                <Button
                  title="Drop Probe Marker"
                  type="warning"
                  height={40}
                  disabled={isLoading || !IS_ANDROID}
                  containerStyle={styles.actionButton}
                  onPress={() => {
                    runSheetAction(handleRemoveV9ProbeMarker);
                  }}
                />
              </View>
              <Button
                title="Clear Probe"
                type="warning"
                height={40}
                disabled={isLoading}
                containerStyle={styles.sheetActionButton}
                onPress={() => {
                  runSheetAction(handleClearV9Probe);
                }}
              />
            </ActionSheetSection>
          ) : resolvedTabVersion === '10.0.0' ? (
            <ActionSheetSection
              title="Official v10 Raw Actions"
              desc="Open the `10.0.0` tab when you need raw official current/probe operations. The Current tab only exposes the selected business path."
            />
          ) : null}
        </AutoLockView>
      </BottomSheetScrollView>
    );
  };

  return (
    <FooterButtonScreenContainer
      as="View"
      style={styles.screen}
      buttonProps={{
        title: 'Actions',
        disabled: isLoading,
        onPress: openActionsSheet,
      }}
      footerContainerStyle={styles.footerContainer}>
      <ScrollView
        horizontal={false}
        contentContainerStyle={styles.scrollView}
        nestedScrollEnabled>
        <View style={styles.summaryCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Current Keychain</Text>
            <SectionHelpButton
              onPress={() => {
                openHelpSheet({
                  topic: 'current-selector',
                });
              }}
            />
          </View>
          <StatusRow label="Effective" value={currentKeychainVersion} />
          <StatusRow
            label="Debug Field"
            value={debugCurrentKeychainVersionField}
            selectable
          />
          <StatusRow
            label="Source"
            value={apisKeychain.getCurrentKeychainSourceLabel()}
            selectable
          />
          <View style={styles.statusRow}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.statusLabel}>RABBY_MOBILE_CODE</Text>
              {rabbitCode ? (
                <EyeToggleButton
                  visible={isRabbitCodeVisible}
                  onPress={() => {
                    setIsRabbitCodeVisible(visible => !visible);
                  }}
                />
              ) : null}
            </View>
            <Text
              style={[styles.statusValue, styles.statusValueNoWrap]}
              selectable={!!rabbitCode && isRabbitCodeVisible}>
              {rabbitCode
                ? isRabbitCodeVisible
                  ? rabbitCode
                  : maskedRabbitCode
                : '-'}
            </Text>
          </View>

          <View style={styles.versionSelectorGroup}>
            {KEYCHAIN_VERSION_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.key}
                activeOpacity={0.8}
                disabled={!canSwitchCurrentKeychainVersion}
                style={styles.versionSelectorOption}
                onPress={() => {
                  handleChangeCurrentVersion(option.key);
                }}>
                <Radio
                  title={option.label}
                  checked={currentKeychainVersion === option.key}
                  onPress={() => {
                    handleChangeCurrentVersion(option.key);
                  }}
                  checkedColor={colors2024['brand-default']}
                  containerStyle={styles.versionRadio}
                  textStyle={styles.versionRadioLabel}
                />
                <Text style={styles.versionRadioMeta}>
                  {option.description}
                </Text>
                <Text style={styles.versionRadioMeta} selectable>
                  Source: {option.sourceLabel}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <PillsSwitch
          value={tabKey}
          options={TAB_OPTIONS}
          onTabChange={key => {
            setTabKey(key as TabKey);
          }}
          containerStyle={styles.tabSwitch}
          itemStyle={styles.tabSwitchItem}
        />

        {renderSelectedTab()}
      </ScrollView>

      <AppBottomSheetModal
        ref={actionsSheetRef}
        onDismiss={closeActionsSheet}
        enableDynamicSizing
        maxDynamicContentSize={actionsSheetMaxHeight}>
        {renderActionsSheetContent()}
      </AppBottomSheetModal>
      <AppBottomSheetModal
        ref={helpSheetRef}
        onDismiss={handleHelpSheetDismiss}
        enableDynamicSizing
        maxDynamicContentSize={actionsSheetMaxHeight}>
        {renderHelpSheetContent()}
      </AppBottomSheetModal>
    </FooterButtonScreenContainer>
  );
}

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  footerContainer: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors2024['neutral-line'],
  },
  scrollView: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  tabSwitch: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-2'],
  },
  tabSwitchItem: {
    flex: 1,
    minWidth: 0,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  versionSelectorGroup: {
    marginTop: 12,
    gap: 10,
  },
  versionSelectorOption: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-bg-2'],
  },
  versionRadio: {
    paddingVertical: 0,
  },
  versionRadioLabel: {
    color: colors2024['neutral-title-1'],
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  versionRadioMeta: {
    marginTop: 4,
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  summaryCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-card-1'],
  },
  sectionTitle: {
    color: colors2024['neutral-title-1'],
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionStandaloneHeader: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHelpButton: {
    padding: 2,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  policyProbeRow: {
    marginTop: 12,
    gap: 4,
  },
  policyProbeTitle: {
    color: colors2024['neutral-title-1'],
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  policyProbeDesc: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  summaryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-2'],
  },
  summaryBadgeText: {
    color: colors2024['neutral-body'],
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    marginTop: 0,
  },
  sheetScrollView: {
    maxHeight: '100%',
  },
  sheetScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  sheetSection: {
    marginTop: 8,
  },
  sheetSectionTitle: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  sheetSectionDesc: {
    marginTop: 6,
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  sheetActionButton: {
    marginTop: 12,
  },
  sheetPrimaryButton: {
    marginTop: 12,
  },
  sheetListLabel: {
    marginTop: 4,
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  sheetListLine: {
    marginTop: 6,
    color: colors2024['neutral-title-1'],
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  statusCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-card-1'],
    gap: 10,
  },
  cardHorizontalScrollContent: {
    minWidth: '100%',
  },
  cardVerticalScroll: {
    width: '100%',
  },
  cardVerticalScrollContent: {
    minWidth: '100%',
    gap: 10,
  },
  statusGrid: {
    gap: 8,
  },
  statusCompactRow: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'flex-start',
  },
  statusRow: {
    gap: 4,
  },
  statusRowCompact: {
    width: 124,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-2'],
    gap: 2,
  },
  statusLabel: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  statusLabelCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  statusValue: {
    color: colors2024['neutral-title-1'],
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  statusValueCompact: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  statusValueNoWrap: {
    flexShrink: 0,
  },
  plainPasswordValue: {
    marginTop: 10,
    color: colors2024['neutral-title-1'],
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  plainPasswordOverflowValue: {
    flexShrink: 0,
  },
  eyeToggleButton: {
    padding: 2,
  },
  resultText: {
    marginTop: 10,
    color: colors2024['neutral-body'],
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  errorText: {
    marginTop: 10,
    color: colors2024['red-default'],
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  emptyCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-card-1'],
    gap: 6,
  },
  emptyTitle: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  emptyDesc: {
    color: colors2024['neutral-foot'],
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
}));
