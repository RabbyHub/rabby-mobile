import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';
import { getVersion } from 'react-native-device-info';
import semver from 'semver';

import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useUnmountedRef } from '@/hooks/common/useMount';
import { SELF_HOST_BASE, SELF_HOST_BASE_PROD } from '@/utils/version';
import { UpgradePromptDialog } from '@/components/Upgrade/UpgradePromptDialog';
import { APP_VERSIONS } from '@/constant';
import { UPGRADE_PROMPT_URL } from '@/constant/upgradePrompt';
import { parseMarkdown } from '@/components/Markdown/parseMarkdown';
import { useLastPromptedUpgradeVersion } from '@/components/Upgrade/useUpgradePrompt';
import {
  fetchUpgradePrompt,
  getAutoUpgradePromptDecision,
  resolveUpgradePrompt,
} from '@/utils/upgradePrompt';
import { toast } from '@/components2024/Toast';
import { FormInput } from '@/components/Form/Input';
import { Button } from '@/components2024/Button';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import AutoLockView from '@/components/AutoLockView';
import { Text } from '@/components/Typography';
import upgradePromptFixture from './fixtures/upgrade-prompt.json';

const FIXTURE_BODY =
  '### Features\n\n- Fixed some bugs and optimized user experience';
const PROMPT_FIXTURES = [
  { version: '0.6.90', label: 'Both ON' },
  { version: '0.6.91', label: 'Both OFF' },
  { version: '0.6.92', label: 'iOS ON' },
  { version: '0.6.93', label: 'Android ON' },
  { version: '0.6.94', label: 'Missing' },
];
const platform = Platform.OS === 'android' ? 'android' : 'ios';
const localUpgradeVersion = APP_VERSIONS.forCheckUpgrade;

type PromptCheck = {
  label: string;
  detail: string;
  passed: boolean;
};

function buildPromptChecks(input: {
  version: string;
  couldUpgrade: boolean;
  alreadyPrompted: boolean;
  autoPrompt: boolean | undefined;
  changelogValid: boolean;
}): PromptCheck[] {
  return [
    {
      label: '高于本机版本',
      detail: input.couldUpgrade
        ? `${input.version} > ${localUpgradeVersion}`
        : `${input.version} 不高于 ${localUpgradeVersion}`,
      passed: input.couldUpgrade,
    },
    {
      label: '未处理过',
      detail: input.alreadyPrompted ? '这个版本已经处理过' : '没有处理记录',
      passed: !input.alreadyPrompted,
    },
    {
      label: '配置开启',
      detail:
        input.autoPrompt === true
          ? 'true'
          : input.autoPrompt === false
          ? 'false'
          : '没有有效配置',
      passed: input.autoPrompt === true,
    },
    {
      label: '更新说明可展示',
      detail: input.changelogValid ? '可以解析' : '为空或无法解析',
      passed: input.changelogValid,
    },
  ];
}

export function useShowMarkdownInWebVIewTester() {
  const openedModalIdRef = useRef<string>('');
  const viewMarkdownInWebView = useCallback(() => {
    openedModalIdRef.current = createGlobalBottomSheetModal({
      name: MODAL_NAMES.__TEST_MARKDOWN_IN_WEBVIEW,
      title: '',
      bottomSheetModalProps: {
        onDismiss: () => {
          removeGlobalBottomSheetModal(openedModalIdRef.current);
          openedModalIdRef.current = '';
        },
      },
    });
  }, []);

  return { viewMarkdownInWebView };
}

export function MarkdownInWebViewInner() {
  const { styles } = useThemeStyles(getStyles);
  const { safeOffBottom } = useSafeSizes();
  const [version, setVersion] = useState(() => getVersion());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [policyResult, setPolicyResult] = useState('');
  const [checks, setChecks] = useState<PromptCheck[]>([]);
  const lastPromptedVersion = useLastPromptedUpgradeVersion();
  const [preview, setPreview] = useState<{
    version: string;
    changelog: string;
  } | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const unmountedRef = useUnmountedRef();

  useEffect(() => () => requestRef.current?.abort(), []);

  const previewChangelog = useCallback(
    (
      requestedVersion: string,
      changelog: string,
      autoPrompt: boolean | undefined,
      simulateAutoPrompt = false,
    ) => {
      const message =
        autoPrompt === true
          ? 'Automatic update prompt: enabled.'
          : autoPrompt === false
          ? 'Automatic update prompt: disabled by config.'
          : 'Automatic update prompt: disabled (no valid config).';
      setPolicyResult(`v${requestedVersion}: ${message}`);
      setChecks([]);
      toast.info(message, { duration: 4000 });
      setPreview(
        !simulateAutoPrompt || autoPrompt === true
          ? { version: requestedVersion, changelog }
          : null,
      );
    },
    [],
  );

  const closePreview = useCallback(() => setPreview(null), []);
  const handleConfirm = useCallback(async () => {
    if (requestRef.current) {
      return;
    }

    const requestedVersion = semver.valid(version.trim());
    if (!requestedVersion) {
      setError('Enter a valid version, e.g. 0.1.9.');
      return;
    }

    Keyboard.dismiss();
    setError('');
    setLoading(true);
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      let changelog = '';
      const sources = [...new Set([SELF_HOST_BASE, SELF_HOST_BASE_PROD])];
      for (const base of sources) {
        try {
          const response = await fetch(
            `${base}/${platform}/${requestedVersion}.md`,
            { signal: controller.signal },
          );
          if (
            !response.ok ||
            response.headers.get('content-type')?.includes('text/html')
          ) {
            continue;
          }
          const text = await response.text();
          if (!text.trim()) {
            continue;
          }
          changelog = text;
          break;
        } catch (fetchError) {
          if (controller.signal.aborted) {
            throw fetchError;
          }
        }
      }
      if (unmountedRef.current || controller.signal.aborted) {
        return;
      }
      const autoPrompt = await fetchUpgradePrompt(
        UPGRADE_PROMPT_URL,
        platform,
        requestedVersion,
      );
      if (controller.signal.aborted) {
        throw new Error('Request timed out.');
      }
      if (unmountedRef.current) {
        return;
      }
      const couldUpgrade =
        !!semver.valid(localUpgradeVersion) &&
        semver.gt(requestedVersion, localUpgradeVersion);
      const alreadyPrompted = lastPromptedVersion === requestedVersion;
      const changelogValid = parseMarkdown(changelog).success;
      const decision = getAutoUpgradePromptDecision({
        couldUpgrade,
        alreadyPrompted,
        autoPrompt,
        changelogValid,
      });
      const message = decision.willShow
        ? `v${requestedVersion} 会主动弹出`
        : `v${requestedVersion} 不会主动弹出`;
      setPolicyResult(message);
      setChecks(
        buildPromptChecks({
          version: requestedVersion,
          couldUpgrade,
          alreadyPrompted,
          autoPrompt,
          changelogValid,
        }),
      );
      if (decision.willShow) {
        toast.success(message, { duration: 4000 });
        setPreview({ version: requestedVersion, changelog });
      } else {
        toast.info(message, { duration: 4000 });
        setPreview(null);
      }
    } catch (fetchError) {
      if (!unmountedRef.current) {
        setError(
          controller.signal.aborted
            ? 'Request timed out. Please try again.'
            : fetchError instanceof Error
            ? fetchError.message
            : 'Could not load release notes. Please try again.',
        );
      }
    } finally {
      clearTimeout(timeout);
      requestRef.current = null;
      if (!unmountedRef.current) {
        setLoading(false);
      }
    }
  }, [version, unmountedRef, lastPromptedVersion]);

  return (
    <>
      <AutoLockView as="BottomSheetView" style={styles.container}>
        <Text style={styles.title}>Upgrade Prompt Preview</Text>
        <Text style={styles.label}>Local JSON fixtures ({platform})</Text>
        <View style={styles.fixtures}>
          {PROMPT_FIXTURES.map(fixture => (
            <Pressable
              key={fixture.version}
              accessibilityRole="button"
              disabled={loading}
              style={styles.fixture}
              onPress={() => {
                Keyboard.dismiss();
                previewChangelog(
                  fixture.version,
                  FIXTURE_BODY,
                  resolveUpgradePrompt(
                    upgradePromptFixture,
                    platform,
                    fixture.version,
                  ),
                  true,
                );
              }}>
              <Text style={styles.fixtureText}>{fixture.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Version</Text>
        <FormInput
          as="BottomSheetTextInput"
          containerStyle={styles.input}
          errorText={error}
          inputProps={{
            value: version,
            onChangeText: value => {
              setVersion(value);
              setError('');
            },
            editable: !loading,
            autoCapitalize: 'none',
            autoCorrect: false,
            maxLength: 64,
            returnKeyType: 'done',
            onSubmitEditing: handleConfirm,
          }}
        />
        {!!policyResult && <Text style={styles.result}>{policyResult}</Text>}
        {checks.map(check => (
          <Text
            key={check.label}
            style={[
              styles.check,
              check.passed ? styles.checkPass : styles.checkFail,
            ]}>
            {check.passed ? '通过' : '不通过'} · {check.label}：{check.detail}
          </Text>
        ))}
        <View
          style={[
            styles.footer,
            { paddingBottom: getBottomButtonBottomOffset(safeOffBottom) },
          ]}>
          <Button
            title="Confirm"
            height={BOTTOM_BUTTON_SINGLE_HEIGHT}
            titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
            loading={loading}
            disabled={loading || !version.trim()}
            onPress={handleConfirm}
          />
        </View>
      </AutoLockView>
      {preview && (
        <UpgradePromptDialog
          modalId="dev-upgrade-prompt-preview"
          visible
          remoteVersion={preview}
          onClose={closePreview}
          onUpdate={closePreview}
        />
      )}
    </>
  );
}

const getStyles = createGetStyles(colors => ({
  container: {
    height: '100%',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    color: colors['neutral-title1'],
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 24,
  },
  label: {
    color: colors['neutral-body'],
    fontSize: 14,
    marginBottom: 8,
  },
  result: {
    color: colors['neutral-title1'],
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  check: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  checkPass: {
    color: colors['green-default'],
  },
  checkFail: {
    color: colors['red-default'],
  },
  fixtures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  fixture: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors['neutral-card1'],
  },
  fixtureText: { color: colors['neutral-title1'], fontSize: 14 },
  input: { height: 52 },
  footer: { paddingTop: BOTTOM_BUTTON_TOP_OFFSET },
}));
