import { RcIconCheckedCC } from '@/assets/icons/common';
import { apiProvider } from '@/core/apis';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { findChain } from '@/utils/chain';
import { formatTokenAmount } from '@/utils/number';
import { createGetStyles } from '@/utils/styles';
import { getWalletIcon } from '@/utils/walletInfo';
import { useRequest } from 'ahooks';
import BigNumber from 'bignumber.js';
import React, { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';
import { AddressViewer } from '../AddressViewer';

interface AccountItemProps {
  account: KeyringAccountWithAlias;
  checked: boolean;
  onSelect(account: KeyringAccountWithAlias): void;
  networkId: string;
}

export const AccountSelectItem = ({
  account,
  onSelect,
  checked,
  networkId,
}: AccountItemProps) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);

  const WalletIcon = useMemo(() => {
    return getWalletIcon(account.brandName);
  }, [account.brandName]);

  const chain = findChain({
    id: +networkId,
  });

  const { data: nativeTokenBalance, runAsync: runFetchBalance } = useRequest(
    async () => {
      if (!chain || !checked) {
        return;
      }
      const balanceInWei = await apiProvider.requestETHRpc(
        {
          method: 'eth_getBalance',
          params: [account.address, 'latest'],
        },
        chain.serverId,
        account,
      );
      return new BigNumber(balanceInWei).div(1e18).toFixed();
    },
    {
      manual: true,
    },
  );

  useEffect(() => {
    if (checked && nativeTokenBalance == null) {
      runFetchBalance();
    }
  }, [
    checked,
    chain?.serverId,
    account.address,
    nativeTokenBalance,
    runFetchBalance,
  ]);

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        onSelect(account);
      }}
      style={[styles.container, checked && styles.checked]}>
      <View style={styles.iconContainer}>
        <WalletIcon
          width={styles.walletLogo.width}
          height={styles.walletLogo.height}
          style={styles.walletLogo}
        />
      </View>
      <View style={styles.main}>
        <Text style={styles.aliasName}>{account.aliasName}</Text>
        <AddressViewer
          addressStyle={styles.address}
          address={account.address}
          showArrow={false}
        />
      </View>
      <View style={styles.extra}>
        {nativeTokenBalance != null ? (
          <Text className="text-12 text-r-neutral-body native-token-balance">
            {`${formatTokenAmount(nativeTokenBalance)} ${
              chain?.nativeTokenSymbol || 'ETH'
            }`}
          </Text>
        ) : null}
        {checked ? (
          <RcIconCheckedCC
            width={24}
            height={24}
            color={themeColors['green-default']}
          />
        ) : (
          <RcIconCheckedCC
            width={24}
            height={24}
            color={themeColors['neutral-line']}
          />
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors['neutral-card-2'],
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 6,
    marginBottom: 8,
  },
  checked: {
    borderColor: colors['blue-default'],
    backgroundColor: colors['blue-light-1'],
  },
  iconContainer: {
    position: 'relative',
  },
  walletLogo: {
    width: 24,
    height: 24,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  extra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aliasName: {
    fontWeight: '500',
    fontSize: 15,
    lineHeight: 18,
    color: colors['neutral-title-1'],
    marginBottom: 2,
  },
  address: {
    fontSize: 12,
    lineHeight: 14,
    color: colors['neutral-body'],
  },
}));
