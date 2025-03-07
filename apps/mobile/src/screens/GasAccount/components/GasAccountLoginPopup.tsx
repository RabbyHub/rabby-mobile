import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { Account } from '@/core/services/preference';
import { useCurrentAccount } from '@/hooks/account';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';
import { trigger } from 'react-native-haptic-feedback';
import LinearGradient from 'react-native-linear-gradient';
import { useGasAccountInfo, useGasAccountMethods } from '../hooks';
import { useGasAccountSign } from '../hooks/atom';
import { SelectGasAccountList } from './SelectGasAccountList';
import { toast } from '@/components2024/Toast';

const GasAccountLoginContent: React.FC<{
  onLogin?(): void;
}> = ({ onLogin }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { login, logout } = useGasAccountMethods();
  const { currentAccount } = useCurrentAccount();
  const { value: gasAccountInfo } = useGasAccountInfo();
  const { sig } = useGasAccountSign();

  const [loading, setLoading] = useState(false);

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const confirmAddress = useMemoizedFn(async (account: Account | null) => {
    if (loading) {
      return;
    }
    const isSwitch = gasAccountInfo?.account.id || sig;
    setLoading(true);
    try {
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      await switchSceneCurrentAccount('GasAccount', account);
      if (isSwitch) {
        await logout();
      }
      await login(account);
      await onLogin?.();
      toast.success(t('page.gasAccount.loginSuccess'));
    } catch (error) {
      console.error(error);
      toast.error(t('page.gasAccount.loginFailed'));
    }

    setLoading(false);
  });

  if (currentAccount) {
    return (
      <LinearGradient
        colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]}
        locations={[0.0745, 0.2242]}
        start={{ x: 0, y: 0 }}
        style={{ width: '100%', height: '100%' }}
        end={{ x: 0, y: 1 }}>
        <View style={styles.loginConfirmContainer}>
          <BottomSheetHandlableView>
            <View style={styles.handleView}>
              <Text style={styles.confirmTitle}>
                {t('component.gasAccount.loginConfirmModal.title')}
              </Text>
            </View>
          </BottomSheetHandlableView>

          <SelectGasAccountList
            isGasAccount
            style={styles.list}
            listHeader={
              <View style={styles.listHeader}>
                <Text style={styles.listLabel}>
                  {t('page.gasAccount.gasAccountList.address')}
                </Text>
                <Text style={styles.listLabel}>
                  {t('page.gasAccount.gasAccountList.gasAccountBalance')}
                </Text>
              </View>
            }
            onChange={confirmAddress}
          />
        </View>
      </LinearGradient>
    );
  }

  return null;
};

export const GasAccountLoginPopup: React.FC<{
  visible?: boolean;
  onClose?(): void;
  onLogin?(): void;
}> = ({ visible, onClose, onLogin }) => {
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

  return (
    <AppBottomSheetModal
      enableContentPanningGesture={false} // has scorll list
      snapPoints={[Math.min(height - 200, 652)]}
      onDismiss={onClose}
      ref={modalRef}
      {...makeBottomSheetProps({
        linearGradientType: 'linear',
        colors: colors2024,
      })}>
      <BottomSheetView style={styles.popup}>
        <GasAccountLoginContent onLogin={onLogin} />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024, colors }) => ({
  popup: {
    justifyContent: 'flex-end',
    margin: 0,
    height: '100%',
    // paddingVertical: 10,
  },
  handleView: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginConfirmContainer: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  confirmTitle: {
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '800',
    color: colors['neutral-title1'],
    paddingTop: 16,
    paddingBottom: 0,
  },
  list: {
    marginTop: 20,
  },
  listHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  listLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
  },
}));
