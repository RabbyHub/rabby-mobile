/* eslint-disable react-native/no-inline-styles */
import RcIconRightCC from '@/assets2024/icons/history/IconRightArrowCC.svg';
import { useAccountSelectModalCtx } from '@/components/AccountSelectModalTx/hooks';
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';
import { Text } from '@/components/Typography';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { getAliasName } from '@/core/apis/contact';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { switchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useTheme2024 } from '@/hooks/theme';
import { apisSingleHome } from '@/screens/Home/hooks/singleHome';
import { ellipsisAddress } from '@/utils/address';
import { createGetStyles2024 } from '@/utils/styles';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import React, { useCallback, useMemo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import FastImage from 'react-native-fast-image';
import { useGetCexList } from '../hook';

export type AddressItemInDetailProps = {
  address: string;
  accounts: KeyringAccountWithAlias[];
  disableNavigate?: boolean;
};

export const AddressItemInDetail = ({
  address,
  accounts,
  disableNavigate: propDisableNavigate = false,
}: AddressItemInDetailProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const account = useMemo(
    () => accounts.find(item => isSameAddress(item.address, address)),
    [accounts, address],
  );
  const disableNavigate = useMemo(() => {
    if (propDisableNavigate) {
      return true;
    }

    return !account;
  }, [propDisableNavigate, account]);

  const { getCexInfoByAddress } = useGetCexList();
  const cexInfo = useMemo(() => {
    return getCexInfoByAddress(address);
  }, [address, getCexInfoByAddress]);

  const accountSelectCtx = useAccountSelectModalCtx();

  const handleGoAddressDetail = useCallback(() => {
    if (account) {
      if (accountSelectCtx.isUnderContext) {
        accountSelectCtx.fnCloseModal();
      }
      switchSceneCurrentAccount('HistoryDetail', account);
      apisSingleHome.navigateToSingleHome(account);
    }
  }, [account, accountSelectCtx]);

  return (
    <View>
      <TouchableOpacity
        disabled={disableNavigate}
        style={styles.itemAliaName}
        onPress={handleGoAddressDetail}>
        <View style={{ alignItems: 'flex-end', flexDirection: 'column' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {cexInfo?.logo_url ? (
              <FastImage
                source={{ uri: cexInfo.logo_url }}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  marginRight: 4,
                }}
              />
            ) : account ? (
              <WalletIcon
                type={account.type}
                address={account.address}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  marginRight: 4,
                }}
              />
            ) : null}
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.itemContentText,
                styles.itemContentTextAliasName,
                { marginRight: 4 },
              ]}>
              {getAliasName(address) || ellipsisAddress(address)}
            </Text>
            {!disableNavigate && (
              <RcIconRightCC
                width={12}
                height={12}
                color={colors2024['neutral-foot']}
              />
            )}
            {!account ? (
              <CopyAddressIcon
                address={address}
                color={colors2024['neutral-foot']}
              />
            ) : null}
          </View>
          <Text style={styles.itemAddressText}>{address}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  itemAliaName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemAddressText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'right',
    width: 170,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
  },
  itemContentText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  itemContentTextAliasName: {
    maxWidth: 180,
  },
}));
