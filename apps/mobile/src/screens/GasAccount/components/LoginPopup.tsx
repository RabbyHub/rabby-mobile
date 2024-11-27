import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { View, Text, FlatList } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { useAccounts, useCurrentAccount } from '@/hooks/account';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { createGetStyles, createGetStyles2024 } from '@/utils/styles';
import { useGasAccountMethods } from '../hooks';
import { GasAccountBlueLogo } from './GasAccountBlueLogo';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { GasAccountCurrentAddress } from './LogoutPopup';
import { GasAccountWrapperBg } from '../components/WrapperBg';
import { RcIconQuoteEnd, RcIconQuoteStart } from '@/assets/icons/gas-account';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { Card } from '@/components2024/Card';
import { AccountsPanelInSheetModal } from '@/components/AccountSelector/AccountsPanel';
import { Account } from '@/core/services/preference';
import { apisAccountSwitch } from '@/core/apis';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';

const GasAccountLoginContent = ({ onClose, toConfirm, setToConfirm }) => {
  const { styles, colors2024, colors } = useTheme2024({ getStyle });
  // const [toConfirm, setToConfirm] = useState(false);
  const { t } = useTranslation();
  const { login } = useGasAccountMethods();
  const { currentAccount } = useCurrentAccount();

  const [loading, setLoading] = useState(false);

  const gotoLogin = () => {
    setToConfirm(true);
  };

  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const confirmAddress = useCallback(
    async (account: Account | null) => {
      if (loading) {
        return;
      }
      setLoading(true);
      try {
        switchSceneCurrentAccount('GasAccount', account);
        await login(account);
      } catch (error) {
        console.error(error);
      }

      setLoading(false);
    },
    [loading, login, switchSceneCurrentAccount],
  );

  const filterAccounts = React.useMemo(
    () =>
      [...accounts].filter(
        a => a.type !== KEYRING_CLASS.WATCH && a.type !== KEYRING_CLASS.GNOSIS,
      ),
    [accounts],
  );

  const list = useSortAddressList(filterAccounts);

  if (toConfirm && currentAccount) {
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
              {/* <GasAccountCurrentAddress /> */}
              <Text style={styles.confirmDescription}>
                {t('component.gasAccount.loginConfirmModal.desc')}
              </Text>
            </View>
          </BottomSheetHandlableView>

          <AccountsPanelInSheetModal
            onSelectAccount={account => confirmAddress(account)}
            scene="GasAccount"
            containerStyle={styles.accountsContainer}
          />
        </View>
      </LinearGradient>
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
  const { styles, colors2024, colors } = useTheme2024({ getStyle });
  const modalRef = useRef<AppBottomSheetModal>(null);
  const [toConfirm, setToConfirm] = useState(false);

  useEffect(() => {
    if (!props?.visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [props?.visible]);

  return (
    <AppBottomSheetModal
      enableContentPanningGesture={false} // has scorll list
      snapPoints={[toConfirm ? 694 : 380]}
      onDismiss={props.onCancel || props.onClose}
      ref={modalRef}>
      <BottomSheetView style={styles.popup}>
        <GasAccountLoginContent
          onClose={props.onCancel || props.onClose}
          toConfirm={toConfirm}
          setToConfirm={setToConfirm}
        />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024, colors }) => ({
  itemInfo: {
    marginLeft: 8,
    gap: 4,
  },
  item: {
    flexDirection: 'row',
  },
  accountsContainer: {
    backgroundColor: 'transparent',
  },
  itemNameText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  itemName: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemBalanceText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  itemContainer: {
    height: 96,
    marginBottom: 12,
    flex: 1,
    width: '100%',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  listContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 16,
    gap: 12,
  },
  container: {
    width: '100%',
    flex: 1,
    backgroundColor: colors2024['neutral-bg-1'],
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
  handleView: {
    justifyContent: 'center',
    alignItems: 'center',
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
    fontFamily: 'SF Pro Rounded',
    fontWeight: '800',
    color: colors['neutral-title1'],
    marginBottom: 18,
  },
  confirmDescription: {
    // marginTop: 28,
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
    flexDirection: 'row',
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
