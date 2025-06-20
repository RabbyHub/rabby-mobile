import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ViewProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { AppBottomSheetModal } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useGasAccountMethods } from '../hooks';
import { useGasAccountSign } from '../hooks/atom';
import { toast } from '@/components/Toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { Button } from '@/components2024/Button';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import LinearGradient from 'react-native-linear-gradient';

export const GasAccountCurrentAddress = ({
  style,
}: {
  style?: ViewProps['style'];
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { account } = useGasAccountSign();

  if (!account) {
    return null;
  }

  return (
    <View style={[styles.currentAddressContainer, style]}>
      <AddressItem account={account as any} fetchAccount={false}>
        {({ WalletIcon, WalletName, WalletBalance }) => (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              alignItems: 'center',
            }}>
            <WalletIcon
              style={{
                width: 40,
                height: 40,
              }}
            />
            <View style={{ gap: 4 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                <WalletName style={styles.addressText} />
              </View>

              <WalletBalance
                style={[
                  styles.addressText,
                  {
                    color: colors2024['neutral-title-1'],
                    fontSize: 16,
                    lineHeight: 20,
                    fontWeight: '700',
                  },
                ]}
              />
            </View>
          </View>
        )}
      </AddressItem>
    </View>
  );
};

const GasAccountLogoutContent = ({ onClose }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
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
      setTimeout(() => {
        toast.success(t('page.gasAccount.logoutConfirmModal.logoutSuccess'));
      }, 200);
    } catch (error) {
      toast.info((error as any)?.message || String(error));
    } finally {
      setLoading(false);
    }
  }, [loading, logout, onClose, t]);

  const { bottom } = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]}
      locations={[0.0745, 0.2242]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1, position: 'relative' }}>
      <View style={styles.logoutContainer}>
        <Text style={styles.logoutTitle}>
          {t('page.gasAccount.logoutConfirmModal.title')}
        </Text>
        {/* <GasAccountCurrentAddress /> */}
        <Text style={styles.logoutDesc}>
          {t('page.gasAccount.logoutConfirmModal.desc')}
        </Text>

        <GasAccountCurrentAddress />

        <View
          style={[styles.buttonContainer, { marginBottom: bottom || 0 + 35 }]}>
          <Button
            type="ghost"
            title={t('global.Cancel')}
            onPress={onClose}
            containerStyle={{ flex: 1 }}
            titleStyle={styles.btnText}
          />
          <Button
            type="primary"
            loading={loading}
            containerStyle={{ flex: 1 }}
            title={t('page.gasAccount.logoutConfirmModal.logout')}
            onPress={handleLogout}
            titleStyle={styles.btnText}
          />
        </View>
      </View>
    </LinearGradient>
  );
};

export const GasAccountLogoutPopup = (props: {
  visible: boolean;
  onClose?: () => void;
}) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });
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
      snapPoints={[420]}
      onDismiss={props.onClose}
      ref={modalRef}
      {...makeBottomSheetProps({
        linearGradientType: 'bg1',
        colors: colors2024,
      })}>
      <BottomSheetView style={styles.popup}>
        <GasAccountLogoutContent onClose={props.onClose} />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles2024(({ colors, colors2024 }) => ({
  popup: {
    margin: 0,
    height: '100%',
  },

  currentAddressContainer: {
    borderRadius: 20,
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    padding: 16,
    height: 78,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },

  addressText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },

  btnContainer: {
    flex: 1,
  },
  logoutBtn: {
    borderColor: colors['red-default'],
  },

  logoutBtnText: {
    color: colors['red-default'],
  },
  buttonContainer: {
    gap: 12,
    // width: '100%',
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
    marginTop: 'auto',
  },

  logoutContainer: {
    paddingHorizontal: 20,
    flex: 1,
    alignItems: 'center',
    width: '100%',
    height: '100%',
    // backgroundColor: colors['neutral-bg1'],
  },

  logoutTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '800',
    lineHeight: 24,
    marginTop: 20,
  },

  logoutDesc: {
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 22,
    marginVertical: 24,
  },

  btnText: {
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '600',
    lineHeight: 28,
  },
}));
