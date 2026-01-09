import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import React, { useCallback, useMemo } from 'react';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import RcIconCorrectCC from './icons/correct-cc.svg';
import { Account } from '@/core/services/preference';
import { AddressItemShadowView } from '@/screens/Address/components/AddressItemShadowView';
import { useTokenAmountForAddress, useTopTokensForAddress } from './hooks';
import { AssetAvatar } from '../AssetAvatar';
import { trigger } from 'react-native-haptic-feedback';
import { useTranslation } from 'react-i18next';
import { AccountSwitcherContextMenu } from './ContextMenu';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { TokenDetailHeaderArea } from '@/screens/TokenDetail/components/HeaderArea';
import { formatPrice, formatTokenAmount } from '@/utils/number';
import { ITokenItem } from '@/store/tokens';
const MY_ADDRESS_LIMIT = 3;
export const AddressItemSizes = {
  radiusValue: 20,
  useAllItemH: 78,
  itemH: 78,
  itemGap: 12,
  get myAddressesAreaVisiableH() {
    return (
      AddressItemSizes.itemH * MY_ADDRESS_LIMIT +
      AddressItemSizes.itemGap * (MY_ADDRESS_LIMIT - 1)
    );
  },
};

type AddressItemProps = React.ComponentProps<typeof AddressItem>;
export function AddressItemInPanel({
  style,
  addressItemProps,
  isCurrent,
  isHideToken,
  onPressAddress: proponPressAddress,
}: {
  addressItemProps: AddressItemProps & { account: Account };
  isCurrent?: boolean;
  onPressAddress?: (account: Account) => void;
  token?: ITokenItem;
  isHideToken?: boolean;
} & RNViewProps) {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getAddressItemInPanelStyle,
  });

  const { t } = useTranslation();
  const [isPressing, setIsPressing] = React.useState(false);

  const { account } = addressItemProps;
  const onPressAddress = useCallback(() => {
    proponPressAddress?.(account);
  }, [account, proponPressAddress]);

  const { tokenList: tokens } = useTopTokensForAddress({
    accountAddress: account?.address,
  });

  return (
    <AddressItemShadowView
      // disableShadow
      style={[
        styles.addressItemView,
        style,
        isCurrent || isPressing ? styles.active : null,
      ]}>
      <AccountSwitcherContextMenu account={account}>
        <TouchableOpacity
          style={StyleSheet.flatten([
            styles.addressItemContainer,
            isCurrent && styles.addressItemContainerCurrent,
            isPressing && styles.containerPressing,
          ])}
          activeOpacity={1}
          delayLongPress={200} // long press delay
          onLongPress={() => {
            trigger('impactLight', {
              enableVibrateFallback: true,
              ignoreAndroidSystemSettings: false,
            });
          }}
          onPressIn={() => setIsPressing(true)}
          onPressOut={() => setIsPressing(false)}
          onPress={onPressAddress}>
          <AddressItem {...addressItemProps}>
            {({ WalletIcon, WalletAddress, WalletBalance, WalletName }) => {
              return (
                <View style={styles.addressItemInner}>
                  <WalletIcon
                    borderRadius={14}
                    width={46}
                    height={46}
                    style={styles.walletIcon}
                  />
                  <View style={styles.centerInfo}>
                    <View style={styles.nameAndAdderss}>
                      <WalletName style={styles.addressAliasName} />
                    </View>
                    <View style={styles.bottomArea}>
                      <WalletBalance
                        style={[
                          styles.addressUsdValue,
                          isCurrent && styles.addressUsdValueCurrent,
                        ]}
                      />
                      {!isHideToken && !!tokens?.length && (
                        <>
                          <View style={styles.divider} />
                          <View style={styles.chainLogos}>
                            {tokens.map(item => (
                              <AssetAvatar
                                key={`${item.chain}-${item.id}`}
                                logo={item.logo_url}
                                size={14}
                                logoStyle={styles.chainLogoItem}
                              />
                            ))}
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                  <View style={styles.rightArea}>
                    {isCurrent && (
                      <RcIconCorrectCC
                        color={colors2024['green-default']}
                        width={16}
                        height={16}
                      />
                    )}
                  </View>
                </View>
              );
            }}
          </AddressItem>
        </TouchableOpacity>
      </AccountSwitcherContextMenu>
    </AddressItemShadowView>
  );
}

export function AddressItemInPanelForTokenDetail({
  style,
  addressItemProps,
  isCurrent,
  token,
  onPressAddress: _onPressAddress,
}: {
  addressItemProps: AddressItemProps & { account: Account };
  isCurrent?: boolean;
  token?: ITokenItem;
  onPressAddress?: (account: Account) => void;
  isHideToken?: boolean;
} & RNViewProps) {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getAddressItemInPanelStyle,
  });

  const [isPressing, setIsPressing] = React.useState(false);

  const { account } = addressItemProps;

  const { tokenAmount, enableFetch } = useTokenAmountForAddress({
    accountAddress: account?.address,
    token,
  });
  const onPressAddress = useCallback(() => {
    _onPressAddress?.(account);
  }, [account, _onPressAddress]);

  const usdValue = useMemo(() => {
    const _usdValue = (token?.price || 0) * (tokenAmount || 0);
    return formatPrice(_usdValue || 0, 8, true);
  }, [token?.price, tokenAmount]);

  return (
    <AddressItemShadowView
      // disableShadow
      style={[
        styles.addressItemView,
        style,
        isCurrent || isPressing ? styles.active : null,
      ]}>
      <AccountSwitcherContextMenu account={account}>
        <TouchableOpacity
          style={StyleSheet.flatten([
            styles.addressItemContainer,
            isCurrent && styles.addressItemContainerCurrent,
            isPressing && styles.containerPressing,
          ])}
          activeOpacity={1}
          delayLongPress={200} // long press delay
          onLongPress={() => {
            trigger('impactLight', {
              enableVibrateFallback: true,
              ignoreAndroidSystemSettings: false,
            });
          }}
          onPressIn={() => setIsPressing(true)}
          onPressOut={() => setIsPressing(false)}
          onPress={onPressAddress}>
          <AddressItem {...addressItemProps}>
            {({ WalletIcon, WalletName }) => {
              return (
                <View style={styles.addressItemInner}>
                  <WalletIcon
                    borderRadius={14}
                    width={46}
                    height={46}
                    style={styles.walletIcon}
                  />
                  <View style={styles.centerInfo}>
                    <View style={styles.nameAndAdderss}>
                      <WalletName style={styles.addressAliasName} />
                      {isCurrent && (
                        <RcIconCorrectCC
                          color={colors2024['green-default']}
                          width={16}
                          height={16}
                        />
                      )}
                    </View>
                    {enableFetch && (
                      <View style={styles.detailBottomArea}>
                        {!!token && (
                          <TokenDetailHeaderArea
                            token={token}
                            tokenSize={20}
                            chainSize={10}
                            borderChain
                            rootStyle={styles.tokenDetailHeaderArea}
                            disableRefresh
                            title={formatTokenAmount(tokenAmount || 0)}
                            // style={{ justifyContent: 'center' }}
                            titleStyle={styles.tokenSymbol}
                          />
                        )}
                        <Text style={styles.tokenUsdValue}>≈${usdValue}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
          </AddressItem>
        </TouchableOpacity>
      </AccountSwitcherContextMenu>
    </AddressItemShadowView>
  );
}

const getAddressItemInPanelStyle = createGetStyles2024(ctx => {
  return {
    addressItemView: {
      borderRadius: AddressItemSizes.radiusValue,
      overflow: 'hidden',
    },
    active: {
      borderColor: ctx.colors2024['brand-light-2'],
    },
    containerPressing: {
      backgroundColor: ctx.colors2024['brand-light-1'],
    },
    addressItemContainer: {
      padding: 16,
      backgroundColor: ctx.isLight
        ? ctx.colors2024['neutral-bg-1']
        : ctx.colors2024['neutral-bg-2'],
      height: AddressItemSizes.itemH,
    },
    addressItemContainerCurrent: {
      backgroundColor: ctx.colors2024['brand-light-1'],
    },
    addressItemInner: {
      flexDirection: 'row',
      height: 52,
      width: '100%',
    },
    walletIcon: { marginRight: 8 },
    centerInfo: {
      flexDirection: 'column',
      flexShrink: 1,
      width: '100%',
      justifyContent: 'center',
      // ...makeDebugBorder('blue')
    },
    nameAndAdderss: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 4,
      // ...makeDebugBorder('yellow'),
    },
    addressAliasName: {
      flexShrink: 1,
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontStyle: 'normal',
      fontWeight: '500',
      color: ctx.colors2024['neutral-foot'],
    },
    bottomArea: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      width: '100%',
      marginTop: 6,
    },
    tokenDetailHeaderArea: {
      width: 'auto',
      flex: 1,
    },
    detailBottomArea: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      // width: '100%',
      flex: 1,
      marginTop: 4,
    },
    tokenSymbol: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      fontStyle: 'normal',
      color: ctx.colors2024['neutral-title-1'],
    },
    divider: {
      height: 12,
      maxHeight: '100%',
      width: 1,
      backgroundColor: ctx.colors2024['brand-light-1'],
      marginHorizontal: 8,
    },
    addressUsdValue: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 20,
      color: ctx.colors2024['neutral-title-1'],
    },
    addressUsdValueCurrent: {
      // color: ctx.colors2024['brand-default'],
      color: ctx.colors2024['neutral-title-1'],
      fontWeight: '700',
    },
    chainLogos: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: 2,
    },
    chainLogoItem: {
      opacity: 0.8,
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
      backgroundColor: ctx.colors2024['brand-light-1'],
    },
    pinText: {
      color: ctx.colors2024['brand-default'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 18,
    },
    pinIcon: {
      color: ctx.colors2024['brand-default'],
    },
    rightArea: {
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      // ...makeDebugBorder(),
    },
    tokenAmount: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 20,
      color: ctx.colors2024['neutral-title-1'],
    },
    tokenUsdValue: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '500',
      lineHeight: 20,
      color: ctx.colors2024['neutral-foot'],
    },
  };
});
