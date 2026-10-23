import React, { useEffect, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { NextSearchBar } from '@/components2024/SearchBar';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { IS_IOS } from '@/core/native/utils';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { MaxPriceImpactSelector } from '../components/MaxPriceImpactSelector';
import type { MaxPriceImpactPct } from '../ui/helpers';

const useKeyboardVisible = () => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(
      IS_IOS ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setVisible(true),
    );
    const hide = Keyboard.addListener(
      IS_IOS ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
};

export const MemeCoinHomeBottomBar = ({
  mode,
  selectedCount,
  keyword,
  onKeywordChange,
  maxPriceImpactPct,
  onMaxPriceImpactChange,
  onBuy,
  onSell,
}: {
  mode: 'market' | 'holdings';
  selectedCount: number;
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  maxPriceImpactPct: MaxPriceImpactPct;
  onMaxPriceImpactChange: (value: MaxPriceImpactPct) => void;
  onBuy: () => void;
  onSell: () => void;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const { safeOffBottom } = useSafeSizes();
  const keyboardVisible = useKeyboardVisible();
  const paddingBottom = keyboardVisible
    ? BOTTOM_BUTTON_TOP_OFFSET
    : getBottomButtonBottomOffset(safeOffBottom);

  return (
    <View style={[styles.bar, { paddingBottom }]}>
      {selectedCount === 0 ? (
        <NextSearchBar
          value={keyword}
          onChangeText={onKeywordChange}
          onCancel={() => onKeywordChange('')}
          placeholder={
            mode === 'market'
              ? t('page.memeCoin.searchMarket')
              : t('page.memeCoin.searchHoldings')
          }
          returnKeyType="search"
        />
      ) : mode === 'market' ? (
        <>
          <Button
            title={t('page.memeCoin.buyN', { count: selectedCount })}
            height={BOTTOM_BUTTON_SINGLE_HEIGHT}
            titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
            onPress={onBuy}
            noShadow
            type="primary"
          />
          <Text style={styles.caption}>{t('page.memeCoin.allocateTip')}</Text>
        </>
      ) : (
        <>
          <View style={styles.selector}>
            <MaxPriceImpactSelector
              value={maxPriceImpactPct}
              onChange={onMaxPriceImpactChange}
            />
          </View>
          <Button
            title={t('page.memeCoin.sellN', { count: selectedCount })}
            height={BOTTOM_BUTTON_SINGLE_HEIGHT}
            titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
            onPress={onSell}
            noShadow
            type="primary"
          />
        </>
      )}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  bar: {
    flexShrink: 0,
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
    paddingHorizontal: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    shadowColor: '#4B4E62',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 0 },
  },
  caption: {
    marginTop: 4,
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    textAlign: 'center',
    color: colors2024['neutral-body'],
  },
  selector: {
    marginBottom: 16,
  },
}));
