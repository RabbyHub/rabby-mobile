import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';

import type { PerpsPositionViewModel } from '../../model/position';
import {
  calculatePositionTpSlEstimatedPnl,
  calculatePositionTpSlRoi,
  type PerpsPositionTpSlKind,
  type PerpsPositionTpSlMarketSnapshot,
} from '../../model/positionTpSl';
import type { PerpsProTpSlMode } from '../../model/tpsl';
import {
  formatPerpsProPrice,
  formatPerpsProSignedDecimal,
} from '../../utils/format';
import { PerpsProPositionTpSlInput } from './PerpsProPositionTpSlInput';

export const PerpsProPositionTpSlSideInputs: React.FC<{
  addMode: boolean;
  disabled: boolean;
  kind: PerpsPositionTpSlKind;
  market: PerpsPositionTpSlMarketSnapshot;
  onChangeModeMagnitude: (value: string) => void;
  onChangeTrigger: (value: string) => void;
  onPressMode: () => void;
  position: PerpsPositionViewModel;
  rawMagnitude: string;
  selectedMode: PerpsProTpSlMode;
  showEmptyDescription?: boolean;
  size: string | null;
  validationKind: 'empty' | 'invalid' | 'valid';
  value: string;
}> = React.memo(
  ({
    addMode,
    disabled,
    kind,
    market,
    onChangeModeMagnitude,
    onChangeTrigger,
    onPressMode,
    position,
    rawMagnitude,
    selectedMode,
    showEmptyDescription = false,
    size,
    validationKind,
    value,
  }) => {
    const { styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const derivedRoi = calculatePositionTpSlRoi({
      direction: position.direction,
      entryPrice: position.entryPrice,
      leverage: position.leverage,
      triggerPrice: value,
    });
    const estimatedPnl = calculatePositionTpSlEstimatedPnl({
      direction: position.direction,
      entryPrice: position.entryPrice,
      size: size || '',
      triggerPrice: value,
    });
    const triggerLabel = addMode
      ? t(
          kind === 'takeProfit'
            ? 'page.perps.pro.positionTpsl.takeProfitTrigger'
            : 'page.perps.pro.positionTpsl.stopLossTrigger',
        )
      : `${t('page.perps.pro.positionTpsl.triggerPrice')} (${
          market.quoteAsset
        })`;
    const modeLabel = t(
      `page.perps.pro.trade.${
        selectedMode === 'roi' ? 'roiInput' : selectedMode
      }`,
    );
    const modeUnit = selectedMode === 'roi' ? '%' : market.quoteAsset;
    const showDescription =
      (value && validationKind === 'valid') ||
      (!value && validationKind === 'empty' && showEmptyDescription);
    const hint =
      value && validationKind === 'invalid' ? (
        <Text style={styles.errorText}>
          {t('page.perps.pro.positionTpsl.invalidTrigger')}
        </Text>
      ) : showDescription ? (
        <Text style={styles.fieldHint}>
          <Trans
            components={{
              1: <Text style={styles.fieldHintEmphasis} />,
              2: (
                <Text
                  style={
                    kind === 'takeProfit'
                      ? styles.fieldHintPositive
                      : styles.fieldHintNegative
                  }
                />
              ),
            }}
            i18nKey="page.perps.pro.positionTpsl.triggerDescription"
            t={t}
            values={{
              pnl:
                !value || estimatedPnl == null
                  ? '--'
                  : formatPerpsProSignedDecimal(estimatedPnl, 2),
              quoteAsset: market.quoteAsset,
              roi:
                !value || derivedRoi == null
                  ? '--'
                  : formatPerpsProSignedDecimal(derivedRoi, 2),
              trigger: value
                ? formatPerpsProPrice(value, market.pxDecimals)
                : '--',
            }}
          />
        </Text>
      ) : null;

    return (
      <>
        <View style={styles.sideInputs}>
          <PerpsProPositionTpSlInput
            accessibilityLabel={triggerLabel}
            disabled={disabled}
            label={triggerLabel}
            maxDecimals={market.pxDecimals}
            onChangeText={onChangeTrigger}
            testID={`perps-pro-position-tpsl-${kind}-price`}
            value={value}
          />
          <PerpsProPositionTpSlInput
            accessibilityLabel={modeLabel}
            disabled={disabled}
            label={modeLabel}
            maxDecimals={selectedMode === 'price' ? market.pxDecimals : 8}
            negative={kind === 'stopLoss' && selectedMode !== 'price'}
            onChangeText={onChangeModeMagnitude}
            onPressMode={onPressMode}
            testID={`perps-pro-position-tpsl-${kind}-mode-input`}
            unit={modeUnit}
            value={rawMagnitude}
          />
        </View>
        {hint ? (
          <View
            style={styles.fieldHintRow}
            testID={`perps-pro-position-tpsl-${kind}-hint`}>
            {hint}
          </View>
        ) : null}
      </>
    );
  },
);

PerpsProPositionTpSlSideInputs.displayName = 'PerpsProPositionTpSlSideInputs';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  sideInputs: { flexDirection: 'row', gap: 4 },
  fieldHintRow: { minHeight: 32 },
  fieldHint: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  fieldHintEmphasis: { color: colors2024['neutral-title-1'] },
  fieldHintPositive: { color: colors2024['green-default'] },
  fieldHintNegative: { color: colors2024['red-default'] },
  errorText: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
}));
