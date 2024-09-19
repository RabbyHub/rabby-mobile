import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { AssetAvatar } from '@/components';
import { useTranslation } from 'react-i18next';
import { noop } from 'lodash';
import { Tip } from '@/components/Tip';
import { Button } from '@/components/Button';
import clsx from 'clsx';
import { formatUsdValue } from '@/utils/number';
import { openapi, testOpenapi } from '@/core/request';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
} from '@/components/customized/BottomSheet';
import { useCurrentAccount } from '@/hooks/account';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { getTokenSymbol } from '@/utils/token';
import { useGetBinaryMode, useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { useAlias } from '@/hooks/alias';
import { useWalletConnectIcon } from '@/hooks/walletconnect/useWalletConnectIcon';
import { KEYRING_ICONS } from '@/constant/icon';
import { WALLET_BRAND_NAME_KEY } from '@/hooks/walletconnect/useDisplayBrandName';
import { AddressViewer } from '@/components/AddressViewer';
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';
import { useGasAccountMethods } from '../hooks';
import { GasAccountBlueLogo } from './GasAccountBlueLogo';
// import { GasAccountCloseIcon } from './PopupCloseIcon';

const GasAccountCurrentAddress = ({
  account,
}: {
  account?: {
    address: string;
    type: string;
    brandName: string;
  };
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { currentAccount } = useCurrentAccount();
  const binaryTheme = useGetBinaryMode();
  const isDarkTheme = binaryTheme === 'dark';

  const brandIcon = useWalletConnectIcon({
    address: currentAccount!.address,
    brandName: currentAccount!.brandName,
    type: currentAccount!.type,
  });

  const [alias] = useAlias(account?.address || currentAccount?.address || '');

  const addressTypeIcon = useMemo(() => {
    return brandIcon;
    // todo 图标处理
  }, [brandIcon]);

  return (
    <View style={styles.currentAddressContainer}>
      <Image source={{ uri: addressTypeIcon }} style={styles.icon} />
      <Text style={styles.aliasText}>{alias}</Text>
      <AddressViewer
        address={account?.address || currentAccount!.address}
        showArrow={false}
        style={styles.addressViewer}
      />
      <CopyAddressIcon
        address={account?.address || currentAccount!.address}
        style={styles.copyChecked}
      />
    </View>
  );
};

const GasAccountLoginContent = ({ onClose }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [toConfirm, setToConfirm] = useState(false);
  const { t } = useTranslation();
  const { login } = useGasAccountMethods();
  const { currentAccount } = useCurrentAccount();

  const gotoLogin = () => {
    setToConfirm(true);
  };

  const confirmAddress = () => {
    login();
  };

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
    <View style={styles.loginContainer}>
      <GasAccountBlueLogo style={styles.logo} />
      <Text style={styles.loginTip}>
        {t('component.gasAccount.loginInTip.title')}
      </Text>
      <Text style={styles.loginDesc}>
        {t('component.gasAccount.loginInTip.desc')}
      </Text>
      <View style={styles.buttonContainer}>
        <Button
          containerStyle={styles.confirmButton}
          onPress={gotoLogin}
          type="primary"
          title={t('component.gasAccount.loginInTip.login')}
        />
      </View>
    </View>
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
      snapPoints={[350]}
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
  aliasText: {
    marginLeft: 8,
    marginRight: 4,
    fontSize: 15,
    fontWeight: '500',
    color: '#333', // 示例颜色
  },
  addressViewer: {
    fontSize: 13,
    color: '#666', // 示例颜色
    marginTop: 1,
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
    borderTopColor: colors['neutral-title1'],
    marginTop: 20,
    marginBottom: 32,
  },
  confirmDescription: {
    marginBottom: 30,
    fontSize: 14,
    color: '#666', // 示例颜色
    borderTopColor: colors['neutral-body'],
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
    width: 60,
    height: 60,
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
}));

export default GasAccountLoginPopup;
