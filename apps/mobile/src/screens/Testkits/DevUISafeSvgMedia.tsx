import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import RNFS, {
  type SafeSvgResult,
  type SafeSvgVariant,
} from '@rabby-wallet/react-native-fs';

import { Media, MEDIA_TYPE } from '@/components/Media';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { E2E_ID } from '@/constant/e2e';
import { useTheme2024 } from '@/hooks/theme';
import { makeTestIDProps } from '@/utils/makeTestIDProps';
import { createGetStyles2024 } from '@/utils/styles';

const DEFAULT_SVG_URL =
  'https://assets.debank.com/static/media/default.99a115ad939329c9a25b45d3cdecf56f.svg';
const FAILURE_SVG_URL =
  'https://assets.debank.com/safe-svg-playground/not-found.svg';

type DiagnosticState = {
  tone: 'idle' | 'running' | 'ready' | 'failed';
  message: string;
};

function describeResult(
  result: SafeSvgResult,
  variant: SafeSvgVariant,
  elapsedMs: number,
): DiagnosticState {
  if (result.status === 'failed') {
    return {
      tone: 'failed',
      message: `${variant}: failed (${result.reason}) in ${elapsedMs}ms`,
    };
  }

  return {
    tone: 'ready',
    message: `${variant}: ${result.width}x${result.height}, cacheHit=${String(
      result.cacheHit,
    )}, ${elapsedMs}ms`,
  };
}

export default function DevUISafeSvgMedia(): JSX.Element {
  const { styles, colors2024, colors } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });
  const [draftUrl, setDraftUrl] = useState(DEFAULT_SVG_URL);
  const [activeUrl, setActiveUrl] = useState(DEFAULT_SVG_URL);
  const [renderKey, setRenderKey] = useState(0);
  const [diagnostic, setDiagnostic] = useState<DiagnosticState>({
    tone: 'idle',
    message: RNFS.isSafeSvgRasterizationAvailable()
      ? 'Native SVG rasterizer is available.'
      : 'Native SVG rasterizer is unavailable.',
  });

  const diagnosticStyle = useMemo(() => {
    if (diagnostic.tone === 'ready') {
      return styles.diagnosticReady;
    }
    if (diagnostic.tone === 'failed') {
      return styles.diagnosticFailed;
    }
    return styles.diagnosticIdle;
  }, [diagnostic.tone, styles]);

  const applyUrl = useCallback(
    (url = draftUrl) => {
      const nextUrl = url.trim();
      setDraftUrl(nextUrl);
      setActiveUrl(nextUrl);
      setRenderKey(current => current + 1);
      setDiagnostic({
        tone: 'idle',
        message: nextUrl
          ? 'Media remounted with the selected URL.'
          : 'URL empty.',
      });
    },
    [draftUrl],
  );

  const resolveAndInspect = useCallback(async () => {
    if (!activeUrl) {
      setDiagnostic({ tone: 'failed', message: 'Enter and apply an SVG URL.' });
      return;
    }

    setDiagnostic({ tone: 'running', message: 'Resolving detail PNG…' });
    const startedAt = Date.now();
    try {
      const result = await RNFS.resolveSvg({
        url: activeUrl,
        variant: 'detail',
      });
      setDiagnostic(describeResult(result, 'detail', Date.now() - startedAt));
    } catch (error) {
      setDiagnostic({
        tone: 'failed',
        message: `Native call failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      });
    }
  }, [activeUrl]);

  const clearCacheAndReload = useCallback(async () => {
    setDiagnostic({ tone: 'running', message: 'Clearing safe SVG cache…' });
    try {
      await RNFS.clearSafeSvgCache();
      setRenderKey(current => current + 1);
      setDiagnostic({
        tone: 'idle',
        message: 'Cache cleared. Media remounted for a cold conversion.',
      });
    } catch (error) {
      setDiagnostic({
        tone: 'failed',
        message: `Clear cache failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      });
    }
  }, []);

  const failedPlaceholder = (
    <View style={styles.failedPlaceholder}>
      <Text style={styles.failedPlaceholderText}>SVG unavailable</Text>
    </View>
  );

  return (
    <NormalScreenContainer
      noHeader
      style={styles.screen}
      overwriteStyle={{ backgroundColor: colors['neutral-card-1'] }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        {...makeTestIDProps(E2E_ID.playground.safeSvgScreen)}>
        <Text style={styles.title}>Safe SVG Media</Text>
        <Text style={styles.description}>
          Exercises the production Media path: HTTPS download, Rust/resvg
          rasterization, local PNG cache, skeleton timeout and failed fallback.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SVG URL</Text>
          <TextInput
            value={draftUrl}
            onChangeText={setDraftUrl}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            placeholder="https://assets.debank.com/example.svg"
            placeholderTextColor={colors2024['neutral-foot']}
            style={styles.urlInput}
            {...makeTestIDProps(E2E_ID.playground.safeSvgUrlInput)}
          />
          <View style={styles.buttonRow}>
            <Button
              title="Apply URL"
              type="primary"
              containerStyle={styles.button}
              onPress={() => applyUrl()}
              {...makeTestIDProps(E2E_ID.playground.safeSvgApply)}
            />
            <Button
              title="Use default"
              type="ghost"
              containerStyle={styles.button}
              onPress={() => applyUrl(DEFAULT_SVG_URL)}
            />
          </View>
          <View style={styles.buttonRow}>
            <Button
              title="Use 404 case"
              type="warning"
              containerStyle={styles.button}
              onPress={() => applyUrl(FAILURE_SVG_URL)}
            />
            <Button
              title="Remount media"
              type="ghost"
              containerStyle={styles.button}
              onPress={() => setRenderKey(current => current + 1)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Production Media component</Text>
          <Text style={styles.description}>
            Failed previews expose a refresh badge. Tap the image to retry
            without clearing the cache.
          </Text>
          <View style={styles.previewRow}>
            <View style={styles.previewColumn}>
              <Text style={styles.previewLabel}>thumbnail policy</Text>
              <View
                style={styles.thumbnailPreview}
                {...makeTestIDProps(E2E_ID.playground.safeSvgThumbnail)}>
                <Media
                  retryOnFailure
                  key={`thumbnail-${renderKey}`}
                  type={MEDIA_TYPE.IMAGE_URL}
                  src={activeUrl}
                  safeSvgVariant="thumbnail"
                  style={styles.previewImage}
                  mediaStyle={styles.previewImage}
                  failedPlaceholder={failedPlaceholder}
                />
              </View>
            </View>
            <View style={styles.previewColumn}>
              <Text style={styles.previewLabel}>detail policy</Text>
              <View
                style={styles.detailPreview}
                {...makeTestIDProps(E2E_ID.playground.safeSvgDetail)}>
                <Media
                  retryOnFailure
                  key={`detail-${renderKey}`}
                  type={MEDIA_TYPE.IMAGE_URL}
                  src={activeUrl}
                  safeSvgVariant="detail"
                  style={styles.previewImage}
                  mediaStyle={styles.previewImage}
                  failedPlaceholder={failedPlaceholder}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cache diagnostics</Text>
          <View style={[styles.diagnostic, diagnosticStyle]}>
            <Text
              style={styles.diagnosticText}
              selectable
              {...makeTestIDProps(E2E_ID.playground.safeSvgStatus)}>
              {diagnostic.message}
            </Text>
          </View>
          <View style={styles.buttonRow}>
            <Button
              title="Resolve & inspect"
              type="primary"
              loading={diagnostic.tone === 'running'}
              containerStyle={styles.button}
              onPress={() => void resolveAndInspect()}
              {...makeTestIDProps(E2E_ID.playground.safeSvgResolve)}
            />
            <Button
              title="Clear + cold reload"
              type="danger"
              containerStyle={styles.button}
              onPress={() => void clearCacheAndReload()}
              {...makeTestIDProps(E2E_ID.playground.safeSvgClearCache)}
            />
          </View>
        </View>
      </ScrollView>
    </NormalScreenContainer>
  );
}

const getStyles = createGetStyles2024(ctx => ({
  screen: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 16,
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
  description: {
    color: ctx.colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    padding: 16,
    gap: 12,
    borderRadius: 12,
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  sectionTitle: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
  urlInput: {
    minHeight: 76,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ctx.colors2024['neutral-line'],
    borderRadius: 8,
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 13,
    lineHeight: 18,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  previewColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  previewLabel: {
    color: ctx.colors2024['neutral-secondary'],
    fontSize: 12,
    lineHeight: 16,
  },
  thumbnailPreview: {
    width: 112,
    height: 112,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: ctx.colors2024['neutral-bg-2'],
  },
  detailPreview: {
    width: 144,
    height: 112,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: ctx.colors2024['neutral-bg-2'],
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  failedPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: ctx.colors2024['red-light'],
  },
  failedPlaceholderText: {
    color: ctx.colors2024['red-default'],
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  diagnostic: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  diagnosticIdle: {
    borderColor: ctx.colors2024['neutral-line'],
    backgroundColor: ctx.colors2024['neutral-bg-2'],
  },
  diagnosticReady: {
    borderColor: ctx.colors2024['green-default'],
    backgroundColor: ctx.colors2024['green-light'],
  },
  diagnosticFailed: {
    borderColor: ctx.colors2024['red-default'],
    backgroundColor: ctx.colors2024['red-light'],
  },
  diagnosticText: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 13,
    lineHeight: 18,
  },
}));
