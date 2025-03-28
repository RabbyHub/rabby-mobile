import { RcIconRightCC } from '@/assets/icons/common';
import { RcIconWarningCC } from '@/assets2024/icons/common';
import { AppBottomSheetModal } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { Tip } from '@/components/Tip';
import { FooterButtonGroup } from '@/components2024/FooterButtonGroup';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { CANCEL_TX_TYPE } from '@/constant';
import { TransactionHistoryItem } from '@/core/services/transactionHistory';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';

export const CancelTxConfirmPopupContent = ({
  onClose,
  onConfirm,
}: {
  onClose?(): void;
  onConfirm?(): void;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <AutoLockView>
      <View style={styles.header}>
        <Text style={styles.title}>
          {t('page.activities.signedTx.CancelTxConfirmPopup.title')}
        </Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.desc}>
          {t('page.activities.signedTx.CancelTxConfirmPopup.desc')}
        </Text>
        <View style={styles.alert}>
          <RcIconWarningCC color={colors2024['red-default']} />
          <View style={styles.alertContent}>
            <Text style={styles.alertText}>
              {t('page.activities.signedTx.CancelTxConfirmPopup.warning')}
            </Text>
          </View>
        </View>
      </View>
      <FooterButtonGroup
        style={styles.footer}
        onCancel={onClose}
        onConfirm={onConfirm}
      />
    </AutoLockView>
  );
};

export const CancelTxConfirmPopup = ({
  visible,
  onClose,
  onConfirm,
}: {
  visible?: boolean;
  onClose?(): void;
  onConfirm?(): void;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

  return (
    <AppBottomSheetModal
      onDismiss={onClose}
      ref={modalRef}
      {...makeBottomSheetProps({
        linearGradientType: 'bg1',
        colors: colors2024,
      })}
      enableDynamicSizing
      maxDynamicContentSize={maxHeight}>
      <BottomSheetScrollView style={styles.popup}>
        <CancelTxConfirmPopupContent onClose={onClose} onConfirm={onConfirm} />
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  popup: {
    margin: 0,
    height: '100%',
    minHeight: 364,
  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    paddingBottom: 0,
  },
  body: {
    paddingHorizontal: 24,
  },
  desc: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    marginBottom: 24,
  },
  alert: {
    borderRadius: 8,
    backgroundColor: colors2024['red-light-1'],
    padding: 8,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  alertContent: { flex: 1 },
  alertText: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    color: colors2024['red-default'],
  },
  footer: {
    paddingTop: 30,
    paddingBottom: 56,
    paddingHorizontal: 24,
  },
}));
