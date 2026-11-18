import React, { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import AscendingIcon from '@/assets2024/icons/perps/PerpsProScaleAscending.svg';
import DescendingIcon from '@/assets2024/icons/perps/PerpsProScaleDescending.svg';
import SelectedRadio from '@/assets2024/icons/perps/PerpsProScaleRadioSelected.svg';
import Radio from '@/assets2024/icons/perps/PerpsProScaleRadio.svg';
import type { PerpsProTradeController } from '../../scene/usePerpsProTrade';
import {
  getPerpsProPriceInputMaxDecimals,
  sanitizePerpsProPriceEditingInput,
  sanitizePerpsProPriceInput,
} from '../../model/trade';
import { PerpsProTradePriceField } from './PerpsProTradePriceField';
import { PerpsProDecimalTextInput } from './PerpsProDecimalTextInput';
import { PerpsProSelectCaret } from '../common/PerpsProSelectCaret';
import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';

export const PerpsProScaleOrderFields = React.memo(
  ({
    controller,
    onDistributionHelp,
    onTif,
  }: {
    controller: PerpsProTradeController;
    onDistributionHelp: () => void;
    onTif: () => void;
  }) => {
    const { t } = useTranslation();
    const { styles, colors2024 } = useTheme2024({ getStyle });
    const { form, market } = controller;
    const decimals = market?.marketData.szDecimals ?? 0;
    const normalize = useCallback(
      (value: string) => sanitizePerpsProPriceEditingInput(value, decimals),
      [decimals],
    );
    const canonicalize = useCallback(
      (value: string) => sanitizePerpsProPriceInput(value, decimals),
      [decimals],
    );
    return (
      <>
        {(['scaleLowerPrice', 'scaleUpperPrice'] as const).map(field => (
          <PerpsProTradePriceField
            key={field}
            label={t(
              `page.perps.pro.scaleOrder.${
                field === 'scaleLowerPrice' ? 'lowerPrice' : 'upperPrice'
              }`,
            )}
            maxDecimals={getPerpsProPriceInputMaxDecimals(decimals)}
            normalizeValue={normalize}
            canonicalizeValueOnBlur={canonicalize}
            onChangeText={value => controller.patchForm({ [field]: value })}
            value={form[field]}
            variant="scale"
          />
        ))}
        <View style={styles.compactField}>
          <Text style={styles.fieldLabel} numberOfLines={1}>
            {t('page.perps.pro.scaleOrder.size')} ({market?.displayBase ?? '-'})
          </Text>
          <PerpsProDecimalTextInput
            accessibilityLabel={t('page.perps.pro.scaleOrder.size')}
            keyboardScrollTrade
            maxDecimals={decimals}
            onChangeText={controller.setAmount}
            value={form.amount}
            style={styles.input}
            onFocus={controller.beginAmountEntry}
            onBlur={controller.endAmountEntry}
          />
        </View>
        <View style={styles.compactField}>
          <Text style={styles.fieldLabel} numberOfLines={1}>
            {t('page.perps.pro.scaleOrder.count')}
          </Text>
          <PerpsProDecimalTextInput
            accessibilityLabel={t('page.perps.pro.scaleOrder.count')}
            keyboardScrollTrade
            maxDecimals={0}
            keyboardType="number-pad"
            inputMode="numeric"
            onChangeText={value => controller.patchForm({ scaleCount: value })}
            value={form.scaleCount}
            style={styles.input}
          />
        </View>
        <View style={styles.distribution}>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" onPress={onDistributionHelp}>
              <Text style={styles.help}>
                {t('page.perps.pro.scaleOrder.distribution')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onTif}
              style={styles.tif}>
              <Text style={styles.secondary}>TIF</Text>
              <Text style={styles.label}>{form.tif.toUpperCase()}</Text>
              <PerpsProSelectCaret color={colors2024['neutral-secondary']} />
            </Pressable>
          </View>
          <View style={styles.choices}>
            {(['flat', 'ascending', 'descending'] as const).map(
              distribution => {
                const Checked =
                  form.scaleDistribution === distribution
                    ? SelectedRadio
                    : Radio;
                const Icon =
                  distribution === 'ascending' ? AscendingIcon : DescendingIcon;
                return (
                  <Pressable
                    key={distribution}
                    accessibilityRole="radio"
                    accessibilityLabel={t(
                      `page.perps.pro.scaleOrder.${distribution}`,
                    )}
                    accessibilityState={{
                      checked: form.scaleDistribution === distribution,
                    }}
                    onPress={() =>
                      controller.patchForm({ scaleDistribution: distribution })
                    }
                    style={styles.choice}>
                    <Checked
                      width={20}
                      height={20}
                      color={
                        colors2024[
                          form.scaleDistribution === distribution
                            ? 'neutral-title-1'
                            : 'neutral-line'
                        ]
                      }
                      fill={colors2024['neutral-bg-1']}
                    />
                    {distribution === 'flat' ? (
                      <Text style={styles.label}>
                        {t('page.perps.pro.scaleOrder.flat')}
                      </Text>
                    ) : (
                      <Icon
                        width={14}
                        height={14}
                        color={colors2024['neutral-title-1']}
                      />
                    )}
                  </Pressable>
                );
              },
            )}
          </View>
        </View>
      </>
    );
  },
);
PerpsProScaleOrderFields.displayName = 'PerpsProScaleOrderFields';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  compactField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 34,
    borderRadius: 6,
    backgroundColor: colors2024[isLight ? 'neutral-bg-0' : 'neutral-bg-5'],
  },
  fieldLabel: {
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-info'],
  },
  input: {
    ...PERPS_PRO_NUMBER_STYLE,
    flex: 1,
    minWidth: 48,
    height: 34,
    padding: 0,
    paddingLeft: 4,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-title-1'],
    textAlign: 'right',
    includeFontPadding: false,
  },
  distribution: { gap: 8, marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  choices: { flexDirection: 'row', gap: 8 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tif: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  help: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-secondary'],
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
  secondary: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-secondary'],
  },
  label: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-title-1'],
  },
}));
