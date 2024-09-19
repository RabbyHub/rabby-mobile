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
import RcIconRightArrowCC from '@/assets/icons/gas-top-up/arrow-right-cc.svg';
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
          tooltipStyle={{
            transform: [{ translateY: 30 }],
          }}
          content={
            disabled ? t('page.gasTopUp.InsufficientBalanceTips') : undefined
          }
          // isVisible={!disabled}
        >
          <CustomTouchableOpacity
            style={[styles.tokenListItem, { opacity: disabled ? 0.5 : 1 }]}
            onPress={() => {
              if (!disabled) {
                onChange(item);
                onClose();
              }
            }}
            disabled={disabled}>
            <View style={styles.box}>
              <AssetAvatar
                size={32}
                chain={item.chain}
                logo={item.logo_url}
                chainSize={16}
              />
              <Text
                style={StyleSheet.flatten([
                  {
                    marginLeft: 16,
                  },
                  styles.text,
                ])}>
                {getTokenSymbol(item)}
              </Text>
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
      snapPoints={[550]}
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
              style={styles.flatList}
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
      <View style={styles.containerHorizontal}>
        <Text style={styles.title}>
          {t('component.gasAccount.depositPopup.title')}
        </Text>
        <Text style={styles.description}>
          {t('component.gasAccount.depositPopup.desc')}
        </Text>

        <Text style={styles.tokenLabel}>
          {t('component.gasAccount.depositPopup.amount')}
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
          {t('component.gasAccount.depositPopup.token')}
        </Text>
        <CustomTouchableOpacity
          style={styles.tokenContainer}
          onPress={openTokenList}>
          {token ? (
            <View style={styles.tokenContent}>
              <AssetAvatar
                size={24}
                chain={token.chain}
                logo={token.logo_url}
                chainSize={16}
              />
              <Text style={styles.tokenSymbol}>{getTokenSymbol(token)}</Text>
            </View>
          ) : (
            <Text style={styles.tokenPlaceholder}>
              {t('component.gasAccount.depositPopup.selectToken')}
            </Text>
          )}
          <RcIconRightArrowCC
            width={16}
            height={16}
            color={colors['neutral-foot']}
          />
        </CustomTouchableOpacity>
      </View>

      <View style={styles.btnContainer}>
        <Button
          type="primary"
          containerStyle={styles.confirmButton}
          onPress={topUpGasAccount}
          disabled={!token}
          title={t('global.confirm')}
        />
      </View>

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
      snapPoints={[440]}
      onDismiss={props.onCancel || props.onClose}
      ref={modalRef}>
      <BottomSheetView style={styles.popup}>
        <GasAccountDepositContent onClose={props.onCancel || props.onClose} />
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
  containerHorizontal: {
    width: '100%',
    flex: 1,
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
  description: {
    textAlign: 'center',
    fontSize: 13,
    marginHorizontal: 20,
    color: colors['neutral-body'],
  },
  amountSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    height: 52,
  },
  amountButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 8,
    height: 52,
    borderRadius: 6,
    backgroundColor: colors['neutral-card2'],
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedAmountButton: {
    backgroundColor: colors['blue-light1'],
    borderColor: '#007BFF',
  },
  amountText: { fontSize: 18, fontWeight: '500' },
  selectedAmountText: { fontSize: 18, fontWeight: '500', color: '#007BFF' },
  tokenLabel: {
    fontSize: 13,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'left',
    width: '100%',
    color: colors['neutral-body'],
  },
  tokenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors['neutral-card2'],
    borderRadius: 6,
    width: '100%',
    height: 52,
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  flatList: {
    width: '100%',
  },
  tokenListItem: {
    height: 64,
    flex: 1,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 6,
  },
  tokenContent: { flexDirection: 'row', alignItems: 'center' },
  tokenSymbol: { fontSize: 15, fontWeight: '500', marginLeft: 12 },
  tokenPlaceholder: { fontSize: 15, fontWeight: '500' },
  confirmButton: {
    width: '100%',
    height: 52,
  },
  popup: {
    justifyContent: 'flex-end',
    margin: 0,
    height: '100%',
    // paddingHorizontal: 20,
    paddingVertical: 10,
  },
  btnContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopColor: colors['neutral-line'],
    // borderTopWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 0.5,
    backgroundColor: colors['neutral-bg1'],
  },
  modalContent: {
    paddingHorizontal: 20,
    backgroundColor: colors['neutral-bg1'],
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  box: { flexDirection: 'row', alignItems: 'center' },
  text: {
    fontSize: 16,
    fontWeight: '500',
    color: colors['neutral-title-1'],
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderColor: colors['neutral-line'],
    paddingVertical: 8,
  },
}));
