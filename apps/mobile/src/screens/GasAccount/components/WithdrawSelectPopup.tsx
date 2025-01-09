import { AppBottomSheetModal, AssetAvatar } from '@/components';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils';
import { ListItem } from '@/components2024/ListItem/ListItem';
import { useTheme2024 } from '@/hooks/theme';
import { findChainByServerID } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import {
  BottomSheetModalProps,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import React from 'react';
import { PropsWithChildren, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';
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

const RecipientAddressInner = ({
  address,
  onChange,
  list,
}: {
  address: string;
  onChange: (address: WithdrawListAddressItem) => void;
  list: WithdrawListAddressItem[];
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
        <TouchableOpacity
          style={[styles.innerRow, isSelected && styles.selected]}
          onPress={() => {
            setSelectedAddress(item.recharge_addr);
          }}>
          <AddressItem account={account}>
            {({ WalletIcon, WalletName, WalletAddress, WalletBalance }) => (
              <View style={styles.innerWalletRow}>
                <WalletIcon style={styles.innerWallet} />
                <View style={{ gap: 4 }}>
                  <WalletName style={styles.innerName} />
                  <WalletAddress style={styles.innerAddr} />
                </View>
              </View>
            )}
          </AddressItem>
          <Text style={styles.limit}>{`$${item.total_withdraw_limit}`}</Text>
        </TouchableOpacity>
      );
    },
    [
      accounts,
      address,
      selectedAddress,
      styles.innerAddr,
      styles.innerName,
      styles.innerRow,
      styles.innerWallet,
      styles.innerWalletRow,
      styles.limit,
      styles.selected,
    ],
  );

  const confirm = () => {
    onChange?.(list?.find(item => isSameAddress(item.recharge_addr, address))!);
  };

  return (
    <LinearGradient
      colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]}
      locations={[0.0745, 0.2242]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1, paddingHorizontal: 20 }}>
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
      <BottomSheetScrollView style={{ flex: 1 }}>
        {list?.map(item => (
          <AddrItem item={item} key={item.recharge_addr} />
        ))}
        <View style={{ height: 130 }} />
      </BottomSheetScrollView>
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
  );
};

export const RecipientAddress = ({
  address,
  onChange,
  list,
}: {
  address?: string;
  onChange?: (address: WithdrawListAddressItem) => void;
  list?: WithdrawListAddressItem[];
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
                    <WalletAddress style={styles.outerAddr} />
                  </View>
                </View>
              )}
            </AddressItem>
          ) : (
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
          )
        }
        onPress={() => {
          // onChange(address);
          if (list && address) {
            setVisible(true);
          }
        }}
      />
      {list && address && (
        <BottomSheetWrapper
          visible={visible}
          onClose={() => {
            setVisible(false);
          }}
          {...makeBottomSheetProps({
            linearGradientType: 'linear',
            colors: colors2024,
          })}>
          <RecipientAddressInner
            address={address}
            onChange={handleSelect}
            list={list}
          />
        </BottomSheetWrapper>
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
    marginBottom: 12,
    paddingHorizontal: 10,
  },

  help: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  label: {
    color: colors2024['neutral-secondary'],
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
  outerAddr: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    fontFamily: 'SF Pro Rounded',
  },

  innerRow: {
    height: 96,
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 30,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },

  selected: {
    backgroundColor: colors2024['brand-light-2'],
  },

  innerWalletRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  innerWallet: {
    width: 40,
    height: 40,
    borderRadius: 11,
  },
  innerName: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    fontFamily: 'SF Pro Rounded',
  },
  innerAddr: {
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 22,
    fontFamily: 'SF Pro Rounded',
  },
  limit: {
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 22,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  floatBottom: {
    width: '100%',
    height: 130,
    paddingBottom: 35,
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
