import React, { useCallback, useMemo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import FastImage from 'react-native-fast-image';

import { Text } from '@/components/Typography';
import { useAccountSelectModalCtx } from '@/components/AccountSelectModalTx/hooks';
import { getAliasName } from '@/core/apis/contact';
import { useTheme2024 } from '@/hooks/theme';
import type { KeyringAccountWithAlias } from '@/hooks/account';
import { createGetStyles2024 } from '@/utils/styles';
import { RcIconRightCC } from '@/assets/icons/common';
import { ellipsisAddress } from '@/utils/address';
import { useGetCexList } from '../hook';
import { apisSingleHome } from '@/screens/Home/hooks/singleHome';

export const AddressItemInDetail = ({
  address,
  accounts,
  disableNavigate: propDisableNavigate = false,
}: {
  address: string;
  accounts: KeyringAccountWithAlias[];
  disableNavigate?: boolean;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const disableNavigate = useMemo(() => {
    if (propDisableNavigate) {
      return true;
    }

    return !accounts.find(account => isSameAddress(account.address, address));
  }, [accounts, address, propDisableNavigate]);

  const { getCexInfoByAddress } = useGetCexList();
  const cexInfo = useMemo(() => {
    return getCexInfoByAddress(address);
  }, [address, getCexInfoByAddress]);

  const accountSelectCtx = useAccountSelectModalCtx();

  const handleGoAddressDetail = useCallback(() => {
    const idx = accounts.findIndex(account =>
      isSameAddress(account.address, address),
    );

    if (idx > -1) {
      if (accountSelectCtx.isUnderContext) {
        accountSelectCtx.fnCloseModal();
      }
      apisSingleHome.navigateToSingleHome(accounts[idx]);
    } else {
      console.debug('itemAliaName press open popup', address);
    }
  }, [accounts, accountSelectCtx, address]);

  return (
    <View>
      <TouchableOpacity
        disabled={disableNavigate}
        style={styles.itemAliasName}
        onPress={handleGoAddressDetail}>
        <View style={{ alignItems: 'flex-end', flexDirection: 'column' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {cexInfo?.logo_url && (
              <FastImage
                source={{ uri: cexInfo.logo_url }}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  marginRight: 4,
                }}
              />
            )}
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.itemContentText, styles.itemContentTextAliasName]}>
              {getAliasName(address) || ellipsisAddress(address)}
            </Text>
            {!disableNavigate && (
              <RcIconRightCC
                width={12}
                height={12}
                color={colors2024['neutral-foot']}
              />
            )}
          </View>
          <Text style={styles.itemAddressText}>{address}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  itemAliasName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemAddressText: {
    color: colors2024['neutral-foot'],
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
