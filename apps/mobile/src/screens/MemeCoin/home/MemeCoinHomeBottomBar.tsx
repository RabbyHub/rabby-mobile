import React, { useEffect, useState } from 'react';
import { Keyboard, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RcNextSearchCC } from '@/assets/icons/common';
import { Button } from '@/components2024/Button';
import { NextSearchBar } from '@/components2024/SearchBar';
import {
  BOTTOM_BUTTON_GAP,
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { IS_IOS } from '@/core/native/utils';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { MaxPriceImpactSelector } from '../components/MaxPriceImpactSelector';
import { MEME_BOTTOM_BAR_SHADOW } from '../ui/bottomBarShadow';
import type { MaxPriceImpactPct } from '../ui/helpers';
import { BuyAmountField } from './BuyAmountField';

export const useKeyboardVisible = () => {
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

const ACTION_ROW_GAP = 16;

const PLACEHOLDER_TITLE_STYLE = {
  color: 'rgba(255, 255, 255, 0.6)',
  opacity: 0.8,
};

const PlaceholderButton = ({ title }: { title: string }) => (
  <Button
    title={title}
    height={BOTTOM_BUTTON_SINGLE_HEIGHT}
    disabledTitleStyle={PLACEHOLDER_TITLE_STYLE}
    disabled
    noShadow
    type="primary"
  />
);

const ActionRow = ({
  title,
  disabled,
  onPress,
  onCancel,
}: {
  title: string;
  disabled?: boolean;
  onPress: () => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.actionRow}>
      <Button
        title={title}
        height={BOTTOM_BUTTON_SINGLE_HEIGHT}
        containerStyle={styles.actionMain}
        disabled={disabled}
        onPress={onPress}
        noShadow
        type="primary"
      />
      <Button
        title={t('global.Cancel')}
        height={BOTTOM_BUTTON_SINGLE_HEIGHT}
        buttonStyle={styles.cancelButton}
        onPress={onCancel}
        type="plain"
      />
    </View>
  );
};

export const MemeCoinHomeBottomBar = ({
  mode,
  selectedCount,
  searching,
  onStartSearch,
  onCancelSearch,
  keyword,
  onKeywordChange,
  amountText,
  onChangeAmount,
  buyDisabled,
  maxPriceImpactPct,
  onMaxPriceImpactChange,
  onBuy,
  onSell,
  onCancelSelection,
}: {
  mode: 'market' | 'holdings';
  selectedCount: number;
  searching: boolean;
  onStartSearch: () => void;
  onCancelSearch: () => void;
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  amountText: string;
  onChangeAmount: (text: string) => void;
  buyDisabled: boolean;
  maxPriceImpactPct: MaxPriceImpactPct;
  onMaxPriceImpactChange: (value: MaxPriceImpactPct) => void;
  onBuy: () => void;
  onSell: () => void;
  onCancelSelection: () => void;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { safeOffBottom } = useSafeSizes();
  const keyboardVisible = useKeyboardVisible();
  const paddingBottom = keyboardVisible
    ? BOTTOM_BUTTON_TOP_OFFSET
    : getBottomButtonBottomOffset(safeOffBottom);

  let content: React.ReactNode;
  if (mode === 'holdings') {
    content =
      selectedCount === 0 ? (
        <PlaceholderButton title={t('page.memeCoin.selectToSell')} />
      ) : (
        <>
          <MaxPriceImpactSelector
            value={maxPriceImpactPct}
            onChange={onMaxPriceImpactChange}
          />
          <ActionRow
            title={t('page.memeCoin.sellN', { count: selectedCount })}
            onPress={onSell}
            onCancel={onCancelSelection}
          />
        </>
      );
  } else if (selectedCount > 0) {
    content = (
      <>
        <BuyAmountField
          amountText={amountText}
          onChangeAmount={onChangeAmount}
        />
        <ActionRow
          title={t('page.memeCoin.buyN', { count: selectedCount })}
          disabled={buyDisabled}
          onPress={onBuy}
          onCancel={onCancelSelection}
        />
      </>
    );
  } else if (searching) {
    content = (
      <NextSearchBar
        autoFocus
        alwaysShowCancel
        value={keyword}
        onChangeText={onKeywordChange}
        onCancel={onCancelSearch}
        placeholder={t('page.memeCoin.searchMarket')}
        returnKeyType="search"
      />
    );
  } else {
    content = (
      <View style={styles.idleRow}>
        <View style={styles.idlePlaceholder}>
          <PlaceholderButton title={t('page.memeCoin.selectToBuy')} />
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onStartSearch}
          style={styles.searchButton}>
          <RcNextSearchCC
            width={20}
            height={20}
            color={colors2024['neutral-foot']}
          />
        </TouchableOpacity>
      </View>
    );
  }

  return <View style={[styles.bar, { paddingBottom }]}>{content}</View>;
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
  actionRow: {
    flexDirection: 'row',
    gap: ACTION_ROW_GAP,
  },
  actionMain: {
    flex: 1,
    minWidth: 0,
  },
  // Button's inner view defaults to width 100%, which stretches past the title
  // in a row where the button sizes to its content.
  cancelButton: {
    width: 'auto',
    paddingHorizontal: 20,
  },
  idleRow: {
    flexDirection: 'row',
    gap: BOTTOM_BUTTON_GAP,
  },
  idlePlaceholder: {
    flex: 1,
    minWidth: 0,
  },
  searchButton: {
    width: BOTTOM_BUTTON_SINGLE_HEIGHT,
    height: BOTTOM_BUTTON_SINGLE_HEIGHT,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
  },
}));
