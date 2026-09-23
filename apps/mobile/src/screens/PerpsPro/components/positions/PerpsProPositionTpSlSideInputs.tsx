import { formatPositionTpSlSignedValue } from '../../utils/positionTpSlFormatting';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';

import type { PerpsProPositionTpSlMode } from '@/core/services/perpsService';

import type { PerpsPositionViewModel } from '../../model/position';
import {
  calculatePositionTpSlEstimatedPnl,
  calculatePositionTpSlRoi,
  getPositionTpSlValueTone,
  type PerpsPositionTpSlKind,
  type PerpsPositionTpSlMarketSnapshot,
} from '../../model/positionTpSl';
import { getPerpsProPriceInputMaxDecimals } from '../../model/trade';
import { PerpsProPositionTpSlInput } from './PerpsProPositionTpSlInput';

export const PerpsProPositionTpSlSideInputs: React.FC<{
  addMode: boolean;
  disabled: boolean;
  errorMessage?: string | null;
  highlightInvalidFields?: boolean;
  kind: PerpsPositionTpSlKind;
  inputSource: 'mode' | 'trigger';
  market: PerpsPositionTpSlMarketSnapshot;
  onChangeModeMagnitude: (value: string) => void;
  onChangeTrigger: (value: string) => void;
  onPressMode: () => void;
  position: PerpsPositionViewModel;
  rawMagnitude: string;
  selectedMode: PerpsProPositionTpSlMode;
  showEmptyDescription?: boolean;
  size: string | null;
  validationKind: 'empty' | 'invalid' | 'valid';
  value: string;
}> = React.memo(
  ({
    addMode,
    disabled,
    errorMessage = null,
    highlightInvalidFields = false,
    kind,
    inputSource,
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
    const pnlTone = getPositionTpSlValueTone(estimatedPnl);
    const estimatedPnlTone =
      pnlTone === 'neutral'
        ? styles.fieldHintEmphasis
        : pnlTone === 'positive'
        ? styles.fieldHintPositive
        : styles.fieldHintNegative;
    // Price-owned drafts keep their actual sign. Direct SL magnitude input
    // deliberately returns to the existing loss-side price calculation.
    const negative =
      inputSource === 'mode'
        ? kind === 'stopLoss' &&
          getPositionTpSlValueTone(rawMagnitude) === 'positive'
        : getPositionTpSlValueTone(
            selectedMode === 'pnl' ? estimatedPnl : derivedRoi,
          ) === 'negative';
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
      (value && validationKind !== 'empty') ||
      (!value && showEmptyDescription && !!rawMagnitude);
    const showError =
      validationKind === 'invalid' && (!!value || !!errorMessage);

    return (
      <>
        <View style={styles.sideInputs}>
          <PerpsProPositionTpSlInput
            accessibilityLabel={triggerLabel}
            disabled={disabled}
            invalid={highlightInvalidFields && showError}
            label={`${t('page.perps.pro.positionTpsl.triggerPrice')} (${
              market.quoteAsset
            })`}
            placeholder={t(
              kind === 'takeProfit'
                ? 'page.perps.pro.positionTpsl.takeProfitTrigger'
                : 'page.perps.pro.positionTpsl.stopLossTrigger',
            )}
            maxDecimals={getPerpsProPriceInputMaxDecimals(market.szDecimals)}
            onChangeText={onChangeTrigger}
            priceSzDecimals={market.szDecimals}
            testID={`perps-pro-position-tpsl-${kind}-price`}
            value={value}
          />
          <PerpsProPositionTpSlInput
            accessibilityLabel={modeLabel}
            disabled={disabled}
            invalid={highlightInvalidFields && showError}
            label={modeLabel}
            maxDecimals={2}
            negative={negative}
            onChangeText={onChangeModeMagnitude}
            onPressMode={onPressMode}
            testID={`perps-pro-position-tpsl-${kind}-mode-input`}
            unit={modeUnit}
            value={rawMagnitude}
          />
        </View>
        {showDescription || showError ? (
          <View
            style={styles.fieldHintRow}
            testID={`perps-pro-position-tpsl-${kind}-hint`}>
            {showDescription ? (
              <Text style={styles.fieldHint}>
                <Trans
                  components={{
                    2: <Text style={estimatedPnlTone} />,
                  }}
                  i18nKey="page.perps.pro.positionTpsl.estimatedPnlDescription"
                  t={t}
                  values={{
                    pnl:
                      !value || estimatedPnl == null
                        ? '--'
                        : formatPositionTpSlSignedValue(estimatedPnl),
                    quoteAsset: market.quoteAsset,
                    roi:
                      !value || derivedRoi == null
                        ? '--'
                        : formatPositionTpSlSignedValue(derivedRoi),
                  }}
                />
              </Text>
            ) : null}
            {showError ? (
              <Text style={styles.errorText}>
                {errorMessage ||
                  t('page.perps.pro.positionTpsl.invalidTrigger')}
              </Text>
            ) : null}
          </View>
        ) : null}
      </>
    );
  },
);

PerpsProPositionTpSlSideInputs.displayName = 'PerpsProPositionTpSlSideInputs';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  sideInputs: { flexDirection: 'row', gap: 8 },
  fieldHintRow: { marginTop: 2 },
  fieldHint: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
  },
  fieldHintEmphasis: { color: colors2024['neutral-title-1'] },
  fieldHintPositive: { color: colors2024['green-default'] },
  fieldHintNegative: { color: colors2024['red-default'] },
  errorText: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
  },
}));
