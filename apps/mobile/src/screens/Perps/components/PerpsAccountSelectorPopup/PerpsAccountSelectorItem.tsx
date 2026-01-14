import { RcIconCorrectCC } from '@/assets/icons/common';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { isSameAccount } from '@/hooks/accountsSwitcher';
import { useTheme2024 } from '@/hooks/theme';
import { AddressItemShadowView } from '@/screens/Address/components/AddressItemShadowView';
import { ellipsisAddress } from '@/utils/address';
import { formatUsdValue, splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { ClearinghouseState } from '@rabby-wallet/hyperliquid-sdk';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

export const PerpsAccountSelectorItem: React.FC<{
  account: KeyringAccountWithAlias;
  onPress?: (account: KeyringAccountWithAlias) => void;
  info?: ClearinghouseState | null;
  loading?: boolean;
  tmpSelectAccount?: KeyringAccountWithAlias | null;
  lastUsedAccount?: KeyringAccountWithAlias | null;
  currentAccount?: KeyringAccountWithAlias | null;
}> = ({
  account,
  info,
  onPress,
  loading,
  tmpSelectAccount,
  lastUsedAccount,
  currentAccount,
}) => {
  const { t } = useTranslation();

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });
  const usdValue = useMemo(() => {
    const b = account.balance || 0;
    return `$${splitNumberByStep(b > 10 ? Math.floor(b) : b.toFixed(2))}`;
  }, [account.balance]);

  const positionAllPnl = useMemo(() => {
    return info?.assetPositions?.length
      ? info?.assetPositions?.reduce((acc, asset) => {
          return acc + Number(asset.position.unrealizedPnl || 0);
        }, 0) || 0
      : null;
  }, [info?.assetPositions]);

  const isCurrent = useMemo(() => {
    return isSameAccount(account, currentAccount);
  }, [account, currentAccount]);

  const isLastUsed = useMemo(() => {
    return (
      !tmpSelectAccount &&
      isSameAddress(account.address, lastUsedAccount?.address || '') &&
      account.type === lastUsedAccount?.type
    );
  }, [
    account.address,
    account.type,
    lastUsedAccount?.address,
    lastUsedAccount?.type,
    tmpSelectAccount,
  ]);

  return (
    <TouchableOpacity
      key={`${account.address}-${account.type}-${account.brandName}`}
      onPress={() => {
        onPress?.(account);
      }}>
      <AddressItemShadowView
        // disableShadow
        style={[
          styles.addressItemView,
          // style,
          // isCurrent || isPressing ? styles.active : null,
        ]}>
        <View style={styles.addressItemInner}>
          <WalletIcon
            borderRadius={12}
            width={46}
            height={46}
            style={styles.walletIcon}
            address={account.address}
            type={account.brandName}
          />
          <View style={styles.centerInfo}>
            <View style={styles.nameAndAddress}>
              <Text
                style={styles.addressText}
                numberOfLines={1}
                ellipsizeMode="tail">
                {account.aliasName || ellipsisAddress(account.address)}
              </Text>
              {isCurrent ? (
                <RcIconCorrectCC
                  color={colors2024['green-default']}
                  width={16}
                  height={16}
                />
              ) : isLastUsed ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>
                    {t('page.perps.PerpsAccountSelectorPopup.lastUsed')}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.bottomArea}>
              <Text style={styles.balanceText}>{usdValue}</Text>
            </View>
          </View>
          <View style={styles.rightArea}>
            {loading && isSameAccount(account, tmpSelectAccount) ? (
              <ActivityIndicator />
            ) : (
              <>
                {info ? (
                  <View style={styles.perpsInfo}>
                    <Text style={styles.perpsUsdValue}>
                      {formatUsdValue(Number(info?.withdrawable || 0))}
                    </Text>
                    {info?.assetPositions?.length ? (
                      <Text style={[styles.positionCountText]}>
                        {info?.assetPositions?.length}{' '}
                        {t('page.perpsDetail.PerpsPosition.title')}
                      </Text>
                    ) : (
                      <Text style={styles.noPositionText}> </Text>
                    )}
                  </View>
                ) : null}
              </>
            )}
          </View>
        </View>
      </AddressItemShadowView>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(ctx => {
  const { colors2024 } = ctx;
  return {
    handleStyle: {
      backgroundColor: ctx.isLight
        ? ctx.colors2024['neutral-bg-0']
        : ctx.colors2024['neutral-bg-1'],
      paddingTop: 10,
      height: 36,
    },
    container: {
      // height: '100%',
      minHeight: 364,
      backgroundColor: ctx.isLight
        ? ctx.colors2024['neutral-bg-0']
        : ctx.colors2024['neutral-bg-1'],
      paddingHorizontal: 20,
      // display: 'flex',
      // flexDirection: 'column',
      paddingBottom: 36,
    },
    title: {
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      marginBottom: 20,
      textAlign: 'center',
    },
    list: {
      // flex: 1,
      // height: '100%',
      paddingBottom: 56,
    },
    listContent: {
      // paddingBottom: 36,
    },
    panelContainer: {
      position: 'relative',
      width: '100%',
    },
    addressItemView: {
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      padding: 16,
      marginBottom: 12,
      borderRadius: 20,
    },
    addressItemInner: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    addressText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      color: colors2024['neutral-foot'],
      fontFamily: 'SF Pro Rounded',
      flexShrink: 1,
    },
    walletIcon: {},
    centerInfo: {
      // flexDirection: 'column',
      flex: 1,
      // overflow: 'hidden',
      minWidth: 0,
    },
    nameAndAddress: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 4,
      flex: 1,
      // overflow: 'hidden',
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
    balanceText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
    },
    bottomArea: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      width: '100%',
      marginTop: 6,
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
    rightArea: {
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
      // height: '100%',
    },
    tag: {
      paddingVertical: 1,
      paddingHorizontal: 4,
      borderRadius: 4,
      backgroundColor: colors2024['brand-light-1'],
    },
    tagText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 16,
      color: ctx.colors2024['brand-default'],
    },
    perpsInfo: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      marginLeft: 'auto',
    },
    noPositionText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-info'],
    },
    positionCountText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '400',
      color: colors2024['neutral-secondary'],
    },
    perpsUsdValue: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 17,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 22,
      color: ctx.colors2024['neutral-title-1'],
    },
  };
});
