import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components2024/Button';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { MaxPriceImpactSelector } from '../components/MaxPriceImpactSelector';
import { MEME_BOTTOM_BAR_SHADOW } from '../ui/bottomBarShadow';
import { MEME_BUTTON_DISABLED_TITLE_STYLE } from '../ui/buttonStyles';
import { formatUsdNoZeroCents } from '../ui/formatBalance';
import type { BuySummary, MaxPriceImpactPct } from '../ui/helpers';

export const BuyPreviewBar = ({
  summary,
  maxPriceImpactPct,
  onMaxPriceImpactChange,
  disabled,
  onPreview,
}: {
  summary: BuySummary;
  maxPriceImpactPct: MaxPriceImpactPct;
  onMaxPriceImpactChange: (value: MaxPriceImpactPct) => void;
  disabled: boolean;
  onPreview: () => void;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const { safeOffBottom } = useSafeSizes();

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: getBottomButtonBottomOffset(safeOffBottom) },
      ]}>
      <MaxPriceImpactSelector
        value={maxPriceImpactPct}
        onChange={onMaxPriceImpactChange}
      />
      <Button
        title={
          summary.kind === 'short'
            ? t('page.memeCoin.buy.anotherNeeded', {
                amount: formatUsdNoZeroCents(summary.shortfallUsd),
              })
            : t('page.memeCoin.buy.preview')
        }
        height={BOTTOM_BUTTON_SINGLE_HEIGHT}
        disabledTitleStyle={MEME_BUTTON_DISABLED_TITLE_STYLE}
        disabled={disabled}
        onPress={onPreview}
        noShadow
        type="primary"
      />
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  bar: {
    flexShrink: 0,
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
    paddingHorizontal: 20,
    gap: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    boxShadow: MEME_BOTTOM_BAR_SHADOW[isLight ? 'light' : 'dark'],
  },
}));
