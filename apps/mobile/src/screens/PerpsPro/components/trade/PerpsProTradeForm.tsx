import RcIconAvailableAdd from '@/assets2024/icons/perps/PerpsProAvailableAdd.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProBboStrategy } from '../../model/bbo';
import type { PerpsProTradeTif } from '../../model/trade';
import type { PerpsProTradeController } from '../../scene/usePerpsProTrade';
import { formatPerpsProDecimal } from '../../utils/format';
import { PerpsProSelectCaret } from '../common/PerpsProSelectCaret';
import { PERPS_PRO_ISOLATED_TEXT_STYLE } from '../common/perpsProVisual';
import { usePerpsProDismissKeyboard } from '../common/usePerpsProDismissKeyboard';
import { PerpsProLeverageSheet } from '../positions/PerpsProLeverageSheet';
import { PerpsProBboSheet } from './PerpsProBboSheet';
import { PerpsProMarginModeSheet } from './PerpsProMarginModeSheet';
import { PerpsProOrderTypeSheet } from './PerpsProOrderTypeSheet';
import { PerpsProTradeAmountField } from './PerpsProTradeAmountField';
import { PerpsProTradeAmountSlider } from './PerpsProTradeAmountSlider';
import { PerpsProTradeBboField } from './PerpsProTradeBboField';
import { PerpsProTradePriceField } from './PerpsProTradePriceField';
import { PerpsProTifSheet } from './PerpsProTifSheet';
import { PerpsProTpSlFields } from './PerpsProTpSlFields';
import {
  PerpsProTradeButton,
  PerpsProTradeCheckbox,
  PerpsProTradeSelect,
  PerpsProTradeSummaryRow,
} from './PerpsProTradePrimitives';

type Sheet = 'bbo' | 'leverage' | 'margin' | 'orderType' | 'tif' | null;

const bboLabels: Record<PerpsProBboStrategy, string> = {
  cp1: 'Counterparty 1',
  cp5: 'Counterparty 5',
  q1: 'Queue 1',
  q5: 'Queue 5',
};
const bboOptions = (Object.keys(bboLabels) as PerpsProBboStrategy[]).map(
  value => ({ label: bboLabels[value], value }),
);
const tifLabels: Record<PerpsProTradeTif, string> = {
  Alo: 'ALO',
  Gtc: 'GTC',
  Ioc: 'IOC',
};

export const PerpsProTradeForm: React.FC<{
  configurationReady?: boolean;
  controller: PerpsProTradeController;
  onDeposit: () => void;
}> = React.memo(({ configurationReady = true, controller, onDeposit }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [sheet, setSheet] = useState<Sheet>(null);
  const dismissKeyboardThen = usePerpsProDismissKeyboard();
  const openSheet = useCallback(
    (nextSheet: Exclude<Sheet, null>) =>
      dismissKeyboardThen(() => setSheet(nextSheet)),
    [dismissKeyboardThen],
  );
  useEffect(() => {
    if (!configurationReady) {
      setSheet(null);
    }
  }, [configurationReady]);
  const { form, market } = controller;
  const quoteAsset = market?.quoteAsset ?? '-';
  const amountLabel = `${t('page.perps.pro.trade.amount')}(${
    controller.amountUnitLabel
  })`;
  const orderTypeLabel = t(`page.perps.pro.trade.${form.orderType}`);
  const marginLabel = !configurationReady
    ? '--'
    : controller.marginMode === 'cross'
    ? t('page.perps.pro.positions.cross')
    : t('page.perps.pro.trade.isolated');
  return (
    <View
      accessibilityState={{ disabled: !configurationReady }}
      pointerEvents={
        controller.pending || !configurationReady ? 'none' : 'auto'
      }
      style={styles.container}
      testID="perps-pro-trade-form">
      <View style={styles.inputGroup}>
        <View style={styles.doubleRow}>
          <PerpsProTradeSelect
            disabled={!configurationReady}
            label={marginLabel}
            onPress={() => {
              dismissKeyboardThen(() => {
                if (controller.marginModeDisabledReason) {
                  controller.setMarginMode(
                    controller.marginMode === 'cross' ? 'isolated' : 'cross',
                  );
                } else {
                  setSheet('margin');
                }
              });
            }}
            showCaret={false}
            style={styles.flexItem}
            textStyle={
              configurationReady && controller.marginMode === 'isolated'
                ? PERPS_PRO_ISOLATED_TEXT_STYLE
                : undefined
            }
          />
          <PerpsProTradeSelect
            disabled={!configurationReady}
            label={configurationReady ? `${controller.leverage}x` : '--'}
            onPress={() => openSheet('leverage')}
            showCaret={false}
            style={styles.flexItem}
            useReadableTextVariant={false}
          />
        </View>
        <PerpsProTradeSelect
          disabled={!configurationReady}
          label={orderTypeLabel}
          onPress={() => openSheet('orderType')}
        />
        {form.orderType === 'limit' ? (
          form.bboEnabled ? (
            <PerpsProTradeBboField
              onPressStrategy={() => openSheet('bbo')}
              onPressToggle={controller.disableBbo}
              strategyLabel={bboLabels[form.bboStrategy]}
            />
          ) : (
            <PerpsProTradePriceField
              editable={configurationReady}
              label={`${t('page.perps.pro.trade.price')}(${quoteAsset})`}
              maxDecimals={market?.marketData.pxDecimals ?? 2}
              onChangeText={value => controller.setPrice('limitPrice', value)}
              onPressSuffix={
                form.attachedTpSl.enabled
                  ? undefined
                  : () => controller.enableBbo('cp1')
              }
              suffix="BBO"
              value={form.limitPrice}
            />
          )
        ) : null}
        {form.orderType === 'conditional' ? (
          <>
            <PerpsProTradePriceField
              editable={configurationReady}
              label={`${t('page.perps.pro.trade.triggerPrice')}(${quoteAsset})`}
              maxDecimals={market?.marketData.pxDecimals ?? 2}
              onChangeText={value => controller.setPrice('triggerPrice', value)}
              value={form.triggerPrice}
            />
            <PerpsProTradePriceField
              editable={
                configurationReady && form.conditionalExecution === 'limit'
              }
              label={
                form.conditionalExecution === 'limit'
                  ? `${t('page.perps.pro.trade.price')}(${quoteAsset})`
                  : t('page.perps.pro.trade.marketPrice')
              }
              maxDecimals={market?.marketData.pxDecimals ?? 2}
              onChangeText={value =>
                controller.setPrice('conditionalLimitPrice', value)
              }
              onPressSuffix={() =>
                controller.setConditionalExecution(
                  form.conditionalExecution === 'limit' ? 'market' : 'limit',
                )
              }
              suffix={
                form.conditionalExecution === 'limit'
                  ? t('page.perps.pro.trade.limit')
                  : t('page.perps.pro.trade.market')
              }
              value={
                form.conditionalExecution === 'limit'
                  ? form.conditionalLimitPrice
                  : ''
              }
              variant="conditionalExecution"
            />
          </>
        ) : null}
        <PerpsProTradeAmountField
          label={amountLabel}
          maxDecimals={controller.amountDecimals}
          onChangeText={controller.setAmount}
          onFocus={controller.beginAmountEntry}
          onPressIn={controller.beginAmountEntry}
          onToggleUnit={controller.toggleAmountUnit}
          unit={controller.amountUnitLabel}
          value={form.amount}
        />
        {controller.showAmountConversion && controller.resolvedAmount ? (
          <Text style={styles.convertedAmount}>
            ≈{' '}
            {form.amountUnit === 'quote'
              ? `${formatPerpsProDecimal(
                  controller.resolvedAmount.baseSize,
                  market?.marketData.szDecimals,
                )} ${market?.displayBase ?? '-'}`
              : `${formatPerpsProDecimal(
                  controller.resolvedAmount.quoteAmount,
                  2,
                )} ${quoteAsset}`}
          </Text>
        ) : null}
        <PerpsProTradeAmountSlider
          onChange={configurationReady ? controller.setPercentage : undefined}
          value={controller.percentage}
        />
      </View>
      <View style={styles.optionsGroup}>
        <PerpsProTradeSummaryRow
          label={t('page.perps.pro.trade.available')}
          onPressValue={
            configurationReady
              ? () =>
                  dismissKeyboardThen(() => {
                    onDeposit();
                  })
              : undefined
          }
          trailing={
            <RcIconAvailableAdd
              color={colors2024['neutral-title-1']}
              height={16}
              width={16}
            />
          }
          value={
            configurationReady
              ? `${formatPerpsProDecimal(
                  controller.availableQuote,
                  2,
                )} ${quoteAsset}`
              : `-- ${quoteAsset}`
          }
          valueTestID="perps-pro-trade-available-deposit"
        />
        {controller.attachedTpSlExecutionEnabled ? (
          <PerpsProTpSlFields
            controller={controller.tpSl}
            draft={form.attachedTpSl}
            pxDecimals={market?.marketData.pxDecimals ?? 2}
            quoteAsset={quoteAsset}
          />
        ) : null}
        <View style={styles.optionRow}>
          <PerpsProTradeCheckbox
            checked={form.reduceOnly}
            disabled={
              !configurationReady ||
              controller.reduceOnlyAvailability.checkboxDisabled
            }
            explanationKey="reduceOnly"
            label={t('page.perps.pro.trade.reduceOnly')}
            onPress={() => {
              const reduceOnly = !form.reduceOnly;
              controller.patchForm({
                attachedTpSl: reduceOnly
                  ? { ...form.attachedTpSl, enabled: false }
                  : form.attachedTpSl,
                reduceOnly,
              });
            }}
          />
          {form.orderType === 'limit' && !form.bboEnabled ? (
            <Pressable
              disabled={!configurationReady}
              onPress={() => openSheet('tif')}
              style={styles.tif}
              testID="perps-pro-trade-tif-trigger">
              <Text style={styles.tifText}>{tifLabels[form.tif]}</Text>
              <PerpsProSelectCaret
                color={colors2024['neutral-secondary']}
                testID="perps-pro-trade-tif-caret"
              />
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={styles.orderGroups}>
        {(['buy', 'sell'] as const).map(side => {
          const resolvedLiquidationPrice =
            controller.getEstimatedLiquidationPrice(side);
          const liquidationPrice = configurationReady
            ? resolvedLiquidationPrice
            : resolvedLiquidationPrice == null
            ? null
            : '--';
          const sliderAmount = configurationReady
            ? controller.getSliderButtonDisplayAmount(side)
            : null;
          return (
            <View key={side} style={styles.orderGroup}>
              <View style={styles.orderSummary}>
                {liquidationPrice != null ? (
                  <PerpsProTradeSummaryRow
                    dottedLabel
                    explanationKey="estimatedLiquidationPrice"
                    label={t('page.perps.pro.trade.liquidationPrice')}
                    value={
                      liquidationPrice === '--'
                        ? '--'
                        : `${formatPerpsProDecimal(
                            liquidationPrice,
                            market?.marketData.pxDecimals ?? 2,
                          )} ${quoteAsset}`
                    }
                  />
                ) : null}
                <PerpsProTradeSummaryRow
                  label={t('page.perps.pro.trade.max')}
                  value={
                    configurationReady
                      ? `${formatPerpsProDecimal(
                          controller.getMaxDisplayAmount(side),
                          form.amountUnit === 'base'
                            ? market?.marketData.szDecimals
                            : 2,
                        )} ${controller.amountUnitLabel}`
                      : `-- ${controller.amountUnitLabel}`
                  }
                />
                <PerpsProTradeSummaryRow
                  dottedLabel
                  explanationKey="cost"
                  label={t('page.perps.pro.trade.cost')}
                  value={
                    configurationReady
                      ? `${formatPerpsProDecimal(
                          controller.getCostDisplayAmount(side),
                          2,
                        )} ${quoteAsset}`
                      : `-- ${quoteAsset}`
                  }
                />
              </View>
              <PerpsProTradeButton
                disabled={controller.pending || !configurationReady}
                label={t(
                  `page.perps.pro.trade.${
                    side === 'buy' ? 'buyLong' : 'sellShort'
                  }`,
                )}
                onPress={() =>
                  dismissKeyboardThen(() => controller.requestReview(side))
                }
                side={side}
                subtitle={
                  sliderAmount == null
                    ? undefined
                    : `≈${formatPerpsProDecimal(
                        sliderAmount,
                        form.amountUnit === 'base'
                          ? market?.marketData.szDecimals
                          : 2,
                      )} ${controller.amountUnitLabel}`
                }
              />
            </View>
          );
        })}
      </View>

      <PerpsProOrderTypeSheet
        onClose={() => setSheet(null)}
        onSelect={controller.setOrderType}
        selected={form.orderType}
        visible={configurationReady && sheet === 'orderType'}
      />
      <PerpsProMarginModeSheet
        disabledValues={
          controller.marginModeDisabledReason
            ? [controller.marginMode === 'cross' ? 'isolated' : 'cross']
            : []
        }
        marketName={market?.displayBase ?? '-'}
        onClose={() => setSheet(null)}
        onSelect={controller.setMarginMode}
        selected={controller.marginMode}
        visible={configurationReady && sheet === 'margin'}
      />
      <PerpsProTifSheet
        onClose={() => setSheet(null)}
        onSelect={controller.setTif}
        selected={form.tif}
        visible={configurationReady && sheet === 'tif'}
      />
      <PerpsProBboSheet
        onClose={() => setSheet(null)}
        onSelect={controller.enableBbo}
        options={bboOptions}
        selected={form.bboStrategy}
        visible={configurationReady && sheet === 'bbo'}
      />
      <PerpsProLeverageSheet
        currentLeverage={controller.leverage}
        maxLeverage={market?.marketData.maxLeverage ?? 1}
        onClose={() => setSheet(null)}
        onConfirm={async value => {
          if (await controller.confirmLeverage(value)) {
            setSheet(null);
          }
        }}
        pending={controller.leveragePending}
        visible={configurationReady && sheet === 'leverage'}
      />
    </View>
  );
});

PerpsProTradeForm.displayName = 'PerpsProTradeForm';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: { gap: 16, minHeight: 416 },
  inputGroup: { gap: 8 },
  doubleRow: { flexDirection: 'row', gap: 8 },
  flexItem: { flex: 1, minWidth: 0 },
  optionsGroup: { gap: 8 },
  convertedAmount: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
    marginTop: -4,
    textAlign: 'center',
  },
  optionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tif: { alignItems: 'center', flexDirection: 'row', gap: 4, height: 18 },
  tifText: { color: colors2024['neutral-body'], fontSize: 12, lineHeight: 16 },
  orderGroups: { gap: 16 },
  orderGroup: { gap: 8 },
  orderSummary: { gap: 4 },
}));
