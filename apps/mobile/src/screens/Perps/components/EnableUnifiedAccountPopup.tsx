/* eslint-disable react-native/no-inline-styles */
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Text } from '@/components/Typography';
import AutoLockView from '@/components/AutoLockView';
import RcIconTips from '@/assets2024/icons/perps/IconTips.svg';

export const EnableUnifiedAccountPopup: React.FC<{
  visible?: boolean;
  onClose(): void;
  onConfirm(): Promise<void>;
}> = ({ visible, onClose, onConfirm }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible]);

  const handleConfirm = useCallback(async () => {
    try {
      setIsLoading(true);
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  }, [onConfirm]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      onDismiss={onClose}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      })}
      enableDynamicSizing>
      <AutoLockView as="BottomSheetView" style={styles.container}>
        <Text style={styles.title}>
          {t('page.perps.EnableUnifiedAccount.title')}
        </Text>
        <Text style={styles.desc}>
          {t('page.perps.EnableUnifiedAccount.desc')}
        </Text>
        <View style={styles.importantContainer}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
            }}>
            <RcIconTips />
            <Text style={styles.importantTitle}>
              {t('page.perps.EnableUnifiedAccount.important')}
            </Text>
          </View>
          <Text style={styles.importantDesc}>
            {t('page.perps.EnableUnifiedAccount.importantTips')}
          </Text>
        </View>
        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <Button
              style={styles.footerBtn}
              onPress={onClose}
              title={t('page.perps.EnableUnifiedAccount.cancel')}
              type="hyperliquid-light"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              style={styles.footerBtn}
              onPress={handleConfirm}
              title={t('page.perps.EnableUnifiedAccount.confirm')}
              type="hyperliquid"
              loading={isLoading}
            />
          </View>
        </View>
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    marginBottom: 16,
  },
  desc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    marginBottom: 16,
  },
  importantContainer: {
    gap: 2,
    backgroundColor: isLight
      ? colors2024['neutral-bg-5']
      : colors2024['neutral-bg-3'],
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  importantTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  importantDesc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  footer: {
    flexDirection: 'row' as const,
    gap: 12,
    paddingBottom: 26,
  },
  footerBtn: {
    flex: 1,
  },
}));
