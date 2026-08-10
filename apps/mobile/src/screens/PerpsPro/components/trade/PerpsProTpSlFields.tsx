import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type {
  PerpsProAttachedTpSlDraft,
  PerpsProTpSlLegKind,
  PerpsProTpSlMode,
} from '../../model/tpsl';
import type { PerpsProTpSlController } from '../../scene/usePerpsProTpSl';
import { PerpsProTpSlInput } from './PerpsProTpSlInput';
import { PerpsProTpSlTooltip } from './PerpsProTpSlTooltip';
import { PerpsProTradeOptionSheet } from './PerpsProTradeOptionSheet';
import { PerpsProTradeCheckbox } from './PerpsProTradePrimitives';

export const PerpsProTpSlFields: React.FC<{
  controller: PerpsProTpSlController;
  draft: PerpsProAttachedTpSlDraft;
  pxDecimals: number;
  quoteAsset: string;
}> = React.memo(({ controller, draft, pxDecimals, quoteAsset }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [modeSheet, setModeSheet] = useState<PerpsProTpSlLegKind | null>(null);
  const modeOptions = useMemo<
    Array<{ label: string; value: PerpsProTpSlMode }>
  >(
    () => [
      { label: t('page.perps.pro.trade.price'), value: 'price' },
      { label: t('page.perps.pro.trade.pnl'), value: 'pnl' },
      { label: t('page.perps.pro.trade.roi'), value: 'roi' },
    ],
    [t],
  );
  const errors = useMemo(
    () => ({
      common: controller.submitErrors.find(error => !error.leg),
      sl: controller.submitErrors.find(error => error.leg === 'sl'),
      tp: controller.submitErrors.find(error => error.leg === 'tp'),
    }),
    [controller.submitErrors],
  );
  const focused = controller.focusedLeg;
  const focusedMode = focused ? draft[focused].mode : null;
  const buyPreview = focused ? controller.previews.buy[focused] : null;
  const sellPreview = focused ? controller.previews.sell[focused] : null;
  const tooltipVisible =
    draft.enabled &&
    focused != null &&
    !!draft[focused].rawMagnitude &&
    buyPreview != null &&
    sellPreview != null;
  const errorText = (error: (typeof controller.submitErrors)[number] | null) =>
    error ? t(`page.perps.pro.trade.tpSlError.${error.code}`) : null;

  return (
    <View style={styles.container} testID="perps-pro-tpsl-fields">
      <PerpsProTradeCheckbox
        checked={draft.enabled}
        disabled={controller.disabled}
        label="TP/SL"
        onPress={() => controller.setEnabled(!draft.enabled)}
      />
      {draft.enabled ? (
        <View style={styles.fields}>
          {tooltipVisible && focusedMode && buyPreview && sellPreview ? (
            <PerpsProTpSlTooltip
              buy={buyPreview}
              mode={focusedMode}
              pxDecimals={pxDecimals}
              quoteAsset={quoteAsset}
              sell={sellPreview}
            />
          ) : null}
          <View style={styles.row}>
            <PerpsProTpSlInput
              error={errorText(errors.tp ?? null)}
              kind="tp"
              label={t('page.perps.pro.trade.takeProfit')}
              mode={draft.tp.mode}
              onBlur={() => controller.setFocusedLeg(null)}
              onChangeText={value => controller.setRawMagnitude('tp', value)}
              onFocus={() => controller.setFocusedLeg('tp')}
              onPressMode={() => setModeSheet('tp')}
              value={draft.tp.rawMagnitude}
            />
            <PerpsProTpSlInput
              error={errorText(errors.sl ?? null)}
              kind="sl"
              label={t('page.perps.pro.trade.stopLoss')}
              mode={draft.sl.mode}
              onBlur={() => controller.setFocusedLeg(null)}
              onChangeText={value => controller.setRawMagnitude('sl', value)}
              onFocus={() => controller.setFocusedLeg('sl')}
              onPressMode={() => setModeSheet('sl')}
              value={draft.sl.rawMagnitude}
            />
          </View>
          {errors.common ? (
            <Text style={styles.commonError}>{errorText(errors.common)}</Text>
          ) : null}
        </View>
      ) : null}
      <PerpsProTradeOptionSheet<PerpsProTpSlMode>
        onClose={() => setModeSheet(null)}
        onSelect={mode => {
          if (modeSheet) controller.setMode(modeSheet, mode);
        }}
        options={modeOptions}
        selected={modeSheet ? draft[modeSheet].mode : 'price'}
        title={t('page.perps.pro.trade.tpSlSettings')}
        visible={modeSheet != null}
      />
    </View>
  );
});

PerpsProTpSlFields.displayName = 'PerpsProTpSlFields';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: { gap: 6 },
  fields: { position: 'relative' },
  row: { flexDirection: 'row', gap: 6 },
  commonError: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro',
    fontSize: 9,
    lineHeight: 12,
    marginTop: 3,
  },
}));
