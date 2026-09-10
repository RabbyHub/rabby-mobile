import RcIconRabby from '@/assets2024/icons/common/rabby-wallet.svg';
import RcIconHyper from '@/assets2024/icons/perps/IconHyper.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { useShowTipsPopup } from '@/hooks/useTipsPopup';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { View } from 'react-native';

export type PerpsTradeFeeExplanationVariant = 'default' | 'pro';

type PerpsTradeFeeExplanationContentProps = {
  isLiquidation: boolean;
  variant?: PerpsTradeFeeExplanationVariant;
};

type UseShowPerpsTradeFeeExplanationOptions = {
  owner?: string;
  variant?: PerpsTradeFeeExplanationVariant;
};

export const PerpsTradeFeeExplanationContent: React.FC<
  PerpsTradeFeeExplanationContentProps
> = ({ isLiquidation, variant = 'default' }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const feeBoldStyle = variant === 'pro' ? styles.feeBoldPro : styles.feeBold;

  return (
    <View testID="perps-trade-fee-explanation-content">
      <Text style={styles.feeDesc}>
        <Trans
          i18nKey="page.perps.historyDetail.feeDesc"
          components={{
            1: <Text style={feeBoldStyle} />,
            2: <Text style={feeBoldStyle} />,
          }}
        />
      </Text>
      <View style={styles.feeTable}>
        <View style={styles.feeRow}>
          <View style={styles.feeRowLeft}>
            <RcIconHyper width={20} height={20} />
            <Text style={styles.feeRowLabel}>
              {t('page.perps.historyDetail.feeHyperliquid')}
            </Text>
          </View>
          <Text style={styles.feeRowValue}>0.045%</Text>
        </View>
        {!isLiquidation ? (
          <View style={styles.feeRow}>
            <View style={styles.feeRowLeft} testID="perps-trade-fee-rabby-left">
              <RcIconRabby width={20} height={20} />
              <Text style={styles.feeRowLabel}>
                {t('page.perps.historyDetail.feeRabby')}
              </Text>
            </View>
            <View
              style={styles.feeRowRight}
              testID="perps-trade-fee-rabby-right">
              <View style={styles.feeRowValueRow}>
                <Text style={styles.feeRowValue}>0.02%</Text>
                <Text style={styles.feeRowValueOrigin}>0.04%</Text>
              </View>
              <Text
                style={styles.feeRowDiscount}
                testID="perps-trade-fee-rabby-discount">
                {t('page.perps.historyDetail.feeRabbyDiscount')}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export const useShowPerpsTradeFeeExplanation = ({
  owner,
  variant = 'default',
}: UseShowPerpsTradeFeeExplanationOptions = {}) => {
  const { t } = useTranslation();
  const showTipsPopup = useShowTipsPopup();

  return useCallback(
    (isLiquidation: boolean) => {
      showTipsPopup({
        title: t('page.perps.historyDetail.feeTitle'),
        desc: (
          <PerpsTradeFeeExplanationContent
            isLiquidation={isLiquidation}
            variant={variant}
          />
        ),
        buttonType: 'hyperliquid',
        owner,
      });
    },
    [owner, showTipsPopup, t, variant],
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  feeDesc: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  feeBold: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  feeBoldPro: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  feeTable: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
    overflow: 'hidden',
  },
  feeRow: {
    alignItems: 'center',
    borderBottomColor: colors2024['neutral-line'],
    borderBottomWidth: 0.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  feeRowLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8,
  },
  feeRowLabel: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  feeRowValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  feeRowRight: {
    alignItems: 'flex-end',
    flex: 1,
    gap: 2,
    marginLeft: 12,
    minWidth: 0,
  },
  feeRowValueRow: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: 6,
  },
  feeRowValueOrigin: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    textDecorationLine: 'line-through',
  },
  feeRowDiscount: {
    alignSelf: 'stretch',
    color: colors2024['neutral-foot'],
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14,
    textAlign: 'right',
  },
}));
