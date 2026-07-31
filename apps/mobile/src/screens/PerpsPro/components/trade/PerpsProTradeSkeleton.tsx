import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

const DisabledSelect: React.FC<{ label: string }> = ({ label }) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.select}>
      <Text numberOfLines={1} style={styles.selectText}>
        {label}
      </Text>
      <Text style={styles.caret}>⌄</Text>
    </View>
  );
};

const SummaryRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.summaryRow}>
      <Text numberOfLines={1} style={styles.summaryLabel}>
        {label}
      </Text>
      <Text numberOfLines={1} style={styles.summaryValue}>
        {value}
      </Text>
    </View>
  );
};

export const PerpsProTradeSkeleton: React.FC<{
  quoteAsset: string;
}> = React.memo(({ quoteAsset }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View
      accessibilityLabel={t('page.perps.pro.trade.disabledFrame')}
      accessibilityState={{ disabled: true }}
      style={styles.container}>
      <View style={styles.doubleRow}>
        <View style={styles.flexItem}>
          <DisabledSelect label={t('page.perps.pro.trade.isolated')} />
        </View>
        <View style={styles.flexItem}>
          <DisabledSelect label="25x" />
        </View>
      </View>
      <DisabledSelect label={t('page.perps.pro.trade.market')} />
      <View style={styles.input}>
        <Text style={styles.inputPlaceholder}>
          {t('page.perps.pro.trade.amount')}
        </Text>
        <Text style={styles.inputUnit}>{quoteAsset}</Text>
      </View>
      <View style={styles.slider}>
        <View style={styles.sliderLine} />
        {[0, 1, 2, 3, 4].map(point => (
          <View key={point} style={styles.sliderPoint} />
        ))}
      </View>
      <SummaryRow
        label={t('page.perps.pro.trade.available')}
        value={`- ${quoteAsset}`}
      />
      <View style={styles.checkboxRow}>
        <View style={styles.checkbox} />
        <Text style={styles.checkboxLabel}>TP/SL</Text>
      </View>
      <View style={styles.checkboxRow}>
        <View style={styles.checkbox} />
        <Text style={styles.checkboxLabel}>
          {t('page.perps.pro.trade.reduceOnly')}
        </Text>
      </View>
      <View style={styles.orderGroups}>
        <View style={styles.orderGroup}>
          <View style={styles.orderSummary}>
            <SummaryRow
              label={t('page.perps.pro.trade.max')}
              value={`- ${quoteAsset}`}
            />
            <SummaryRow
              label={t('page.perps.pro.trade.cost')}
              value={`- ${quoteAsset}`}
            />
          </View>
          <View style={[styles.tradeButton, styles.buyButton]}>
            <Text style={styles.tradeButtonText}>
              {t('page.perps.pro.trade.buyLong')}
            </Text>
          </View>
        </View>
        <View style={styles.orderGroup}>
          <View style={styles.orderSummary}>
            <SummaryRow
              label={t('page.perps.pro.trade.max')}
              value={`- ${quoteAsset}`}
            />
            <SummaryRow
              label={t('page.perps.pro.trade.cost')}
              value={`- ${quoteAsset}`}
            />
          </View>
          <View style={[styles.tradeButton, styles.sellButton]}>
            <Text style={styles.tradeButtonText}>
              {t('page.perps.pro.trade.sellShort')}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
});

PerpsProTradeSkeleton.displayName = 'PerpsProTradeSkeleton';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    gap: 8,
    height: 440,
  },
  doubleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  flexItem: {
    flex: 1,
    minWidth: 0,
  },
  select: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 8,
    flexDirection: 'row',
    height: 26,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  selectText: {
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  caret: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    lineHeight: 14,
  },
  input: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 8,
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  inputPlaceholder: {
    color: colors2024['neutral-secondary'],
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
  },
  inputUnit: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  slider: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 24,
    justifyContent: 'space-between',
    position: 'relative',
  },
  sliderLine: {
    backgroundColor: colors2024['neutral-line'],
    height: 2,
    left: 4,
    position: 'absolute',
    right: 4,
  },
  sliderPoint: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderColor: colors2024['neutral-line'],
    borderRadius: 5,
    borderWidth: 1,
    height: 9,
    width: 9,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 16,
  },
  summaryLabel: {
    color: colors2024['neutral-secondary'],
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    lineHeight: 14,
  },
  summaryValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
    marginLeft: 4,
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: 24,
  },
  checkbox: {
    borderColor: colors2024['neutral-line'],
    borderRadius: 3,
    borderWidth: 1,
    height: 18,
    width: 18,
  },
  checkboxLabel: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    lineHeight: 14,
  },
  orderGroups: {
    gap: 12,
    height: 196,
  },
  orderGroup: {
    gap: 8,
    height: 92,
  },
  orderSummary: {
    gap: 4,
    height: 36,
  },
  tradeButton: {
    alignItems: 'center',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
  },
  buyButton: {
    backgroundColor: colors2024['green-default'],
  },
  sellButton: {
    backgroundColor: colors2024['red-default'],
  },
  tradeButtonText: {
    color: colors2024['neutral-bg-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
}));
