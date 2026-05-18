import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import AutoLockView from '@/components/AutoLockView';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { splitNumberByStep } from '@/utils/number';
import {
  computeLimitPriceDeviation,
  formatPerpsCoin,
  formatTpOrSlPrice,
} from '@/utils/perps';
import {
  PERPS_LIMIT_PRICE_BLOCK_PCT,
  PERPS_LIMIT_PRICE_CONFIRM_PCT,
} from '@/constant/perps';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { useMemoizedFn, useRequest } from 'ahooks';
import IconPerpEdit from '@/assets2024/icons/perps/IconPerpEdit.svg';
import { useSlTpUsdInput } from '@/hooks/useUsdInput';
import { Text } from '@/components/Typography';

interface Props {
  coin: string;
  quoteAsset: string;
  markPrice: number;
  szDecimals: number;
  direction: 'Long' | 'Short';
  initLimitPrice: string;
  handleSetLimitPx: (price: string) => Promise<void> | void;
}

const QUICK_OPTIONS: { label: string; pct: number | 'mid' }[] = [
  { label: '-1%', pct: -0.01 },
  { label: '-0.3%', pct: -0.003 },
  { label: 'Mid', pct: 'mid' },
  { label: '+0.3%', pct: 0.003 },
  { label: '+1%', pct: 0.01 },
];

export const PerpEditLimitPriceTag: React.FC<Props> = ({
  coin,
  quoteAsset,
  markPrice,
  szDecimals,
  direction,
  initLimitPrice,
  handleSetLimitPx,
}) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const [modalVisible, setModalVisible] = React.useState(false);
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const {
    value: limitPrice,
    onChangeText: setLimitPrice,
    displayedValue,
  } = useSlTpUsdInput({ szDecimals });

  const deviation = useMemo(
    () => computeLimitPriceDeviation(limitPrice, markPrice),
    [limitPrice, markPrice],
  );

  const blockedByProtection =
    Number(limitPrice) > 0 && deviation >= PERPS_LIMIT_PRICE_BLOCK_PCT;

  const needsConfirm =
    Number(limitPrice) > 0 &&
    deviation >= PERPS_LIMIT_PRICE_CONFIRM_PCT &&
    deviation < PERPS_LIMIT_PRICE_BLOCK_PCT;

  const isValid = Number(limitPrice) > 0 && !blockedByProtection;

  const handleQuickPress = useMemoizedFn(
    (opt: (typeof QUICK_OPTIONS)[number]) => {
      const targetPx =
        opt.pct === 'mid' ? markPrice : markPrice * (1 + opt.pct);
      const next = formatTpOrSlPrice(targetPx, szDecimals);
      setLimitPrice(next);
    },
  );

  const handleInputChange = useMemoizedFn((v: string) => {
    setLimitPrice(v);
  });

  const { runAsync: handleSet, loading } = useRequest(
    async () => {
      await handleSetLimitPx(limitPrice);
    },
    {
      manual: true,
      onSuccess: () => setModalVisible(false),
    },
  );

  const handleConfirmPress = useMemoizedFn(() => {
    if (!isValid || loading) {
      return;
    }
    if (needsConfirm) {
      Alert.alert(
        t('page.perpsDetail.PerpEditLimitPriceTag.confirmTitle'),
        t('page.perpsDetail.PerpEditLimitPriceTag.confirmMessage'),
        [
          {
            text: t('page.perpsDetail.PerpEditLimitPriceTag.confirmCancel'),
            style: 'cancel',
          },
          {
            text: t('page.perpsDetail.PerpEditLimitPriceTag.confirmContinue'),
            style: 'default',
            onPress: () => handleSet(),
          },
        ],
      );
      return;
    }
    handleSet();
  });

  // Mount/dismiss the bottom sheet via ref; matches AppBottomSheetModal pattern.
  useEffect(() => {
    if (modalVisible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [modalVisible]);

  // Auto-fill on first open: existing value wins, otherwise default to mid.
  useEffect(() => {
    if (!modalVisible) {
      return;
    }
    if (initLimitPrice) {
      setLimitPrice(initLimitPrice);
    } else {
      handleQuickPress({ label: 'Mid', pct: 'mid' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalVisible]);

  // Reset on close.
  useEffect(() => {
    if (!modalVisible) {
      setLimitPrice('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalVisible]);

  const title =
    direction === 'Long'
      ? t('page.perpsDetail.PerpEditLimitPriceTag.setLimitBuyPrice')
      : t('page.perpsDetail.PerpEditLimitPriceTag.setLimitSellPrice');

  return (
    <>
      <TouchableOpacity
        style={styles.tagContainer}
        onPress={() => setModalVisible(true)}>
        <Text style={[styles.tagText]}>
          {initLimitPrice ? `@ $${splitNumberByStep(initLimitPrice)}` : '-'}
        </Text>
        <IconPerpEdit width={16} height={16} color={'#50D2C1'} />
      </TouchableOpacity>

      <AppBottomSheetModal
        ref={modalRef}
        enableDynamicSizing
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onDismiss={() => setModalVisible(false)}>
        <BottomSheetView>
          <AutoLockView style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subTitle}>
                {formatPerpsCoin(coin)}/{quoteAsset}{' '}
                <Text style={styles.subTitlePrice}>
                  ${splitNumberByStep(markPrice)}
                </Text>
              </Text>
            </View>

            <View style={styles.body}>
              <View style={styles.priceInputWrap}>
                <BottomSheetTextInput
                  keyboardType="numeric"
                  style={StyleSheet.flatten([
                    styles.priceInput,
                    blockedByProtection ? styles.inputError : null,
                  ])}
                  placeholder="$0"
                  placeholderTextColor={colors2024['neutral-info']}
                  value={displayedValue ? `${displayedValue}` : ''}
                  onChangeText={v => handleInputChange(v.replace(/^\$/, ''))}
                />
                <View style={styles.errorRow}>
                  {blockedByProtection ? (
                    <Text style={styles.errorMsg}>
                      {t('page.perpsDetail.PerpEditLimitPriceTag.blockError')}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.quickRow}>
                {QUICK_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.label}
                    style={StyleSheet.flatten([styles.quickChip])}
                    onPress={() => handleQuickPress(opt)}>
                    <Text style={StyleSheet.flatten([styles.quickChipText])}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.footer}>
              <Button
                type="hyperliquid"
                loading={loading}
                title={t('page.perpsDetail.PerpEditLimitPriceTag.setBtn')}
                disabled={!isValid}
                onPress={handleConfirmPress}
                containerStyle={styles.btnContainer}
              />
            </View>
          </AutoLockView>
        </BottomSheetView>
      </AppBottomSheetModal>
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tagContainer: {
    borderRadius: 100,
    backgroundColor: 'rgba(80, 210, 193, 0.12)',
    paddingVertical: 4,
    paddingLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingRight: 6,
  },
  tagText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: '#50D2C1',
    fontFamily: 'SF Pro Rounded',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  header: {
    marginBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    marginBottom: 6,
    textAlign: 'center',
  },
  subTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
  },
  subTitlePrice: {
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
  },
  body: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  priceInputWrap: {
    width: '100%',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 16,
    paddingTop: 20,
    paddingBottom: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  priceInput: {
    ...(Platform.OS === 'ios' && { fontFamily: 'SF Pro Rounded' }),
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    width: '100%',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    paddingVertical: 0,
  },
  inputError: { color: colors2024['red-default'] },
  errorRow: { minHeight: 16, alignItems: 'center' },
  errorMsg: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['red-default'],
    textAlign: 'center',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    justifyContent: 'space-between',
  },
  quickChip: {
    flex: 1,
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
  },
  quickChipText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-body'],
  },
  footer: {
    width: '100%',
    paddingTop: 8,
    paddingBottom: 56,
  },
  btnContainer: { height: 48 },
}));
