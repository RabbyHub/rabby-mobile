import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { sinceTime } from '@/utils/time';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Text } from '@/components/Typography';
import { formatPerpsUsdValue } from '@/utils/number';
import { AccountHistoryItem } from '@/hooks/perps/usePerpsStore';

export const PerpsHistoryTransferPopup: React.FC<{
  visible?: boolean;
  onClose?(): void;
  item: AccountHistoryItem | null;
}> = ({ visible, onClose, item }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  const isToSpot = item?.destinationDex === 'spot';
  const actionText = isToSpot
    ? t('page.perps.history.transferActionToSpot')
    : t('page.perps.history.transferActionToPerps');

  return (
    <AppBottomSheetModal
      ref={modalRef}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg2' : 'bg1',
      })}
      onDismiss={onClose}
      enableDynamicSizing>
      <BottomSheetView>
        <AutoLockView style={styles.container}>
          <Text style={styles.title}>
            {t('page.perps.history.transferDetailTitle')}
          </Text>
          <View style={styles.list}>
            <View style={styles.listItem}>
              <Text style={styles.label}>{t('page.perps.history.action')}</Text>
              <Text style={styles.value}>{actionText}</Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.label}>{t('page.perps.history.asset')}</Text>
              <Text style={styles.value}>USDC</Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.label}>{t('page.perps.history.value')}</Text>
              <Text style={styles.value}>
                {formatPerpsUsdValue(item?.usdValue || '0')}
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.label}>{t('page.perps.history.date')}</Text>
              <Text style={styles.value}>
                {item?.time ? sinceTime(item.time / 1000) : '-'}
              </Text>
            </View>
          </View>
          <Button
            type="hyperliquid"
            title={t('page.perps.history.transferGotIt')}
            onPress={onClose}
          />
        </AutoLockView>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 48,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    marginBottom: 16,
  },
  list: {
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    marginBottom: 52,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  label: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  value: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
}));
