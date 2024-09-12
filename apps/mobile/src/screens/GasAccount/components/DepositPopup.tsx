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
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { noop } from 'lodash';
import { Tip } from '@/components/Tip';
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
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { findChainByServerID } from '@/utils/chain';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { TokenAmountItem } from '@/components/Approval/components/Actions/components/TokenAmountItem';
import { L2_DEPOSIT_ADDRESS_MAP } from '@/constant/gas-account';
import useAsync from 'react-use/lib/useAsync';
// import { GasAccountCloseIcon } from './PopupCloseIcon';

const amountList = [20, 100, 500];

const TokenSelector = ({ visible, onClose, cost, onChange }) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { currentAccount: account } = useCurrentAccount();

  const { value: list, loading } = useAsync(
    () => openapi.getGasAccountTokenList(account!.address),
    [account?.address],
  );

  const sortedList = useMemo(
    () => list?.sort((a, b) => b.amount - a.amount),
    [list],
  );

  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);

  const Row = useCallback(
    ({ item }) => {
      const disabled = new BigNumber(item.amount || 0)
        .times(item.price)
        .lt(new BigNumber(cost).times(1));

      return (
        <Tip
          placement="top"
          content={t('page.gasTopUp.InsufficientBalanceTips')}
          isVisible={disabled ? undefined : false}>
          <CustomTouchableOpacity
            style={[
              styles.row,
              { opacity: disabled ? 0.5 : 1 },
              !disabled && styles.rowActive,
            ]}
            onPress={() => {
              if (!disabled) {
                onChange(item);
                onClose();
              }
            }}
            disabled={disabled}>
            <View style={styles.tokenContainer}>
              {/* <TokenWithChain token={item} hideCorner /> */}
              <Text style={styles.tokenSymbol}>{getTokenSymbol(item)}</Text>
            </View>
            <Text>{formatUsdValue(item.amount * item.price || 0)}</Text>
          </CustomTouchableOpacity>
        </Tip>
      );
    },
    [cost, onChange, onClose, styles, t],
  );

  return (
    <AppBottomSheetModal
      ref={modalRef}
      onDismiss={onClose}
      snapPoints={[320]}
      // isVisible={visible}
    >
      <BottomSheetView style={styles.popup}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>
            {t('page.gasTopUp.Select-from-supported-tokens')}
          </Text>
          <View style={styles.header}>
            <Text>{t('page.gasTopUp.Token')}</Text>
            <Text>{t('page.gasTopUp.Value')}</Text>
          </View>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#7084ff" />
              <Text>{t('page.gasTopUp.Loading_Tokens')}</Text>
            </View>
          ) : sortedList?.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text>{t('page.gasTopUp.No_Tokens')}</Text>
            </View>
          ) : (
            <FlatList
              data={sortedList}
              renderItem={({ item }) => <Row item={item} />}
              keyExtractor={item => item.id}
            />
          )}
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const GasAccountDepositContent = ({ onClose }) => {
  const { t } = useTranslation();
  const [selectedAmount, setAmount] = useState(100);
  const [tokenListVisible, setTokenListVisible] = useState(false);
  const [token, setToken] = useState<TokenItem | undefined>(undefined);
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  // const wallet = useWallet();
  const wallet = {} as any;

  const openTokenList = () => setTokenListVisible(true);

  const topUpGasAccount = () => {
    if (token) {
      const chainEnum = findChainByServerID(token.chain)!;
      wallet.topUpGasAccount({
        to: L2_DEPOSIT_ADDRESS_MAP[chainEnum.enum],
        chainServerId: chainEnum.serverId,
        tokenId: token.id,
        amount: selectedAmount,
        rawAmount: new BigNumber(selectedAmount)
          .times(10 ** token.decimals)
          .toFixed(0),
      });
      onClose();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {t('page.gasAccount.depositPopup.title')}
      </Text>
      <Text style={styles.description}>
        {t('page.gasAccount.depositPopup.desc')}
      </Text>

      <View style={styles.amountSelector}>
        {amountList.map(amount => (
          <CustomTouchableOpacity
            key={amount}
            onPress={() => setAmount(amount)}
            style={[
              styles.amountButton,
              selectedAmount === amount && styles.selectedAmountButton,
            ]}>
            <Text
              style={
                selectedAmount === amount
                  ? styles.selectedAmountText
                  : styles.amountText
              }>
              ${amount}
            </Text>
          </CustomTouchableOpacity>
        ))}
      </View>

      <Text style={styles.tokenLabel}>
        {t('page.gasAccount.depositPopup.token')}
      </Text>
      <CustomTouchableOpacity
        style={styles.tokenContainer}
        onPress={openTokenList}>
        {token ? (
          <View style={styles.tokenContent}>
            {/* <TokenWithChain token={token} hideCorner width={24} height={24} /> */}
            <Text style={styles.tokenSymbol}>{getTokenSymbol(token)}</Text>
          </View>
        ) : (
          <Text style={styles.tokenPlaceholder}>
            {t('page.gasAccount.depositPopup.selectToken')}
          </Text>
        )}
      </CustomTouchableOpacity>

      <CustomTouchableOpacity
        style={[styles.confirmButton, !token && styles.confirmButtonDisabled]}
        onPress={topUpGasAccount}
        disabled={!token}>
        <Text style={styles.confirmButtonText}>{t('global.Confirm')}</Text>
      </CustomTouchableOpacity>

      <TokenSelector
        visible={tokenListVisible}
        onClose={() => setTokenListVisible(false)}
        cost={selectedAmount}
        onChange={setToken}
      />
    </View>
  );
};

export const GasAccountDepositPopup = props => {
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
      snapPoints={[320]}
      onDismiss={props.onCancel || props.onClose}
      ref={modalRef}>
      <BottomSheetView style={styles.popup}>
        <GasAccountDepositContent onClose={props.onCancel || props.onClose} />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles(colors => ({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '500', marginBottom: 12 },
  description: { textAlign: 'center', fontSize: 13, marginHorizontal: 20 },
  amountSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  amountButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 114,
    height: 52,
    borderRadius: 6,
    backgroundColor: '#F2F4F7',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedAmountButton: { backgroundColor: '#E0E7FF', borderColor: '#007BFF' },
  amountText: { fontSize: 18, fontWeight: '500' },
  selectedAmountText: { fontSize: 18, fontWeight: '500', color: '#007BFF' },
  tokenLabel: { fontSize: 13, marginTop: 12, marginBottom: 8 },
  tokenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F4F7',
    borderRadius: 6,
    width: '100%',
    height: 52,
    paddingHorizontal: 16,
  },
  tokenContent: { flexDirection: 'row', alignItems: 'center' },
  tokenSymbol: { fontSize: 15, fontWeight: '500', marginLeft: 12 },
  tokenPlaceholder: { fontSize: 15, fontWeight: '500' },
  confirmButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  confirmButtonDisabled: { backgroundColor: '#B0B0B0' },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  popup: { justifyContent: 'flex-end', margin: 0 },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: 500,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderColor: '#E0E0E0',
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 52,
    borderColor: 'transparent',
    borderWidth: 1,
    borderRadius: 6,
  },
  rowActive: { borderColor: '#007BFF' },
}));
