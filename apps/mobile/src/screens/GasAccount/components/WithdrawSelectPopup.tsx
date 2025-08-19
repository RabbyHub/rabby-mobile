import { AppBottomSheetModal, AssetAvatar } from '@/components';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { ListItem } from '@/components2024/ListItem/ListItem';
import { useTheme2024 } from '@/hooks/theme';
import { findChainByServerID } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import {
  BottomSheetModalProps,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo } from 'react';
import { PropsWithChildren, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RcHelpCC from '@/assets2024/icons/common/help.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useAccounts } from '@/hooks/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import {
  RechargeChainItem,
  WithdrawListAddressItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { Skeleton } from '@rneui/themed';
import LinearGradient from 'react-native-linear-gradient';
import { Button } from '@/components2024/Button';
import RcIconCheck from '@/assets/icons/select-chain/icon-checked.svg';
import { AddressItemShadowView } from '@/screens/Address/components/AddressItemShadowView';
import { trigger } from 'react-native-haptic-feedback';

const BottomSheetWrapper = (
  props: PropsWithChildren<
    {
      visible: boolean;
      onClose: () => void;
    } & BottomSheetModalProps
  >,
) => {
  const { visible, onClose, children, ...others } = props;

  const modalRef = useRef<AppBottomSheetModal>(null);

  useLayoutEffect(() => {
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
      {...others}>
      {children}
    </AppBottomSheetModal>
  );
};

const DestinationChainInner = ({
  // chain,
  list,
  onSelect,
}: {
  // chain?: CHAINS_ENUM;
  onSelect: (chain: RechargeChainItem) => void;
  list: RechargeChainItem[];
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const ChainItem = React.useCallback(
    ({ item }: { item: RechargeChainItem }) => {
      const disabled = !item.withdraw_limit;
      return (
        <TouchableOpacity
          disabled={disabled}
          style={[styles.selectRow, disabled && styles.disabled]}
          onPress={e => {
            e.stopPropagation();
            onSelect(item);
          }}>
          <View style={styles.chainBox}>
            <AssetAvatar
              logo={findChainByServerID(item.chain_id)!.logo}
              size={24}
            />
            <Text style={styles.text}>
              {findChainByServerID(item.chain_id)!.name}
            </Text>
          </View>

          <Text style={styles.text}>{`$${item.withdraw_limit}`}</Text>
        </TouchableOpacity>
      );
    },
    [onSelect, styles.selectRow, styles.disabled, styles.chainBox, styles.text],
  );

  const { bottom } = useSafeAreaInsets();

  const tips = () => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.DESCRIPTION,
      title: t('page.gasAccount.withdrawPopup.riskMessageFromChain'),
      sections: [],
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        snapPoints: ['30%'],
      },
      titleStyle: styles.tips,
      nextButtonProps: {
        title: (
          <Text style={styles.closeModalBtnText}>
            {t('page.gasAccount.withdrawPopup.tipsBtn')}
          </Text>
        ),
        onPress: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
      },
    });
  };

  return (
    <BottomSheetScrollView
      style={[
        styles.container,
        {
          paddingBottom: bottom,
        },
      ]}>
      <Text style={styles.title}>
        {t('page.gasAccount.withdrawPopup.selectDestinationChain')}
      </Text>
      <View style={styles.headerRow}>
        <Text style={[styles.text, styles.label]}>
          {t('page.gasAccount.withdrawPopup.destinationChain')}
        </Text>
        <View style={styles.help}>
          <Text style={[styles.text, styles.label]}>
            {t('page.gasAccount.withdrawPopup.withdrawalLimit')}
          </Text>
          <Pressable onPress={tips}>
            <RcHelpCC
              width={20}
              height={20}
              color={colors2024['neutral-info']}
            />
          </Pressable>
        </View>
      </View>
      <View style={styles.list}>
        {list.map((item: RechargeChainItem) => (
          <ChainItem item={item} key={item.chain_id} />
        ))}
      </View>
    </BottomSheetScrollView>
  );
};

export const DestinationChain = ({
  chain,
  onSelect: onChainSelect,
  list,
}: {
  chain?: RechargeChainItem;
  onSelect: (chain: RechargeChainItem) => void;
  list?: RechargeChainItem[];
}) => {
  const { t } = useTranslation();

  const { styles, colors2024 } = useTheme2024({ getStyle });

  const [visible, setVisible] = React.useState(false);

  const handleSelect = React.useCallback(
    (chain: RechargeChainItem) => {
      onChainSelect(chain);
      setVisible(false);
    },
    [onChainSelect],
  );

  return (
    <>
      <ListItem
        style={{
          width: '100%',
        }}
        title=""
        content={
          chain ? (
            <View style={styles.chainBox}>
              <AssetAvatar
                logo={findChainByServerID(chain.chain_id)!.logo}
                size={24}
              />
              <Text style={styles.text}>
                {findChainByServerID(chain.chain_id)!.name}
              </Text>
            </View>
          ) : (
            <Text style={styles.text}>
              {t('page.gasAccount.withdrawPopup.selectChain')}
            </Text>
          )
        }
        onPress={() => {
          if (list?.length) {
            setVisible(true);
          }
        }}
      />
      {list && (
        <BottomSheetWrapper
          visible={visible}
          onClose={() => {
            setVisible(false);
          }}
          {...makeBottomSheetProps({
            linearGradientType: 'linear',
            colors: colors2024,
          })}>
          <DestinationChainInner onSelect={handleSelect} list={list} />
        </BottomSheetWrapper>
      )}
    </>
  );
};

const RecipientAddressInnerPopup = ({
  address,
  onChange,
  list,
  visible,
  onClose,
}: {
  address: string;
  onChange: (address: WithdrawListAddressItem) => void;
  list: WithdrawListAddressItem[];
  visible?: boolean;
  onClose?(): void;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

  const [selectedAddress, setSelectedAddress] = React.useState(address);

  const tips = React.useCallback(() => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.DESCRIPTION,
      title: t('page.gasAccount.withdrawPopup.riskMessageFromAddress'),
      sections: [],
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        snapPoints: ['30%'],
      },
      titleStyle: styles.tips,
      nextButtonProps: {
        title: (
          <Text style={styles.closeModalBtnText}>
            {t('page.gasAccount.withdrawPopup.tipsBtn')}
          </Text>
        ),
        onPress: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
      },
    });
  }, [t, styles.tips, styles.closeModalBtnText]);

  const { accounts } = useAccounts({ disableAutoFetch: true });

  const AddrItem = React.useCallback(
    ({ item }: { item: WithdrawListAddressItem }) => {
      const account = accounts.find(acct =>
        isSameAddress(item.recharge_addr, acct.address),
      );

      const isSelected =
        !!address && isSameAddress(selectedAddress, item.recharge_addr);

      if (!account) {
        return null;
      }
      return (
        <AddressItemShadowView
          style={[styles.shadow, isSelected && styles.shadowSelected]}>
          <TouchableOpacity
            style={[styles.innerRow, isSelected && styles.innerRowSelected]}
            onPress={() => {
              setSelectedAddress(item.recharge_addr);
            }}>
            <AddressItem account={account}>
              {({ WalletIcon, WalletName, WalletAddress, WalletBalance }) => (
                <View style={styles.innerWalletRow}>
                  <WalletIcon
                    style={styles.innerWallet}
                    width={46}
                    height={46}
                    borderRadius={12}
                  />
                  <View style={{ gap: 4 }}>
                    <View style={styles.walletNameContainer}>
                      <WalletName style={styles.innerName} />
                      {isSelected ? <RcIconCheck height={20} /> : null}
                    </View>
                    {/* <WalletAddress style={styles.innerAddr} /> */}
                    <WalletBalance style={styles.innerBalance} />
                  </View>
                </View>
              )}
            </AddressItem>
            <Text style={styles.limit}>{`$${item.total_withdraw_limit}`}</Text>
          </TouchableOpacity>
        </AddressItemShadowView>
      );
    },
    [
      accounts,
      address,
      selectedAddress,
      styles.innerBalance,
      styles.innerName,
      styles.innerRow,
      styles.innerRowSelected,
      styles.innerWallet,
      styles.innerWalletRow,
      styles.limit,
      styles.shadow,
      styles.shadowSelected,
      styles.walletNameContainer,
    ],
  );

  const confirm = React.useCallback(() => {
    onChange?.(
      list?.find(item => isSameAddress(item.recharge_addr, selectedAddress))!,
    );
  }, [onChange, list, selectedAddress]);

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

  return (
    <AppBottomSheetModal
      // enableContentPanningGesture={false} // has scorll list
      // snapPoints={[Math.min(height - 200, 652)]}
      onDismiss={onClose}
      ref={modalRef}
      {...makeBottomSheetProps({
        linearGradientType: 'bg1',
        colors: colors2024,
      })}
      enableDynamicSizing
      maxDynamicContentSize={maxHeight}>
      <BottomSheetScrollView style={{ minHeight: 364 }}>
        <LinearGradient
          colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]}
          locations={[0.0745, 0.2242]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ flex: 1, paddingHorizontal: 20, position: 'relative' }}>
          <Text style={[styles.title, { marginTop: 0, marginBottom: 28 }]}>
            {t('page.gasAccount.withdrawPopup.selectRecipientAddress')}
          </Text>
          <View style={styles.headerRow}>
            <Text style={styles.helpText}>
              {t('page.gasAccount.withdrawPopup.recipientAddress')}
            </Text>
            <View style={styles.help}>
              <Text style={styles.helpText}>
                {t('page.gasAccount.withdrawPopup.withdrawalLimit')}
              </Text>
              <Pressable onPress={tips}>
                <RcHelpCC
                  width={20}
                  height={20}
                  color={colors2024['neutral-info']}
                />
              </Pressable>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            {list?.map(item => (
              <AddrItem item={item} key={item.recharge_addr} />
            ))}
            <View style={{ height: 130 }} />
          </View>
          <LinearGradient
            colors={
              isLight
                ? ['#FFF', 'rgba(249, 249, 249, 0.30)']
                : [colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]
            }
            locations={[0.6393, 1]}
            start={{ x: 0, y: 1 }}
            end={{ x: 0, y: 0 }}
            style={styles.floatBottom}>
            <Button
              title={t('global.confirm')}
              onPress={e => {
                e.stopPropagation();
                confirm();
              }}
            />
          </LinearGradient>
        </LinearGradient>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

export const RecipientAddress = ({
  address,
  onChange,
  list,
  loading,
}: {
  address?: string;
  onChange?: (address: WithdrawListAddressItem) => void;
  list?: WithdrawListAddressItem[];
  loading?: boolean;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { accounts } = useAccounts({ disableAutoFetch: true });

  const account = React.useMemo(
    () => accounts.find(item => isSameAddress(item.address, address || '')),
    [accounts, address],
  );

  const [visible, setVisible] = React.useState(false);
  const handleSelect = React.useCallback(
    (item: WithdrawListAddressItem) => {
      onChange?.(item);
      setVisible(false);
    },
    [onChange],
  );

  return (
    <>
      <ListItem
        style={{
          width: '100%',
        }}
        title=""
        content={
          account ? (
            <AddressItem account={account} fetchAccount={true}>
              {({ WalletIcon, WalletName, WalletAddress, WalletBalance }) => (
                <View style={styles.outerWalletRow}>
                  <WalletIcon style={styles.outerWallet} />
                  <View style={{ gap: 4 }}>
                    <WalletName style={styles.outerName} />
                    <WalletBalance style={styles.outerBalance} />
                  </View>
                </View>
              )}
            </AddressItem>
          ) : loading ? (
            <View style={styles.outerWalletRow}>
              <Skeleton
                width={30}
                height={30}
                style={{
                  borderRadius: 30,
                }}
              />
              <View style={{ gap: 4 }}>
                <Skeleton height={22} width={80} />

                <Skeleton height={16} width={100} />
              </View>
            </View>
          ) : (
            <View style={{ width: '100%' }}>
              <Text style={styles.noRecipientAddress}>
                {t('page.gasAccount.withdrawPopup.noRecipient')}
              </Text>
            </View>
          )
        }
        onPress={
          !account && !loading
            ? undefined
            : () => {
                // onChange(address);
                if (list && address) {
                  setVisible(true);
                }
              }
        }
      />
      {list && address && (
        <RecipientAddressInnerPopup
          visible={visible}
          onClose={() => {
            setVisible(false);
          }}
          {...makeBottomSheetProps({
            linearGradientType: 'linear',
            colors: colors2024,
          })}
          address={address}
          onChange={handleSelect}
          list={list}
        />
      )}
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
    alignContent: 'stretch',
    paddingHorizontal: 16,
    position: 'relative',
  },
  handleStyle: {
    paddingTop: 10,
    height: 36,
  },
  title: {
    marginVertical: 20,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
  },

  list: {
    maxHeight: '100%',
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },

  disabled: {
    opacity: 0.3,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 6,
  },

  help: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  helpText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 22,
    color: colors2024['neutral-secondary'],
  },

  label: {
    color: colors2024['neutral-secondary'],
    fontWeight: '400',
  },

  selectRow: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  chainBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  text: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },

  tips: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 24,
    textAlign: 'left',
  },

  closeModalBtnText: {
    fontSize: 20,
    color: colors2024['neutral-InvertHighlight'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },

  outerWalletRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  outerWallet: {
    width: 30,
    height: 30,
    borderRadius: 10,
  },
  outerName: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    fontFamily: 'SF Pro Rounded',
  },
  outerBalance: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 16,
  },

  shadow: {
    marginVertical: 6,
  },
  shadowSelected: {
    borderColor: colors2024['brand-light-2'],
  },
  innerRow: {
    // height: 96,
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 12,
    padding: 16,
    // borderWidth: 1,
    // borderColor: colors2024['neutral-line'],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // marginVertical: 6,
  },
  innerRowSelected: {
    borderColor: colors2024['brand-light-2'],
    backgroundColor: colors2024['brand-light-1'],
  },

  selected: {
    backgroundColor: colors2024['brand-light-2'],
  },

  innerWalletRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  innerWallet: {
    width: 46,
    height: 46,
    borderRadius: 12,
  },
  walletNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  innerName: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
  },
  innerAddr: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
  innerBalance: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  limit: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
  },
  floatBottom: {
    height: 130,
    paddingBottom: 35,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noRecipientAddress: {
    textAlign: 'center',
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 20,
  },
}));
