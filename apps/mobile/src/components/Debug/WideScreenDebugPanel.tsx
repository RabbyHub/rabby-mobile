import React, { useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components2024/Button';
import { toast } from '@/components2024/Toast';
import { Text } from '@/components/Typography';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  mutateRandomTokenSelectorProbeToken,
  toggleTokenSelectorRenderProbeEnabled,
  WIDE_SCREEN_DEBUG_PANEL_WIDTH,
  useShouldShowWideScreenDebugPanel,
  useTokenSelectorRenderProbeMetaText,
  useTokenSelectorRenderProbePanelState,
} from '@/components/Token/tokenSelectorRenderProbe';
import { useWideScreenDebugPanelSetting } from '@/hooks/appSettings';

export function WideScreenDebugPanel() {
  const shouldShow = useShouldShowWideScreenDebugPanel();
  const { styles } = useTheme2024({ getStyle });
  const metaText = useTokenSelectorRenderProbeMetaText();
  const { lastMutation, renderProbeEnabled } =
    useTokenSelectorRenderProbePanelState();
  const { toggleWideScreenDebugPanel } = useWideScreenDebugPanelSetting();

  const handleMutate = useCallback(() => {
    if (!renderProbeEnabled) {
      toast.info('Enable Token Selector Probe first');
      return;
    }

    const mutation = mutateRandomTokenSelectorProbeToken();
    if (!mutation) {
      toast.info('Open Send / Swap / Bridge Token Selector first');
      return;
    }

    toast.info(`Mutated ${mutation.symbol || mutation.tokenId}`);
  }, [renderProbeEnabled]);

  const handleClosePanel = useCallback(() => {
    toggleWideScreenDebugPanel(false);
  }, [toggleWideScreenDebugPanel]);

  if (!shouldShow) {
    return null;
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.eyebrow}>Wide Screen Debug</Text>
      <Text style={styles.title}>Right Panel</Text>
      <Text style={styles.description}>
        Foldable and tablet-only controls for isolated runtime checks.
      </Text>

      <TouchableOpacity style={styles.switchRow} onPress={handleClosePanel}>
        <AppSwitch2024
          value
          onPress={evt => evt.stopPropagation()}
          onValueChange={handleClosePanel}
        />
        <Text style={styles.switchLabel}>Right panel enabled</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Token Selector Render Probe</Text>
        <Text style={styles.sectionDesc}>
          Covers Send, Swap From and Bridge From token selectors.
        </Text>

        <TouchableOpacity
          style={styles.switchRow}
          onPress={() => {
            toggleTokenSelectorRenderProbeEnabled();
          }}>
          <AppSwitch2024
            value={renderProbeEnabled}
            onPress={evt => evt.stopPropagation()}
            onValueChange={toggleTokenSelectorRenderProbeEnabled}
          />
          <Text style={styles.switchLabel}>
            {renderProbeEnabled
              ? 'Show row render counters'
              : 'Hide row render counters'}
          </Text>
        </TouchableOpacity>

        <View style={styles.metaBox}>
          <Text style={styles.metaText}>{metaText}</Text>
          {lastMutation ? (
            <Text style={styles.metaText}>
              last: {lastMutation.symbol || lastMutation.tokenId} /{' '}
              {lastMutation.chain || '-'} / $
              {lastMutation.usdValue?.toFixed(4) || '0'}
            </Text>
          ) : null}
        </View>

        <Button
          title="Mutate Random Visible Token"
          type="primary"
          height={44}
          disabled={!renderProbeEnabled}
          containerStyle={styles.button}
          onPress={handleMutate}
        />
      </View>
    </View>
  );
}

const getStyle = createGetStyles2024(ctx =>
  StyleSheet.create({
    panel: {
      width: WIDE_SCREEN_DEBUG_PANEL_WIDTH,
      height: '100%',
      flexShrink: 0,
      paddingTop: 54,
      paddingHorizontal: 16,
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: ctx.colors2024['neutral-line'],
    },
    eyebrow: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      textTransform: 'uppercase',
      color: ctx.colors2024['brand-default'],
    },
    title: {
      marginTop: 6,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '800',
      color: ctx.colors2024['neutral-title-1'],
    },
    description: {
      marginTop: 8,
      fontSize: 13,
      lineHeight: 18,
      color: ctx.colors2024['neutral-body'],
    },
    section: {
      marginTop: 18,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: ctx.colors2024['neutral-line'],
    },
    sectionTitle: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
    },
    sectionDesc: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 17,
      color: ctx.colors2024['neutral-foot'],
    },
    switchRow: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    switchLabel: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: ctx.colors2024['neutral-body'],
    },
    metaBox: {
      marginTop: 14,
      padding: 12,
      borderRadius: 12,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      gap: 6,
    },
    metaText: {
      fontSize: 12,
      lineHeight: 16,
      color: ctx.colors2024['neutral-foot'],
    },
    button: {
      marginTop: 14,
      width: '100%',
    },
  }),
);
