import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { useCurrentAccount } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { useGasAccountMethods } from '../hooks';
import { GasAccountBlueLogo } from './GasAccountBlueLogo';
import { GasAccountCurrentAddress } from './LogoutPopup';
import { GasAccountWrapperBg } from '../components/WrapperBg';
import { RcIconQuoteEnd, RcIconQuoteStart } from '@/assets/icons/gas-account';

const GasAccountLoginContent = ({ onClose }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [toConfirm, setToConfirm] = useState(false);
  const { t } = useTranslation();
  const { login } = useGasAccountMethods();
  const { currentAccount } = useCurrentAccount();

  const [loading, setLoading] = useState(false);

  const gotoLogin = () => {
    setToConfirm(true);
  };

  const confirmAddress = useCallback(async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    try {
      await login();
    } catch (error) {}

    setLoading(false);
  }, [loading, login]);

  if (toConfirm && currentAccount) {
    return (
      <View style={styles.loginConfirmContainer}>
        <Text style={styles.confirmTitle}>
          {t('component.gasAccount.loginConfirmModal.title')}
        </Text>
        <GasAccountCurrentAddress />
        <Text style={styles.confirmDescription}>
          {t('component.gasAccount.loginConfirmModal.desc')}
        </Text>
        <View style={styles.buttonContainer}>
          <Button
            type="white"
            ghost
            title={t('global.Cancel')}
            onPress={onClose}
            containerStyle={[styles.twoBtnContainer]}
          />
          <Button
            loading={loading}
            type={'primary'}
            onPress={confirmAddress}
            containerStyle={[styles.twoBtnContainer]}
            title={t('global.Confirm')}
          />
        </View>
      </View>
    );
  }

  return (
    <GasAccountWrapperBg style={styles.loginContainer}>
      <GasAccountBlueLogo style={styles.logo} />
      <View style={styles.quoteContainer}>
        <RcIconQuoteStart style={styles.quoteStart} />
        <Text style={styles.loginTip}>
          {t('component.gasAccount.loginInTip.title')}
        </Text>
      </View>
      <View style={styles.quoteContainer}>
        <Text style={styles.loginDesc}>
          {t('component.gasAccount.loginInTip.desc')}
        </Text>
        <RcIconQuoteEnd style={styles.quoteEnd} />
      </View>
      <View style={styles.buttonContainer}>
        <Button
          containerStyle={styles.confirmButton}
          onPress={gotoLogin}
          type="primary"
          title={t('component.gasAccount.loginInTip.login')}
        />
      </View>
    </GasAccountWrapperBg>
  );
};

export const GasAccountLoginPopup = props => {
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
      snapPoints={[380]}
      onDismiss={props.onCancel || props.onClose}
      ref={modalRef}>
      <BottomSheetView style={styles.popup}>
        <GasAccountLoginContent onClose={props.onCancel || props.onClose} />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    width: '100%',
    flex: 1,
    backgroundColor: colors['neutral-bg-1'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  popup: {
    justifyContent: 'flex-end',
    margin: 0,
    height: '100%',
    // paddingVertical: 10,
  },
  paddingContainer: {
    width: '100%',
    flex: 1,
    backgroundColor: colors['neutral-bg-1'],
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  currentAddressContainer: {
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0', // 示例颜色
  },
  icon: {
    width: 24,
    height: 24,
  },

  copyChecked: {
    width: 14,
    height: 14,
    marginLeft: 4,
    fontSize: 14,
    cursor: 'pointer',
    marginTop: 1,
  },
  loginConfirmContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: colors['neutral-title1'],
    marginTop: 20,
    marginBottom: 32,
  },
  confirmDescription: {
    marginTop: 28,
    marginBottom: 30,
    fontSize: 14,
    color: colors['neutral-body'],
  },
  twoBtnContainer: {
    // width: 170,
    flex: 1,
    // marginRight: 12,
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
  confirmButton: {
    width: '100%',
    height: 52,
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: colors['neutral-bg1'],
  },
  logo: {
    // width: 60,
    // height: 60,
    marginVertical: 24,
  },
  loginTip: {
    color: colors['blue-default'],
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    fontSize: 18,
    fontWeight: '500',
  },
  loginDesc: {
    color: colors['blue-default'],
    flexDirection: 'row',
    gap: 8,
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 40,
  },
  popupBody: {
    padding: 0,
  },
  quoteContainer: {
    position: 'relative',
    // marginBottom: 16,
  },
  quoteEnd: {
    position: 'absolute',
    top: 2,
    right: -20,
  },
  quoteStart: {
    position: 'absolute',
    top: 2,
    left: -20,
  },
}));

export default GasAccountLoginPopup;
