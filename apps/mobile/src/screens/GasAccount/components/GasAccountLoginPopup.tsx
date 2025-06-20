import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { Account } from '@/core/services/preference';
import { useAccounts } from '@/hooks/account';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';
import { trigger } from 'react-native-haptic-feedback';
import LinearGradient from 'react-native-linear-gradient';
import { useGasAccountInfo, useGasAccountMethods } from '../hooks';
import { useGasAccountSign } from '../hooks/atom';
import { SelectGasAccountList } from './SelectGasAccountList';
import { toast } from '@/components2024/Toast';
import { filterMyAccounts } from '@/utils/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

const GasAccountLoginContent: React.FC<{
  onLogin?(): void;
}> = ({ onLogin }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { login, logout } = useGasAccountMethods();
  const { value: gasAccountInfo } = useGasAccountInfo();
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const filterAccounts = useMemo(
    () => [...filterMyAccounts(accounts)],
    [accounts],
  );
  const { sig } = useGasAccountSign();

  const [loading, setLoading] = useState(false);

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const currentLoginAccount = useMemo(
    () =>
      gasAccountInfo?.account?.id
        ? filterAccounts.find(item =>
            isSameAddress(gasAccountInfo.account.id, item.address),
          )
        : null,
    [filterAccounts, gasAccountInfo?.account?.id],
  );
  const [selectedAccount, setSelectAccount] = useState(currentLoginAccount);

  const confirmAddress = useMemoizedFn(async (account: Account) => {
    setSelectAccount(account);
    if (loading) {
      return;
    }
    const isSwitch = gasAccountInfo?.account.id || sig;
    setLoading(true);
    try {
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

  useEffect(() => {
    setSelectAccount(currentLoginAccount);
  }, [currentLoginAccount]);

  return (
    <LinearGradient
      colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]}
      locations={[0.0745, 0.2242]}
      start={{ x: 0, y: 0 }}
      style={{ width: '100%', height: '100%', paddingBottom: 44 }}
      end={{ x: 0, y: 1 }}>
      <View style={styles.loginConfirmContainer}>
        <View style={styles.handleView}>
          <Text style={styles.confirmTitle}>
            {t('component.gasAccount.loginConfirmModal.title')}
          </Text>
        </View>

        <SelectGasAccountList
          isGasAccount
          style={styles.list}
          value={selectedAccount || undefined}
          listHeader={
            <View style={styles.listHeader}>
              <Text style={styles.listLabel}>
                {t('page.gasAccount.gasAccountList.wallet')}
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
};

export const GasAccountLoginPopup: React.FC<{
  visible?: boolean;
  onClose?(): void;
  onLogin?(): void;
}> = ({ visible, onClose, onLogin }) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
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
      // enableContentPanningGesture={false} // has scorll list
      // snapPoints={[Math.min(height - 200, 652)]}
      onDismiss={onClose}
      ref={modalRef}
      {...makeBottomSheetProps({
        linearGradientType: 'bg1',
        colors: colors2024,
      })}
      enableDynamicSizing
      maxDynamicContentSize={maxHeight}
      handleStyle={styles.handleStyle}>
      <BottomSheetScrollView style={styles.popup}>
        <GasAccountLoginContent onLogin={onLogin} />
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024, colors }) => ({
  popup: {
    // justifyContent: 'flex-end',
    margin: 0,
    height: '100%',
    // paddingVertical: 10,
    minHeight: 364,
  },
  handleStyle: {
    backgroundColor: 'transparent',
    paddingTop: 10,
    height: 36,
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
