import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Skeleton } from '@rneui/themed';
import { useTranslation } from 'react-i18next';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { createGetStyles2024 } from '@/utils/styles';
import { MemeEmptyState } from '../components/MemeEmptyState';
import { tokenKey } from '../engine/keys';
import type { PaymentAsset } from '../engine/types';
import {
  MEME_BUTTON_DISABLED_TITLE_STYLE,
  MEME_BUTTON_TITLE_STYLE,
} from '../ui/buttonStyles';
import { formatUsdNoZeroCents } from '../ui/formatBalance';
import type { BuySummary } from '../ui/helpers';
import {
  PAYMENT_ROW_GAP,
  PAYMENT_ROW_HEIGHT,
  PaymentAssetRow,
} from './PaymentAssetRow';

const SKELETON_ROWS = 4;
const VISIBLE_ROWS = 5;
const LIST_HEIGHT = VISIBLE_ROWS * (PAYMENT_ROW_HEIGHT + PAYMENT_ROW_GAP);
const HANDLE_HEIGHT = 36;
const TITLE_TOP = 12;
const TITLE_HEIGHT = 24;
const TITLE_BOTTOM = 24;
// the last row's own margin adds up to the 16 in Figma
const LIST_BOTTOM = 8;
const SHEET_HEIGHT_ABOVE_SAFE_OFFSET =
  HANDLE_HEIGHT +
  TITLE_TOP +
  TITLE_HEIGHT +
  TITLE_BOTTOM +
  LIST_HEIGHT +
  LIST_BOTTOM +
  BOTTOM_BUTTON_TOP_OFFSET +
  BOTTOM_BUTTON_SINGLE_HEIGHT;

const SHEET_STYLE = {
  overflow: 'hidden',
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
} as const;

export const PaymentTokenSelectSheet = ({
  visible,
  onClose,
  assets,
  selectedKeys,
  onToggle,
  listReady,
  paymentBySource,
  summary,
  logoByKey,
}: {
  visible: boolean;
  onClose: () => void;
  assets: PaymentAsset[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
  listReady: boolean;
  paymentBySource: Record<string, number>;
  summary: BuySummary;
  logoByKey: ReadonlyMap<string, string>;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { safeOffBottom } = useSafeSizes();
  const modalRef = useRef<AppBottomSheetModal>(null);
  const bottomOffset = getBottomButtonBottomOffset(safeOffBottom);
  const snapPoints = useMemo(
    () => [SHEET_HEIGHT_ABOVE_SAFE_OFFSET + bottomOffset],
    [bottomOffset],
  );

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible]);

  let list: React.ReactNode;
  if (!listReady) {
    list = Array.from({ length: SKELETON_ROWS }).map((_, index) => (
      <Skeleton
        key={index}
        height={PAYMENT_ROW_HEIGHT}
        style={styles.skeletonRow}
      />
    ));
  } else if (!assets.length) {
    list = <MemeEmptyState text={t('page.memeCoin.buy.noAssets')} />;
  } else {
    list = assets.map(asset => {
      const key = tokenKey(asset);
      const selected = selectedKeys.includes(key);
      return (
        <PaymentAssetRow
          key={key}
          itemKey={key}
          logoUrl={logoByKey.get(key) || ''}
          chain={asset.chain}
          symbol={asset.symbol}
          usdValue={asset.usdValue}
          estPaymentUsd={selected ? paymentBySource[key] ?? 0 : undefined}
          selected={selected}
          onPress={onToggle}
        />
      );
    });
  }

  const buttonTitle =
    summary.kind === 'none'
      ? t('page.memeCoin.buy.needed', {
          amount: formatUsdNoZeroCents(summary.neededUsd),
        })
      : summary.kind === 'short'
      ? t('page.memeCoin.buy.anotherNeeded', {
          amount: formatUsdNoZeroCents(summary.shortfallUsd),
        })
      : t('page.memeCoin.buy.confirm');

  return (
    <AppBottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      onDismiss={onClose}
      {...makeBottomSheetProps({
        linearGradientType: isLight ? 'bg0' : 'bg1',
        colors: colors2024,
      })}
      style={SHEET_STYLE}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {t('page.memeCoin.buy.selectPaymentAssets')}
        </Text>
        <BottomSheetScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}>
          {list}
        </BottomSheetScrollView>
        <View style={[styles.footer, { paddingBottom: bottomOffset }]}>
          <Button
            title={buttonTitle}
            height={BOTTOM_BUTTON_SINGLE_HEIGHT}
            titleStyle={MEME_BUTTON_TITLE_STYLE}
            disabledTitleStyle={MEME_BUTTON_DISABLED_TITLE_STYLE}
            disabled={summary.kind !== 'enough'}
            onPress={onClose}
            noShadow
            type="primary"
          />
        </View>
      </View>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  content: {
    flex: 1,
  },
  title: {
    marginTop: TITLE_TOP,
    marginBottom: TITLE_BOTTOM,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: TITLE_HEIGHT,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  list: {
    height: LIST_HEIGHT,
    flexGrow: 0,
  },
  listContent: {
    paddingHorizontal: 12,
  },
  skeletonRow: {
    width: '100%',
    marginBottom: PAYMENT_ROW_GAP,
    borderRadius: 14,
  },
  footer: {
    marginTop: LIST_BOTTOM,
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
    paddingHorizontal: 20,
  },
}));
