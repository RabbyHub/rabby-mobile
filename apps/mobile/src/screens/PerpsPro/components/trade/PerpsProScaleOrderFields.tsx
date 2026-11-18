import React, { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text, type TextInput } from '@/components/Typography';
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
import { PerpsProTradeAmountField } from './PerpsProTradeAmountField';
import { PerpsProDottedUnderlineText } from '../common/PerpsProDottedUnderlineText';
import { PerpsProSelectCaret } from '../common/PerpsProSelectCaret';

export const PerpsProScaleOrderFields = React.memo(
  ({
    amountInputRef,
    controller,
    onDistributionHelp,
    onTif,
  }: {
    amountInputRef: React.Ref<TextInput>;
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
        <PerpsProTradeAmountField
          label={`${t('page.perps.pro.scaleOrder.size')} (${
            market?.displayBase ?? '-'
          })`}
          maxDecimals={decimals}
          onChangeText={controller.setAmount}
          value={form.amount}
          ref={amountInputRef}
          variant="compact"
          onFocus={controller.beginAmountEntry}
          onBlur={controller.endAmountEntry}
        />
        <PerpsProTradeAmountField
          label={t('page.perps.pro.scaleOrder.count')}
          maxDecimals={0}
          keyboardType="number-pad"
          inputMode="numeric"
          onChangeText={value => controller.patchForm({ scaleCount: value })}
          value={form.scaleCount}
          variant="compact"
        />
        <View style={styles.distribution}>
          <View style={styles.row}>
            <PerpsProDottedUnderlineText
              onPress={onDistributionHelp}
              style={styles.help}>
              {t('page.perps.pro.scaleOrder.distribution')}
            </PerpsProDottedUnderlineText>
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

const getStyle = createGetStyles2024(({ colors2024 }) => ({
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
