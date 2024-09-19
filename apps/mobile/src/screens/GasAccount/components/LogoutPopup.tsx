import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { useCurrentAccount } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { useAlias } from '@/hooks/alias';
import { AddressViewer } from '@/components/AddressViewer';
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';
import { useGasAccountMethods } from '../hooks';
import { getWalletIcon } from '@/utils/walletInfo';
import { useGasAccountSign } from '../hooks/atom';
import { toast } from '@/components/Toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const GasAccountCurrentAddress = ({
  transparent,
}: {
  transparent?: boolean;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { currentAccount } = useCurrentAccount();
  const { account } = useGasAccountSign();

  const [alias] = useAlias(account?.address || currentAccount?.address || '');

  const WalletIcon = useMemo(() => {
    return getWalletIcon(
      account?.brandName ? account?.brandName : currentAccount?.brandName || '',
    );
  }, [account?.brandName, currentAccount?.brandName]);

  return (
    <View
      style={[
        styles.currentAddressContainer,
        transparent && { backgroundColor: 'transparent' },
      ]}>
      <WalletIcon style={styles.icon} />
      <Text style={styles.aliasText}>{alias}</Text>
      <AddressViewer
        address={account?.address || currentAccount!.address}
        showArrow={false}
      />
      <CopyAddressIcon address={account?.address || currentAccount!.address} />
    </View>
  );
};

const GasAccountLogoutContent = ({ onClose }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();

  const { logout } = useGasAccountMethods();

  const [loading, setLoading] = useState(false);

  const handleLogout = React.useCallback(async () => {
    if (loading) {
      return;
    }
    try {
      setLoading(true);
      await logout();
      onClose();
    } catch (error) {
      toast.info((error as any)?.message || String(error));
    } finally {
      setLoading(false);
    }
  }, [loading, logout, onClose]);

  const { bottom } = useSafeAreaInsets();

  return (
    <View style={styles.logoutContainer}>
      <Text style={styles.logoutTitle}>
        {t('page.gasAccount.logoutConfirmModal.title')}
      </Text>
      <GasAccountCurrentAddress />
      <Text style={styles.logoutDesc}>
        {t('page.gasAccount.logoutConfirmModal.desc')}
      </Text>
      <View style={[styles.buttonContainer, { marginBottom: bottom }]}>
        <Button
          type="white"
          ghost
          title={t('global.Cancel')}
          onPress={onClose}
          containerStyle={[styles.btnContainer]}
          titleStyle={[styles.btnText]}
        />
        <Button
          type="white"
          ghost
          loading={loading}
          loadingProps={{ color: colors['red-default'] }}
          title={t('page.gasAccount.logoutConfirmModal.logout')}
          onPress={handleLogout}
          containerStyle={[styles.btnContainer]}
          titleStyle={[styles.btnText, styles.logoutBtnText]}
          buttonStyle={styles.logoutBtn}
        />
      </View>
    </View>
  );
};

export const GasAccountLogoutPopup = (props: {
  visible: boolean;
  onClose?: () => void;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (!props?.visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [props?.visible]);

  return (
    <AppBottomSheetModal
      snapPoints={[370]}
      onDismiss={props.onClose}
      ref={modalRef}>
      <BottomSheetView style={styles.popup}>
        <GasAccountLogoutContent onClose={props.onClose} />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles(colors => ({
  popup: {
    margin: 0,
    height: '100%',
  },

  currentAddressContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors['neutral-card-2'],
  },
  icon: {
    width: 24,
    height: 24,
  },
  aliasText: {
    marginLeft: 8,
    marginRight: 4,
    fontSize: 15,
    fontWeight: '500',
    color: colors['neutral-title-1'],
  },

  confirmDescription: {
    marginBottom: 30,
    fontSize: 14,
    borderTopColor: colors['neutral-body'],
  },

  btnContainer: {
    flex: 1,
  },
  logoutBtn: {
    borderColor: colors['red-default'],
  },
  btnText: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '500',
  },
  logoutBtnText: {
    color: colors['red-default'],
  },
  buttonContainer: {
    gap: 12,
    width: '100%',
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopColor: colors['neutral-line'],
    borderTopWidth: 0.5,
    backgroundColor: colors['neutral-bg1'],
    paddingBottom: 20,
    paddingHorizontal: 20,
  },

  logoutContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: colors['neutral-bg1'],
  },

  logoutTitle: {
    color: colors['neutral-title-1'],
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '500',
    marginTop: 20,
    marginBottom: 28,
  },

  logoutDesc: {
    color: colors['neutral-body'],
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    marginHorizontal: 20,
    marginTop: 28,
    marginBottom: 34,
  },

  popupBody: {
    padding: 0,
  },
}));

export default GasAccountLogoutPopup;
