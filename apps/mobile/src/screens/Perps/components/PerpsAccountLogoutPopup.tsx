import { AppBottomSheetModal } from '@/components';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { Account } from '@/core/services/preference';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useRequest } from 'ahooks';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export const PerpsAccountLogoutPopup: React.FC<{
  visible: boolean;
  account?: Account | null;
  onClose?: () => void;
  onLogout?: () => void;
}> = ({ onLogout, onClose, visible, account }) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyle });
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);

  if (!account) {
    return null;
  }

  return (
    <AppBottomSheetModal
      snapPoints={[372]}
      onDismiss={onClose}
      ref={modalRef}
      {...makeBottomSheetProps({
        linearGradientType: isLight ? 'bg0' : 'bg1',
        colors: colors2024,
      })}>
      <BottomSheetView style={styles.popup}>
        <View style={styles.logoutContainer}>
          <Text style={styles.logoutTitle}>
            {t('page.perps.PerpsAccountLogoutPopup.title')}
          </Text>
          <Text style={styles.logoutDesc}>
            {t('page.perps.PerpsAccountLogoutPopup.desc')}
          </Text>

          <View style={[styles.currentAddressContainer]}>
            <AddressItem account={account as any} fetchAccount={false}>
              {({ WalletIcon, WalletName, WalletBalance }) => (
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    alignItems: 'center',
                  }}>
                  <WalletIcon width={46} height={46} borderRadius={12} />
                  <View style={{ gap: 4 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}>
                      <WalletName style={styles.addressText} />
                    </View>

                    <WalletBalance style={[styles.balanceText]} />
                  </View>
                </View>
              )}
            </AddressItem>
          </View>

          <View style={[styles.buttonContainer]}>
            <Button
              type="ghost"
              title={t('global.Cancel')}
              onPress={onClose}
              containerStyle={{ flex: 1 }}
              titleStyle={styles.btnText}
            />
            <Button
              type="primary"
              containerStyle={{ flex: 1 }}
              title={t('page.perps.PerpsAccountLogoutPopup.logout')}
              onPress={onLogout}
              titleStyle={styles.btnText}
            />
          </View>
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors, colors2024 }) => ({
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
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-bg-1'],
  },

  addressText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
  },

  balanceText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
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
    marginTop: 'auto',
    marginBottom: 56,
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
    fontWeight: '900',
    lineHeight: 24,
    marginTop: 12,
  },

  logoutDesc: {
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 22,
    marginTop: 12,
    marginBottom: 12,
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
