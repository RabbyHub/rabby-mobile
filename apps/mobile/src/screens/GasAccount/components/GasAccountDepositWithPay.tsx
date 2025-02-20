import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  PropsWithChildren,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
  TextInput,
  Platform,
} from 'react-native';
import { AssetAvatar } from '@/components';
import { useTranslation } from 'react-i18next';
import { formatUsdValue } from '@/utils/number';
import { openapi } from '@/core/request';
import {
  BottomSheetFlatList,
  BottomSheetModalProps,
  BottomSheetSectionList,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { getTokenSymbol } from '@/utils/token';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { findChainByServerID } from '@/utils/chain';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { L2_DEPOSIT_ADDRESS_MAP } from '@/constant/gas-account';
import useAsync from 'react-use/lib/useAsync';
import { topUpGasAccount } from '@/core/apis/gasAccount';
import { useGasAccountHistoryRefresh, useGasAccountSign } from '../hooks/atom';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils';
import { ListItem } from '@/components2024/ListItem/ListItem';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import RcIconCheck from '@/assets/icons/select-chain/icon-checked.svg';
import { Button } from '@/components2024/Button';
import { gasAccountService, preferenceService } from '@/core/services';
import { Account } from '@/core/services/preference';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import SearchSVG from '@/assets2024/icons/common/search-cc.svg';
import { SearchInput } from '@/components/Form/SearchInput';
import { Skeleton } from '@rneui/themed';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { toast } from '@/components2024/Toast';
import { useAlias } from '@/hooks/alias';
import { useMemoizedFn } from 'ahooks';
import {
  RcIconApplePayCC,
  RcIconGooglePayCC,
} from '@/assets2024/icons/gas-account';

const amountList = [0.7, 1.4, 7];

const BottomSheetWrapper = (
  props: PropsWithChildren<
    {
      visible: boolean;
      onClose: () => void;
    } & BottomSheetModalProps
  >,
) => {
  const { visible, onClose, children, ...others } = props;
  const { colors2024 } = useTheme2024({
    getStyle: getStyles,
  });

  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);
  return (
    <AppBottomSheetModal
      snapPoints={['90%']}
      onDismiss={onClose}
      ref={modalRef}
      {...makeBottomSheetProps({
        linearGradientType: 'linear',
        colors: colors2024,
      })}
      {...others}>
      {children}
    </AppBottomSheetModal>
  );
};

export const GasAccountDepositWithPay = ({ onClose }) => {
  const { t } = useTranslation();
  const [selectedAmount, setAmount] = useState(amountList[0]);

  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyles,
  });
  const { account } = useGasAccountSign();
  const [loading, setLoading] = useState(false);

  const { switchSceneSigningAccount } = useSwitchSceneCurrentAccount();
  const { refresh: refreshHistoryList } = useGasAccountHistoryRefresh();

  const depositAmount = useMemo(() => {
    return selectedAmount;
  }, [selectedAmount]);

  const handleDeposit = useMemoizedFn(() => {});
  // const topUp = async () => {
  //   if (token && depositAccount && !loading) {
  //     setLoading(true);
  //     const chainEnum = findChainByServerID(token.chain)!;
  //     await switchSceneSigningAccount(
  //       'GasAccount',
  //       depositAccount as KeyringAccountWithAlias,
  //     );
  //     try {
  //       await topUpGasAccount({
  //         to: L2_DEPOSIT_ADDRESS_MAP[chainEnum.enum],
  //         chainServerId: chainEnum.serverId,
  //         tokenId: token.id,
  //         amount: depositAmount,
  //         rawAmount: new BigNumber(depositAmount)
  //           .times(10 ** token.decimals)
  //           .toFixed(0),
  //       });
  //       onClose();
  //       refreshHistoryList();
  //     } catch (error) {}
  //     await switchSceneSigningAccount('GasAccount', null);
  //     setLoading(false);
  //   }
  // };

  // useEffect(() => {
  //   if (token && depositAmount && token.amount < depositAmount) {
  //     setToken(undefined);
  //   }
  // }, [depositAmount, token]);

  const { accounts } = useAccounts({ disableAutoFetch: true });

  const [depositAccount, setDepositAccount] = useState(() => {
    const last = gasAccountService.getLastDepositAccount() || account!;
    if (
      accounts.some(
        a => isSameAddress(a.address, last.address) && a.type === last.type,
      )
    ) {
      return last as Account;
    }
    return account! as Account;
  });

  return (
    <KeyboardAwareScrollView
      enableOnAndroid
      scrollEnabled={false}
      keyboardOpeningTime={0}
      // style={styles.container}
      contentContainerStyle={styles.container}>
      <View style={styles.containerHorizontal}>
        <Text style={styles.title}>
          {Platform.OS === 'android'
            ? t('page.gasAccount.depositPayPopup.titleAndroid')
            : t('page.gasAccount.depositPayPopup.title')}
        </Text>
        <Text style={styles.description}>
          {t('page.gasAccount.depositPayPopup.balance')}
          todo $0.1
        </Text>

        <Text style={styles.tokenLabel}>
          {t('page.gasAccount.depositPopup.amount')}
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
              <Text style={styles.amountText}>${amount}</Text>
            </CustomTouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.btnContainer}>
        {/* <Button
          loading={loading}
          type="primary"
          onPress={handleDeposit}
          title={t('global.confirm')}
        /> */}

        <Button
          type="primary"
          onPress={() => {
            // onDepositPress?.('pay');
          }}
          buttonStyle={styles.depositWithPayBtn}
          titleStyle={styles.btnTitle}
          // disabled={!canDeposit || isLoading}
          title={
            <View style={styles.depositWithTitle}>
              <View style={styles.depositWithPayRow}>
                {Platform.OS === 'android' ? (
                  <RcIconGooglePayCC />
                ) : (
                  <RcIconApplePayCC />
                )}
                <Text style={styles.btnTitle}>$0.99 // todo</Text>
              </View>
              <Text style={styles.btnDesc}>
                todo Includes a $0.3 Apple Pay fee. No withdrawals
              </Text>
            </View>
          }
        />
      </View>
    </KeyboardAwareScrollView>
  );
};

const getStyles = createGetStyles2024(({ colors, colors2024 }) => ({
  container: {
    width: '100%',
    flex: 1,
  },
  containerHorizontal: {
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontStyle: 'normal',
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontStyle: 'normal',
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    marginBottom: 18,
  },
  amountSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
  },
  amountButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: 60,
    borderRadius: 10,
    backgroundColor: colors2024['neutral-bg-2'],
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedAmountButton: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors2024['brand-default'],
  },
  amountText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },

  tokenLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontStyle: 'normal',
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    marginBottom: 8,
    textAlign: 'left',
    width: '100%',
  },

  btnContainer: {
    marginTop: 26,
    paddingHorizontal: 20,
    justifyContent: 'flex-end',
  },

  depositWithPayBtn: {
    backgroundColor: '#000',
    height: 60,
  },
  depositWithTitle: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },

  depositWithPayRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontStyle: 'normal',
    fontWeight: '700',
    color: colors2024['neutral-InvertHighlight'],
  },

  btnDesc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontStyle: 'normal',
    fontWeight: '400',
    color: colors2024['neutral-InvertHighlight'],
    opacity: 0.6,
  },
}));
