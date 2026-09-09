import React, { useEffect, useMemo } from 'react';
import { View, Image, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import RCIconRabbyWhite from '@/assets2024/icons/bridge/FeeRabbyWallet.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  RABBY_FEE_DISCOUNT_CASES,
  type RabbyFeeTier,
} from '@/screens/Swap/hooks/fee';
import { getBottomButtonBottomOffset } from '@/constant/layout';
import { Button } from '@/components2024/Button';
import { AppBottomSheetModal } from '../customized/BottomSheet';
import { useSheetModal } from '@/hooks/useSheetModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEX } from '@/constant/swap';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Text } from '@/components/Typography';

/** Explains the applicable fee discounts and highlights the current tier. */
export const RabbyFeePopup = ({
  visible,
  onClose,
  type = 'swap',
  feeTier,
  dexFeeDesc,
  dexName,
}: {
  visible: boolean;
  onClose: () => void;
  type?: keyof typeof RABBY_FEE_DISCOUNT_CASES;
  feeTier?: RabbyFeeTier;
  dexFeeDesc?: string;
  dexName?: string;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const { sheetModalRef } = useSheetModal();

  const hasSwapDexFee = useMemo(() => {
    return type === 'swap' && dexName && dexFeeDesc && DEX?.[dexName]?.logo;
  }, [type, dexName, dexFeeDesc]);

  const { height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();

  const snapPoints = useMemo(
    () => [
      Math.min(
        (type === 'swap' ? 524 : 428) +
          getBottomButtonBottomOffset(bottom) +
          (hasSwapDexFee ? 60 : 0),
        height,
      ),
    ],
    [type, hasSwapDexFee, bottom, height],
  );

  useEffect(() => {
    if (visible) {
      sheetModalRef.current?.present();
    } else {
      sheetModalRef.current?.dismiss();
    }
  }, [sheetModalRef, visible]);

  return (
    <AppBottomSheetModal
      ref={sheetModalRef}
      snapPoints={snapPoints}
      enableDismissOnClose
      onDismiss={onClose}
      handleStyle={styles.handle}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.sheetBg}>
      <BottomSheetScrollView>
        <View
          style={[
            styles.contentContainer,
            { paddingBottom: getBottomButtonBottomOffset(bottom) },
          ]}>
          <View style={styles.iconContainer}>
            <RCIconRabbyWhite width={70} height={70} />
          </View>

          <Text style={styles.title}>
            {t('page.swap.rabbyFee.discountTitle')}
          </Text>

          <View style={styles.listContainer}>
            <View style={styles.header}>
              <Text style={styles.headerText}>
                {t('page.swap.rabbyFee.case')}
              </Text>
              <Text style={styles.headerText}>
                {t('page.swap.rabbyFee.rate')}
              </Text>
            </View>
            {RABBY_FEE_DISCOUNT_CASES[type].map((item, idx, list) => (
              <View
                key={item}
                style={[
                  styles.listItem,
                  idx === list.length - 1 && styles.noBorder,
                ]}>
                <Text
                  style={[
                    styles.itemText,
                    item === feeTier && styles.highItem,
                  ]}>
                  {t(`page.swap.rabbyFee.cases.${item}`)}
                </Text>
                <Text
                  style={[
                    styles.itemText,
                    styles.rateText,
                    item === feeTier && styles.highItem,
                  ]}>
                  {item === 'hundredThousand'
                    ? '50%'
                    : t('page.swap.rabbyFee.free')}
                </Text>
              </View>
            ))}
          </View>

          <SwapAggregatorFee dexName={dexName} feeDexDesc={dexFeeDesc} />

          <View style={styles.buttonContainer}>
            <Button
              type="primary"
              onPress={onClose}
              title={t('page.swap.rabbyFee.button')}
            />
          </View>
        </View>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

function SwapAggregatorFee({
  dexName,
  feeDexDesc,
}: {
  dexName?: string;
  feeDexDesc?: string;
}) {
  const { styles } = useTheme2024({ getStyle });
  const { width } = useWindowDimensions();
  if (dexName && feeDexDesc && DEX?.[dexName]?.logo) {
    return (
      <View style={styles.dexFeeContainer}>
        <Image source={DEX[dexName].logo} style={styles.dexFeeLogo} />
        <View>
          <Text style={[styles.dexFeeText, { maxWidth: width - 40 - 14 - 2 }]}>
            {feeDexDesc}
          </Text>
        </View>
      </View>
    );
  }
  return null;
}

const getStyle = createGetStyles2024(({ colors2024, colors }) => ({
  sheetBg: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  handle: {
    height: 23,
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  handleIndicator: {
    width: 50,
    height: 6,
    backgroundColor: colors2024['neutral-sheet-handle'],
  },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  iconContainer: {
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 45,
    backgroundColor: colors['blue-default'],
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
    marginTop: 16,
    marginBottom: 24,
  },
  header: {
    backgroundColor: colors2024['neutral-bg-2'],
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: colors2024['neutral-line'],
  },
  headerText: {
    color: colors2024['neutral-secondary'],
    fontSize: 17,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    lineHeight: 22,
  },
  listContainer: {
    width: '100%',
    borderWidth: 0.5,
    borderColor: colors2024['neutral-line'],
    borderRadius: 24,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
    borderBottomWidth: 0.5,
    borderBottomColor: colors2024['neutral-line'],
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  itemText: {
    color: colors2024['neutral-body'],
    fontSize: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    lineHeight: 20,
  },
  rateText: {
    color: colors2024['neutral-foot'],
  },
  highItem: {
    color: colors2024['brand-default'],
    fontWeight: '700',
  },
  dexFeeContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    marginTop: 20,
    gap: 3,
  },
  dexFeeLogo: {
    flexBasis: 14,
    width: 14,
    height: 14,
    borderRadius: 999999,
  },
  dexFeeText: {
    flexShrink: 0,
    fontSize: 13,
    color: colors2024['neutral-foot'],
  },
  buttonContainer: {
    width: '100%',
    marginTop: 24,
  },
}));
