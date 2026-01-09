import SearchSVG from '@/assets2024/icons/common/search-cc.svg';
import { AssetAvatar } from '@/components';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { SearchInput } from '@/components/Form/SearchInput';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { ListItem } from '@/components2024/ListItem/ListItem';
import { toast } from '@/components2024/Toast';
import { L2_DEPOSIT_ADDRESS_MAP } from '@/constant/gas-account';
import {
  afterTopUpGasAccount,
  buildTopUpGasAccount,
  topUpGasAccount,
} from '@/core/apis/gasAccount';
import { openapi } from '@/core/request';
import { preferenceService } from '@/core/services';
import { Account } from '@/core/services/preference';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useAlias } from '@/hooks/alias';
import { useTheme2024 } from '@/hooks/theme';
import { findChainByServerID } from '@/utils/chain';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import {
  BottomSheetModalProps,
  BottomSheetScrollView,
  BottomSheetSectionList,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { Skeleton } from '@rneui/themed';
import BigNumber from 'bignumber.js';
import React, {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  Keyboard,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import useAsync from 'react-use/lib/useAsync';
import { useGasAccountHistoryRefresh, useGasAccountSign } from '../hooks/atom';
import { SelectGasAccountList } from './SelectGasAccountList';
import { maxBy } from 'lodash';
import {
  filterMyAccounts,
  isAccountSupportMiniApproval,
} from '@/utils/account';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import { useMiniSigner } from '@/hooks/useSigner';

const amountList = [10, 100];

const BottomSheetWrapper = (
  props: PropsWithChildren<
    {
      visible: boolean;
      onClose: () => void;
    } & BottomSheetModalProps
  >,
) => {
  const { visible, onClose, children, ...others } = props;
  const { colors2024, isLight } = useTheme2024({
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
      snapPoints={[Dimensions.get('window').height - 200]}
      onDismiss={onClose}
      ref={modalRef}
      {...makeBottomSheetProps({
        linearGradientType: 'linear',
        colors: colors2024,
      })}
      handleStyle={{
        backgroundColor: isLight
          ? colors2024['neutral-bg-0']
          : colors2024['neutral-bg-1'],
        paddingVertical: 18,
      }}
      {...others}>
      {children}
    </AppBottomSheetModal>
  );
};

const TokenSelector = ({
  cost,
  onChange,
  address,
  onClose,
}: {
  cost: number;
  onChange: (token: TokenItem) => void;
  address: string;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyles,
  });

  const [query, setQuery] = useState('');
  const [isInputActive, setIsInputActive] = useState(false);

  const handleInputFocus = () => {
    setIsInputActive(true);
  };

  const handleInputBlur = () => {
    setIsInputActive(false);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
  };

  const {
    value: list,
    loading,
    error,
  } = useAsync(() => openapi.getGasAccountTokenList(address), [address]);

  if (error) {
    toast.error(error?.message ? String(error?.message) : String(error));
  }

  const { value: pinedQueue } = useAsync(async () => {
    const data = await preferenceService.getUserTokenSettings();
    return data?.pinedQueue || [];
  }, []);

  const sortedList = useMemo(() => {
    const _list = list?.sort((a, b) => b.amount - a.amount) || [];
    const index = _list.findIndex(i => new BigNumber(i.amount || 0).lt(cost));
    const k = query?.trim()?.toLowerCase();

    const sortAndFilter = (l: (TokenItem & { pinned?: boolean })[]) =>
      l.filter(item =>
        k
          ? item.symbol?.toLowerCase().includes(k) ||
            item.id?.toLowerCase().includes(k)
          : true,
      );

    if (!_list.length) {
      return [];
    }

    if (_list.slice(index).length === 0) {
      return [
        {
          title: '',
          data: sortAndFilter(_list.slice(0, index)),
        },
      ];
    }

    return [
      {
        title: '',
        data: sortAndFilter(_list.slice(0, index)),
      },
      {
        title: 'insufficient',
        data: sortAndFilter(_list.slice(index)),
      },
    ];
  }, [cost, list, query]);

  const Row = useCallback(
    ({ item }: { item: TokenItem & { pinned?: boolean } }) => {
      const disabled = new BigNumber(item.amount || 0).lt(cost);

      return (
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
              size={40}
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
          <Text style={styles.text}>
            {formatUsdValue(item.amount * item.price || 0)}
          </Text>
        </CustomTouchableOpacity>
      );
    },
    [cost, onChange, onClose, styles.box, styles.text, styles.tokenListItem],
  );

  const showInsufficientTip = useMemo(() => {
    return (
      !!list &&
      list?.length > 0 &&
      list?.every(item => new BigNumber(item.amount).lt(cost))
    );
  }, [cost, list]);

  const ListHeader = useMemo(() => {
    return loading ? (
      <>
        {Array.from({ length: 10 }).map((_, index) => (
          <View key={index} style={[styles.tokenListItem, { marginBottom: 8 }]}>
            <View style={[styles.box, { gap: 16 }]}>
              <Skeleton circle width={40} height={40} />
              <Skeleton width={70} height={20} />
            </View>
            <Skeleton width={50} height={20} />
          </View>
        ))}
      </>
    ) : null;
  }, [loading, styles.box, styles.tokenListItem]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isLight
          ? colors2024['neutral-bg-0']
          : colors2024['neutral-bg-1'],
      }}>
      <View style={{ paddingHorizontal: 20 }}>
        <Text style={styles.title}>{t('page.gasTopUp.Deposit-tip')}</Text>

        <SearchInput
          isActive={isInputActive}
          containerStyle={styles.searchInputContainer}
          searchIconWrapperStyle={styles.searchIconWrapperStyle}
          inputStyle={styles.inputStyle}
          searchIcon={<SearchSVG color={colors2024['neutral-secondary']} />}
          inputProps={{
            value: query,
            onChange: e => handleQueryChange(e.nativeEvent.text),
            onFocus: handleInputFocus,
            onBlur: handleInputBlur,
            placeholder: 'Search Token',
            placeholderTextColor: colors2024['neutral-secondary'],
          }}
        />

        {showInsufficientTip && (
          <View style={styles.insufficientWrapper}>
            <View style={styles.insufficientDivider} />
            <View>
              <Text style={styles.insufficientTip}>
                {t('page.gasAccount.depositPopup.inSufficientTip1')}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.header}>
          <Text style={styles.label}>{t('page.gasTopUp.Token')}</Text>
          <Text style={styles.label}>{t('page.gasTopUp.Balance')}</Text>
        </View>
      </View>
      <BottomSheetSectionList
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => Keyboard.dismiss()}
        sections={sortedList}
        style={styles.flatList}
        ListHeaderComponent={ListHeader}
        renderItem={useCallback(
          ({ item }) => (
            <Row item={item} />
          ),
          [Row],
        )}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        renderSectionHeader={useCallback(
          ({ section: { title } }) => {
            if (title === 'insufficient' && !showInsufficientTip) {
              return (
                <View style={styles.tokenInsufficientWrapper}>
                  <View style={styles.tokenInsufficientDivider} />
                  <View>
                    <Text style={styles.tokenInsufficientTip}>
                      {t(
                        'page.gasAccount.depositPopup.followingTokenInSufficient',
                      )}
                    </Text>
                  </View>
                </View>
              );
            }
            return null;
          },
          [
            showInsufficientTip,
            t,
            styles.tokenInsufficientWrapper,
            styles.tokenInsufficientDivider,
            styles.tokenInsufficientTip,
          ],
        )}
        keyExtractor={item => item.id + item.chain}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
};

const SelectAccountPopup = ({
  visible,
  onChange,
  value,
  onClose,
}: {
  visible?: boolean;
  onClose?(): void;
  onChange: (account: Account) => void;
  value: Account;
}) => {
  const { t } = useTranslation();

  const { styles, colors2024 } = useTheme2024({
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

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

  // const list = useSortAddressList(filterAccounts);

  return (
    <AppBottomSheetModal
      // enableContentPanningGesture={false} // has scorll list
      // snapPoints={[Math.min(height - 200, 652)]}
      onDismiss={onClose}
      ref={modalRef}
      {...makeBottomSheetProps({
        linearGradientType: 'linear',
        colors: colors2024,
      })}
      enableDynamicSizing
      maxDynamicContentSize={maxHeight}
      handleStyle={styles.handleStyle}>
      <BottomSheetScrollView style={[styles.popup, { paddingTop: 0 }]}>
        <View style={styles.container}>
          <View style={styles.containerHorizontal}>
            <Text style={styles.title}>
              {t('page.gasAccount.paymentAddressPopup.title')}
            </Text>
          </View>
          <SelectGasAccountList value={value} onChange={onChange} />
        </View>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

const CUSTOM_AMOUNT = 0;

export const GasAccountDepositWithToken = ({
  onClose,
}: {
  onClose?(): void;
}) => {
  const { t } = useTranslation();
  const [selectedAmount, setAmount] = useState(amountList[0]);
  const [tokenListVisible, setTokenListVisible] = useState(false);
  const [token, setToken] = useState<TokenItem | undefined>(undefined);
  const [formattedValue, setFormattedValue] = useState('');
  const [rawValue, setRawValue] = useState<number>();

  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyles,
  });
  const { account } = useGasAccountSign();
  const [loading, setLoading] = useState(false);

  const { refresh: refreshHistoryList } = useGasAccountHistoryRefresh();

  const depositAmount = useMemo(() => {
    if (selectedAmount === CUSTOM_AMOUNT && rawValue) {
      return rawValue;
    }
    return selectedAmount;
  }, [selectedAmount, rawValue]);

  const topUp = async () => {
    if (token && depositAccount && !loading) {
      setLoading(true);
      const chainEnum = findChainByServerID(token.chain)!;
      try {
        await topUpGasAccount({
          to: L2_DEPOSIT_ADDRESS_MAP[chainEnum.enum],
          chainServerId: chainEnum.serverId,
          tokenId: token.id,
          amount: depositAmount,
          rawAmount: new BigNumber(depositAmount)
            .times(10 ** token.decimals)
            .toFixed(0),
          account: depositAccount,
        });
        onClose?.();
        refreshHistoryList();
      } catch (error) {}
      setLoading(false);
    }
  };

  const handleTopUp = async () => {
    if (isAccountSupportMiniApproval(depositAccount.type)) {
      if (token && depositAccount && !loading) {
        setLoading(true);
        const chainEnum = findChainByServerID(token.chain)!;
        try {
          const tx = await buildTopUpGasAccount({
            to: L2_DEPOSIT_ADDRESS_MAP[chainEnum.enum],
            chainServerId: chainEnum.serverId,
            tokenId: token.id,
            amount: depositAmount,
            rawAmount: new BigNumber(depositAmount)
              .times(10 ** token.decimals)
              .toFixed(0),
            account: depositAccount,
          });
          if (tx) {
            resetGasStore();
            closeMiniSign();
            const res = await openUI({
              txs: [tx],
              autoUseGasFree: true,
            });
            const hash = res?.[0];

            await afterTopUpGasAccount({
              to: L2_DEPOSIT_ADDRESS_MAP[chainEnum.enum],
              chainServerId: chainEnum.serverId,
              tokenId: token.id,
              amount: depositAmount,
              rawAmount: new BigNumber(depositAmount)
                .times(10 ** token.decimals)
                .toFixed(0),
              tx: hash,
              account: depositAccount,
            });
          }
          onClose?.();
          refreshHistoryList();
        } catch (error) {
          console.error(error);
          if ((error as any)?.name === 'SimulateError') {
            topUp();
          }
        }
        setLoading(false);
      }
    } else {
      topUp();
    }
  };

  const onInputChange = useCallback((value: string) => {
    let inputValue = value.replace(/[^0-9]/g, '');
    // only integer and no string
    if (inputValue === '' || /^\d*$/.test(inputValue)) {
      // no only 0
      if (inputValue === '0') {
        inputValue = '0';
      } else {
        inputValue = inputValue.replace(/^0+/, '') || ''; // remove 0
      }

      // add $ prefix
      if (inputValue && !inputValue.startsWith('$')) {
        inputValue = `$${inputValue}`;
      }

      setFormattedValue(inputValue);
      const numericValue = inputValue.replace(/[^0-9]/g, '');
      setRawValue(numericValue ? parseInt(numericValue, 10) : undefined);
    }
  }, []);

  const selectCustomAmount = useCallback(() => {
    setAmount(CUSTOM_AMOUNT);
  }, []);

  const errorTips = useMemo(() => {
    if (
      selectedAmount === CUSTOM_AMOUNT &&
      rawValue !== undefined &&
      rawValue === 0
    ) {
      return t('page.gasAccount.depositPopup.zeroInvalidAmount');
    }
    if (selectedAmount === CUSTOM_AMOUNT && rawValue && rawValue > 500) {
      return t('page.gasAccount.depositPopup.invalidAmount');
    }
  }, [rawValue, selectedAmount, t]);

  const amountPass = useMemo(() => {
    if (selectedAmount === CUSTOM_AMOUNT) {
      return !!rawValue && rawValue >= 1 && rawValue <= 500;
    }
    return true;
  }, [rawValue, selectedAmount]);

  const openTokenList = () => {
    if (!amountPass) {
      return;
    }
    setTokenListVisible(true);
  };

  useEffect(() => {
    if (token && depositAmount && token.amount < depositAmount) {
      setToken(undefined);
    }
  }, [depositAmount, token]);

  const { accounts } = useAccounts({ disableAutoFetch: true });

  const [accountListVisible, setAccountListVisible] = useState(false);

  const openAccountList = () => {
    if (!amountPass) {
      return;
    }
    setAccountListVisible(true);
  };

  const [depositAccount, setDepositAccount] = useState(() => {
    const list = filterMyAccounts(accounts);
    return maxBy(list, a => a.balance || 0) || list[0];
  });
  const {
    openUI,
    resetGasStore,
    close: closeMiniSign,
  } = useMiniSigner({ account: depositAccount });

  const onChangeAccount = useCallback((account: Account) => {
    setDepositAccount(pre => {
      if (!isSameAddress(pre.address || '', account.address)) {
        setToken(undefined);
      }
      return account;
    });
    setAccountListVisible(false);
  }, []);

  const [aliasName] = useAlias(depositAccount.address);

  return (
    // <KeyboardAwareScrollView
    //   enableOnAndroid
    //   scrollEnabled={false}
    //   keyboardOpeningTime={0}
    //   // style={styles.container}
    //   contentContainerStyle={styles.container}>
    <View style={styles.container}>
      <BottomSheetScrollView style={styles.popup}>
        <View style={styles.containerHorizontal}>
          <Text style={styles.title}>
            {t('page.gasAccount.depositPopup.title')}
          </Text>
          <Text style={styles.description}>
            {t('page.gasAccount.depositPopup.desc')}
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

            <BottomSheetTextInput
              placeholder="$1-500"
              placeholderTextColor={
                selectedAmount === CUSTOM_AMOUNT
                  ? colors2024['neutral-info']
                  : colors2024['neutral-body']
              }
              value={formattedValue}
              onFocus={selectCustomAmount}
              onChangeText={onInputChange}
              style={[
                styles.input,
                selectedAmount === CUSTOM_AMOUNT
                  ? {
                      borderColor: colors2024['brand-default'],
                    }
                  : {},
                errorTips ? { borderColor: colors2024['red-default'] } : {},
              ]}
              keyboardType="numeric"
              inputMode="numeric"
              onBlur={() => Keyboard.dismiss()}
            />
          </View>

          {errorTips && <Text style={styles.errorTips}>{errorTips}</Text>}

          <Text style={styles.tokenLabel}>
            {t('page.gasAccount.depositPopup.paymentAddress')}
          </Text>
          <ListItem
            disabled={!amountPass}
            title=""
            content={
              <AddressItem account={depositAccount}>
                {({ WalletIcon, WalletAddress }) => (
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 8,
                      alignItems: 'center',
                    }}>
                    <WalletIcon
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                      }}
                    />
                    <View style={{ gap: 3 }}>
                      <Text style={styles.walletName}>{aliasName}</Text>
                      <WalletAddress
                        style={{
                          fontSize: 12,
                          fontWeight: '500',
                          lineHeight: 16,
                        }}
                      />
                    </View>
                  </View>
                )}
              </AddressItem>
            }
            style={[styles.tokenContainer]}
            onPress={openAccountList}
          />

          <Text style={styles.tokenLabel}>
            {t('page.gasAccount.depositPopup.token')}
          </Text>
          <ListItem
            disabled={!amountPass}
            title=""
            content={
              token ? (
                <View style={styles.tokenContent}>
                  <AssetAvatar
                    size={30}
                    chain={token.chain}
                    logo={token.logo_url}
                    chainSize={12}
                  />
                  <Text style={styles.tokenSymbol}>
                    {getTokenSymbol(token)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.tokenPlaceholder}>
                  {t('page.gasAccount.depositPopup.selectToken')}
                </Text>
              )
            }
            style={[styles.tokenContainer]}
            onPress={openTokenList}
          />
        </View>
        <View style={{ height: styles.btnContainer.height }}></View>
      </BottomSheetScrollView>
      <View style={styles.btnContainer}>
        <Button
          loading={loading}
          type="primary"
          containerStyle={styles.confirmButton}
          onPress={handleTopUp}
          disabled={!token}
          title={t('global.confirm')}
        />
      </View>

      <BottomSheetWrapper
        visible={tokenListVisible}
        onClose={() => setTokenListVisible(false)}>
        <TokenSelector
          onClose={() => setTokenListVisible(false)}
          cost={depositAmount}
          onChange={setToken}
          address={depositAccount.address}
        />
      </BottomSheetWrapper>

      <SelectAccountPopup
        visible={accountListVisible}
        onClose={() => setAccountListVisible(false)}
        onChange={onChangeAccount}
        value={depositAccount}
      />
      {/* </KeyboardAwareScrollView> */}
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors, isLight, colors2024 }) => ({
  container: {
    width: '100%',
    // flex: 1
    height: '100%',
    position: 'relative',
    paddingBottom: 20,
  },
  popup: {
    margin: 0,
    // paddingBottom: 156,
    width: '100%',
    flex: 1,
  },
  handleStyle: {
    backgroundColor: 'transparent',
    paddingTop: 10,
    height: 36,
  },
  containerHorizontal: {
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    marginTop: 12,
    marginBottom: 18,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    marginBottom: 10,
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
    height: 60,
    borderRadius: 6,
    backgroundColor: colors2024['neutral-bg-2'],
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedAmountButton: {
    backgroundColor: colors['blue-light1'],
    borderColor: colors['blue-default'],
  },
  amountText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },

  input: {
    flex: 1,
    height: 60,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    borderRadius: 10,
    color: colors2024['neutral-body'],
  },
  tokenLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'left',
    width: '100%',
  },
  tokenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors['neutral-card2'],
    borderRadius: 30,
    width: '100%',
    height: 62,
    paddingHorizontal: 20,
  },
  flatList: {
    flexShrink: 1,
    paddingHorizontal: 20,
  },
  tokenListItem: {
    paddingVertical: 14,
    flex: 1,
    width: '100%',
    height: 74,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    paddingLeft: 12,
    paddingRight: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    borderRadius: 16,
  },
  tokenContent: { flexDirection: 'row', alignItems: 'center' },
  tokenSymbol: {
    marginLeft: 12,
    color: colors['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },
  tokenPlaceholder: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },
  confirmButton: {
    width: '100%',
    height: 52,
    marginBottom: 35,
  },
  btnContainer: {
    backgroundColor: colors2024['neutral-bg-1'],
    // marginTop: 34,
    width: '100%',
    bottom: 0,
    height: 126,
    position: 'absolute',
    paddingHorizontal: 20,
    paddingVertical: 20,
    justifyContent: 'flex-end',
    // flex: 1,
  },

  box: { flexDirection: 'row', alignItems: 'center' },
  text: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },

  errorTips: {
    textAlign: 'left',
    width: '100%',
    color: colors2024['red-default'],
    fontFamily: 'SF Pro',
    fontSize: 13,
    fontWeight: '400',
    marginTop: 20,
  },

  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 12,
  },

  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 22,
  },

  insufficientWrapper: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insufficientDivider: {
    position: 'absolute',
    top: 18,
    left: 0,
    width: '100%',
    height: 1,
    backgroundColor: colors2024['red-light-2'],
  },

  insufficientTip: {
    color: colors2024['red-default'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    paddingHorizontal: 8,
  },

  tokenInsufficientWrapper: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },

  tokenInsufficientDivider: {
    position: 'absolute',
    top: 9,
    left: 0,
    width: '100%',
    height: 1,
    backgroundColor: colors2024['neutral-line'],
  },

  tokenInsufficientTip: {
    color: colors2024['neutral-info'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    paddingHorizontal: 8,
  },

  searchInputContainer: {
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-5'],
    paddingHorizontal: 13,
    borderColor: 'transparent',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchIconWrapperStyle: {
    paddingLeft: 0,
  },
  inputStyle: {
    fontFamily: 'SF Pro Rounded',
    lineHeight: 22,
    fontSize: 17,
    color: colors2024['neutral-title-1'],
  },

  accountItem: {
    marginVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    height: 96,
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    paddingHorizontal: 24,
  },

  pinnedWrapper: {
    flexShrink: 0,
    marginLeft: 4,
    borderRadius: 6,
    width: 33,
    height: 20,
    flexWrap: 'nowrap',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['brand-light-1'],
  },
  pinText: {
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 18,
  },
  walletName: {
    color: colors2024['neutral-title-1'],

    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },
  favoriteBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 3,
    backgroundColor: colors2024['orange-light-1'],
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 16,
  },
  divider: {
    height: 8,
  },
}));
