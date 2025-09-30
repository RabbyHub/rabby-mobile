import { RcIconWarningCC } from '@/assets2024/icons/common';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { CheckBoxRect } from '@/components2024/CheckBox';
import { FooterButtonGroup } from '@/components2024/FooterButtonGroup';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { toast } from '@/components2024/Toast';
import { apisTransactionHistory } from '@/core/apis/transactionHistory';
import { transactionHistoryService } from '@/core/services';
import { useMyAccounts } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

export const ClearPendingPopup: React.FC<{
  visible?: boolean;
  onClose?(): void;
  onConfirm?(): void;
}> = ({ visible, onClose, onConfirm }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const modalRef = useRef<AppBottomSheetModal>(null);
  const [isClearNonce, setIsClearNonce] = useState(false);
  const { accounts } = useMyAccounts({ disableAutoFetch: true });

  const handleClearPending = useMemoizedFn(() => {
    try {
      accounts.forEach(item => {
        apisTransactionHistory.clearPendingTxs(item.address);
        if (isClearNonce) {
          transactionHistoryService.removeList(item.address);
        }
      });
      toast.success(t('page.setting.clearPendingToast'));
      onConfirm?.();
    } catch (e) {
      console.error(e);
      toast.error('Error');
    }
  });

  useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
      setIsClearNonce(false);
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
        linearGradientType: 'linear',
        colors: colors2024,
      })}
      handleStyle={styles.handleStyle}
      enableDynamicSizing
      maxDynamicContentSize={maxHeight}>
      <BottomSheetScrollView style={styles.popup}>
        <AutoLockView>
          <View style={styles.header}>
            <Text style={styles.title}>{t('page.setting.clearPending')}</Text>
          </View>
          <View style={styles.body}>
            <Text style={styles.desc}>
              {t('page.setting.clearPendingDesc1')}
              {'\n'}
              {'\n'}
              {t('page.setting.clearPendingDesc2')}
            </Text>
            <View style={styles.alert}>
              <RcIconWarningCC color={colors2024['red-default']} />
              <View style={styles.alertContent}>
                <Text style={styles.alertText}>
                  {t('page.setting.clearPendingWarning')}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => {
                setIsClearNonce(prev => !prev);
              }}>
              <CheckBoxRect size={16} checked={isClearNonce} />
              <Text style={styles.checkboxText}>
                {t('page.setting.clearPendingResetDesc')}
              </Text>
            </TouchableOpacity>
          </View>
          <FooterButtonGroup
            style={styles.footer}
            onCancel={onClose}
            onConfirm={handleClearPending}
          />
        </AutoLockView>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  handleStyle: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  popup: {
    margin: 0,
    height: '100%',
    minHeight: 364,
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopWidth: 0,
  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
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
    marginBottom: 24,
  },
  alertContent: { flex: 1 },
  alertText: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    color: colors2024['red-default'],
  },
  checkbox: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  checkboxText: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
  },
  footer: {
    paddingTop: 24,
    paddingBottom: 56,
    paddingHorizontal: 24,
  },
}));
