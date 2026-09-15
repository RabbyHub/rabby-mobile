import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import { getVersion } from 'react-native-device-info';
import semver from 'semver';

import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useUnmountedRef } from '@/hooks/common/useMount';
import { SELF_HOST_BASE, SELF_HOST_BASE_PROD } from '@/utils/version';
import { UpgradePromptDialog } from '@/components/Upgrade/UpgradePromptDialog';
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
  const [preview, setPreview] = useState<{
    version: string;
    changelog: string;
  } | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const unmountedRef = useUnmountedRef();

  useEffect(() => () => requestRef.current?.abort(), []);

  const closePreview = useCallback(() => setPreview(null), []);
  const handleConfirm = useCallback(async () => {
    if (requestRef.current) return;

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
    const platform = Platform.OS === 'android' ? 'android' : 'ios';

    try {
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
          const changelog = await response.text();
          if (!changelog.trim()) continue;
          if (!unmountedRef.current && !controller.signal.aborted) {
            setPreview({ version: requestedVersion, changelog });
          }
          return;
        } catch (fetchError) {
          if (controller.signal.aborted) throw fetchError;
        }
      }
      throw new Error(
        `Could not load ${platform} release notes for v${requestedVersion}.`,
      );
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
      if (!unmountedRef.current) setLoading(false);
    }
  }, [version, unmountedRef]);

  return (
    <>
      <AutoLockView as="BottomSheetView" style={styles.container}>
        <Text style={styles.title}>Upgrade Prompt Preview</Text>
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
  input: { height: 52 },
  footer: { paddingTop: BOTTOM_BUTTON_TOP_OFFSET },
}));
