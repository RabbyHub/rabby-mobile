import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type {
  PerpsProAttachedTpSlDraft,
  PerpsProTpSlLegKind,
} from '../../model/tpsl';
import type { PerpsProTpSlController } from '../../scene/usePerpsProTpSl';
import { usePerpsProDismissKeyboard } from '../common/usePerpsProDismissKeyboard';
import { PerpsProTpSlInput } from './PerpsProTpSlInput';
import { PerpsProTpSlModeSheet } from './PerpsProTpSlModeSheet';
import { PerpsProTpSlTooltip } from './PerpsProTpSlTooltip';
import { PerpsProTradeCheckbox } from './PerpsProTradePrimitives';

export const PerpsProTpSlFields: React.FC<{
  controller: PerpsProTpSlController;
  draft: PerpsProAttachedTpSlDraft;
  pxDecimals: number;
  quoteAsset: string;
}> = React.memo(({ controller, draft, pxDecimals, quoteAsset }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const dismissKeyboardThen = usePerpsProDismissKeyboard();
  const [modeSheet, setModeSheet] = useState<PerpsProTpSlLegKind | null>(null);
  const focused = controller.focusedLeg;
  const focusedMode = focused ? draft[focused].mode : null;
  const buyPreview = focused ? controller.previews.buy[focused] : null;
  const sellPreview = focused ? controller.previews.sell[focused] : null;
  const tooltipVisible =
    draft.enabled &&
    focused != null &&
    !!draft[focused].rawMagnitude &&
    (buyPreview != null || sellPreview != null);
  return (
    <View style={styles.container} testID="perps-pro-tpsl-fields">
      <PerpsProTradeCheckbox
        checked={draft.enabled}
        disabled={controller.disabled}
        explanationKey="tpSl"
        label="TP/SL"
        onPress={() => controller.setEnabled(!draft.enabled)}
      />
      {draft.enabled ? (
        <View style={styles.fields} testID="perps-pro-tpsl-inputs">
          <View
            style={[styles.leg, focused === 'tp' ? styles.activeLeg : null]}>
            {tooltipVisible && focused === 'tp' && focusedMode ? (
              <PerpsProTpSlTooltip
                buy={buyPreview}
                mode={focusedMode}
                pxDecimals={pxDecimals}
                sell={sellPreview}
              />
            ) : null}
            <PerpsProTpSlInput
              kind="tp"
              label={t('page.perps.pro.trade.takeProfit')}
              maxDecimals={draft.tp.mode === 'price' ? pxDecimals : 8}
              mode={draft.tp.mode}
              onBlur={() => controller.setFocusedLeg(null)}
              onChangeText={value => controller.setRawMagnitude('tp', value)}
              onFocus={() => controller.setFocusedLeg('tp')}
              onPressMode={() => {
                controller.setFocusedLeg(null);
                dismissKeyboardThen(() => setModeSheet('tp'));
              }}
              quoteAsset={quoteAsset}
              value={draft.tp.rawMagnitude}
            />
          </View>
          <View
            style={[styles.leg, focused === 'sl' ? styles.activeLeg : null]}>
            {tooltipVisible && focused === 'sl' && focusedMode ? (
              <PerpsProTpSlTooltip
                buy={buyPreview}
                mode={focusedMode}
                pxDecimals={pxDecimals}
                sell={sellPreview}
              />
            ) : null}
            <PerpsProTpSlInput
              kind="sl"
              label={t('page.perps.pro.trade.stopLoss')}
              maxDecimals={draft.sl.mode === 'price' ? pxDecimals : 8}
              mode={draft.sl.mode}
              onBlur={() => controller.setFocusedLeg(null)}
              onChangeText={value => controller.setRawMagnitude('sl', value)}
              onFocus={() => controller.setFocusedLeg('sl')}
              onPressMode={() => {
                controller.setFocusedLeg(null);
                dismissKeyboardThen(() => setModeSheet('sl'));
              }}
              quoteAsset={quoteAsset}
              value={draft.sl.rawMagnitude}
            />
          </View>
        </View>
      ) : null}
      <PerpsProTpSlModeSheet
        onClose={() => setModeSheet(null)}
        onSelect={mode => {
          if (modeSheet) controller.setMode(modeSheet, mode);
        }}
        selected={modeSheet ? draft[modeSheet].mode : 'price'}
        visible={modeSheet != null}
      />
    </View>
  );
});

PerpsProTpSlFields.displayName = 'PerpsProTpSlFields';

const getStyle = createGetStyles2024(() => ({
  container: { gap: 8 },
  fields: { gap: 16, position: 'relative' },
  leg: { position: 'relative', zIndex: 1 },
  activeLeg: { zIndex: 4 },
}));
