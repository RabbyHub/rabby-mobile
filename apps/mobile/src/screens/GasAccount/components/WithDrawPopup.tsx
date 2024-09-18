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
import IconJumpBtn from '@/assets/icons/gas-account/IconJumpBtn.svg';
import RcIconHasConfirmed from '@/assets/icons/gas-account/IconHasConfirmed.svg';
import { openExternalUrl } from '@/core/utils/linking';

const WithDrawInitContent = ({
  balance,
  onClose,
  onAfterConfirm,
}: {
  balance: number;
  onClose: () => void;
  onAfterConfirm: () => void;
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

  const wallet = {} as any;

  const withdraw = async () => {
    try {
      setLoading(true);
      onAfterConfirm?.();
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
      <View style={styles.paddingContainer}>
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

const WithDrawConfrim = ({
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
  // const wallet = useWallet();

  const wallet = {} as any;

  const gotoDebank = async () => {
    try {
      openExternalUrl('https://debank.com/account');
    } catch (error) {
      // message.error(error?.message || String(error));
      __DEV__ && console.debug(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.paddingContainer}>
        <RcIconHasConfirmed style={styles.confirmIcon} />

        <Text style={styles.confirmTitle}>
          {t('component.gasAccount.withdrawConfirmModal.title')}
        </Text>

        <View
          style={[
            styles.labelContent,
            {
              width: 270,
              height: 48,
              marginTop: 17,
              marginBottom: 32,
            },
          ]}>
          <Text>{'rabby wallet '}</Text>
        </View>
      </View>

      <View style={styles.btnContainer}>
        <Button
          type="primary"
          containerStyle={styles.confirmButton}
          onPress={gotoDebank}
          buttonStyle={styles.debankBtn}
          loading={loading}
          icon={<IconJumpBtn style={styles.jumpBtnIcon} />}
          iconRight={true}
          title={t('component.gasAccount.withdrawConfirmModal.button')}
        />
      </View>
    </View>
  );
};

export const WithDrawPopup = props => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const modalRef = useRef<AppBottomSheetModal>(null);
  const confirmModalRef = useRef<AppBottomSheetModal>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!props?.visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [props?.visible]);

  useEffect(() => {
    if (!showConfirm) {
      confirmModalRef.current?.close();
    } else {
      modalRef.current?.close();
      confirmModalRef.current?.present();
    }
  }, [showConfirm]);

  const onAfterConfirm = () => {
    setShowConfirm(true);
  };

  return (
    <>
      <AppBottomSheetModal
        snapPoints={[440]}
        onDismiss={props.onCancel || props.onClose}
        ref={modalRef}>
        <BottomSheetView style={styles.popup}>
          <WithDrawInitContent
            balance={props.balance}
            onAfterConfirm={onAfterConfirm}
            onClose={props.onCancel || props.onClose}
          />
        </BottomSheetView>
      </AppBottomSheetModal>

      <AppBottomSheetModal
        snapPoints={[350]}
        onDismiss={() => setShowConfirm(false)}
        ref={confirmModalRef}>
        <BottomSheetView style={styles.popup}>
          <WithDrawConfrim
            balance={props.balance}
            onClose={() => setShowConfirm(false)}
          />
        </BottomSheetView>
      </AppBottomSheetModal>
    </>
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
  paddingContainer: {
    width: '100%',
    flex: 1,
    backgroundColor: colors['neutral-bg-1'],
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 12,
    color: colors['neutral-title1'],
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
    marginBottom: 12,
    color: colors['green-default'],
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
    paddingHorizontal: 20,
    paddingBottom: 35,
  },
  confirmButton: {
    width: '100%',
    height: 52,
  },
  debankBtn: {
    color: colors['neutral-title2'],
    backgroundColor: colors['orange-default'],
    fontSize: 16,
    fontWeight: '500',
  },
  jumpBtnIcon: {
    width: 16,
    height: 16,
  },
  popup: {
    justifyContent: 'flex-end',
    margin: 0,
    height: '100%',
    // paddingVertical: 10,
  },
  confirmIcon: {
    width: 32,
    height: 32,
  },
}));
