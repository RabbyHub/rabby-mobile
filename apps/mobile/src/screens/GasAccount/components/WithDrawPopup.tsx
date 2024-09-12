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
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { AssetAvatar } from '@/components';
import { useTranslation } from 'react-i18next';
import { noop } from 'lodash';
import { Tip } from '@/components/Tip';
import { Button } from '@/components/Button';
import clsx from 'clsx';
import useAsync from 'react-use/lib/useAsync';
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
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { openAppWithUri } from 'react-native-send-intent';
// import { GasAccountCloseIcon } from './PopupCloseIcon';
import RcIconHasConfirmed from '@/assets/icons/gas-account/IconHasConfirmed.svg';

const WithDrawInitContent = ({
  balance,
  onClose,
}: {
  balance: number;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  // const { sig, accountId } = useGasAccountSign();
  const { sig, accountId } = {};
  const colors = useThemeColors();
  const [loading, setLoading] = useState(false);
  // const gasAccount = useRabbySelector((s) => s.gasAccount.account);
  const gasAccount = {} as any;
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [visible, setVisible] = useState(true);
  // const wallet = useWallet();

  const onAfterConfirm = () => {
    setVisible(true);
  };

  const wallet = {} as any;

  const withdraw = async () => {
    try {
      setLoading(true);
      await openapi.withdrawGasAccount({
        sig: sig!,
        account_id: accountId!,
        amount: balance,
      });
      onClose();
      onAfterConfirm?.();
    } catch (error) {
      // message.error(error?.message || String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {t('component.gasAccount.withdrawPopup.title')}
      </Text>
      <Text style={styles.description}>
        {t('component.gasAccount.withdrawPopup.desc')}
      </Text>

      <Text style={styles.label}>
        {t('component.gasAccount.withdrawPopup.amount')}
      </Text>

      <View style={styles.labelContent}>
        <Text style={styles.textContent}>{formatUsdValue(balance)}</Text>
      </View>

      <Text style={styles.label}>
        {t('component.gasAccount.withdrawPopup.to')}
      </Text>

      <View style={styles.labelContent}>
        <Text>{'rabby wallet '}</Text>
      </View>

      <View style={styles.btnContainer}>
        <Button
          type="primary"
          containerStyle={styles.confirmButton}
          onPress={withdraw}
          loading={loading}
          title={t('global.confirm')}
        />
      </View>
    </View>
  );
};

export const WithDrawPopup = props => {
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
      snapPoints={[440]}
      onDismiss={props.onCancel || props.onClose}
      ref={modalRef}>
      <BottomSheetView style={styles.popup}>
        <WithDrawInitContent
          balance={props.balance}
          onClose={props.onCancel || props.onClose}
        />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 12,
    color: colors['neutral-title1'],
  },
  description: {
    textAlign: 'center',
    fontSize: 13,
    color: colors['neutral-body'],
  },
  label: {
    fontSize: 13,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'left',
    width: '100%',
    color: colors['neutral-body'],
  },
  labelContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors['neutral-card2'],
    borderRadius: 6,
    width: '100%',
    height: 52,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  textContent: { flexDirection: 'row', alignItems: 'center' },
  btnContainer: {
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopColor: colors['neutral-line'],
    // borderTopWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 0.5,
    backgroundColor: colors['neutral-bg1'],
  },
  confirmButton: {
    width: '100%',
    height: 52,
  },
  popup: {
    justifyContent: 'flex-end',
    margin: 0,
    height: '100%',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
}));
