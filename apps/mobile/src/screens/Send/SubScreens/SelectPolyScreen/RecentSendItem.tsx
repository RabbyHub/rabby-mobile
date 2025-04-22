import React, { useLayoutEffect, useMemo, useState } from 'react';
import { AddressItem as InnerAddressItem } from '@/components2024/AddressItem/AddressItem';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Card } from '@/components2024/Card';
import {
  StyleSheet,
  View,
  Text,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
  Image,
} from 'react-native';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { trigger } from 'react-native-haptic-feedback';
import { ellipsisAddress } from '@/utils/address';
import { RcIconLockCC } from '@/assets/icons/send';
import { Cex } from '@rabby-wallet/rabby-api/dist/types';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import { AddressItemShadowView } from '@/screens/Address/components/AddressItemShadowView';
import { getCexWithLocalCache } from '@/databases/hooks/cex';
import { fromNow } from '@/utils/time';

interface IProps {
  account: KeyringAccountWithAlias;
  style?: StyleProp<ViewStyle>;
  timeStamp?: number;
  inWhiteList?: boolean;
}
export const RecentSendItem = ({
  account,
  style,
  timeStamp,
  inWhiteList,
}: IProps) => {
  const [cexInfo, setCexInfo] = useState<Cex | undefined>();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const showCexInfo = useMemo(() => {
    return cexInfo?.id && cexInfo.is_deposit;
  }, [cexInfo?.id, cexInfo?.is_deposit]);

  useLayoutEffect(() => {
    if (cexInfo) {
      return;
    }
    getCexWithLocalCache(account.address).then(res => {
      if (res) {
        setCexInfo(res);
      }
    });
  }, [account.address, cexInfo]);

  const { formatName, hideTail } = useMemo(() => {
    const ellipisName = ellipsisAddress(account.address);
    const name = account.aliasName || ellipisName;
    return {
      formatName: name,
      hideTail: name.toLocaleLowerCase() === ellipisName.toLocaleLowerCase(),
    };
  }, [account.address, account.aliasName]);

  const timStr = useMemo(() => {
    // if less one hour then xx mins ago, else xx hours ago
    return timeStamp ? `${fromNow(timeStamp)} ago` : '';
  }, [timeStamp]);

  const { navigateToSendScreen } = useSendRoutes();

  return (
    <AddressItemShadowView>
      <TouchableOpacity
        activeOpacity={1}
        style={StyleSheet.flatten([styles.root])}
        onPress={() => {
          trigger('impactLight', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
          //TODO: shuang: do not check whitelist
          navigateToSendScreen({
            toAddress: account.address,
            addressBrandName: account.brandName,
          });
        }}>
        <Card style={StyleSheet.flatten([styles.card, style])}>
          <InnerAddressItem style={styles.rootItem} account={account}>
            {({ WalletIcon }) => (
              <View style={styles.item}>
                <View style={styles.iconWrapper}>
                  {showCexInfo && cexInfo?.logo_url ? (
                    <Image
                      source={{ uri: cexInfo?.logo_url }}
                      style={styles.walletIcon}
                      width={46}
                      height={46}
                    />
                  ) : (
                    <WalletIcon
                      style={styles.walletIcon}
                      width={46}
                      height={46}
                    />
                  )}
                  {inWhiteList && (
                    <RcIconLockCC
                      style={styles.lockIcon}
                      color={colors2024['brand-default']}
                      surroundColor={colors2024['neutral-bg-1']}
                      width={22}
                      height={22}
                    />
                  )}
                </View>
                <View style={styles.itemInfo}>
                  <View style={styles.itemName}>
                    <Text style={styles.itemNameText} numberOfLines={1}>
                      {formatName}
                    </Text>
                    {!hideTail && (
                      <Text style={styles.address}>
                        {`(${ellipsisAddress(account.address)})`}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.itemBalanceText}>Send {timStr}</Text>
                </View>
              </View>
            )}
          </InnerAddressItem>
        </Card>
      </TouchableOpacity>
    </AddressItemShadowView>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  root: {
    // borderRadius: 20,
    overflow: 'hidden',
    height: 78,
    // backgroundColor: colors2024['neutral-bg-1'],
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 0,
    // borderColor: colors2024['neutral-line'],
    borderRadius: 20,
    flex: 1,
    flexGrow: 1,
    backgroundColor: colors2024['neutral-bg-1'],
    padding: 16,
    paddingRight: 24,
  },
  rootItem: {
    flexDirection: 'row',
    flex: 1,
    flexGrow: 1,
    marginRight: 12,
  },
  item: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 46,
    height: 46,
    position: 'relative',
  },
  lockIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    transform: [{ translateX: 5 }, { translateY: 2 }],
  },
  itemInfo: {
    gap: 4,
    flexGrow: 1,
    flex: 1,
  },
  itemNameText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  itemBalanceText: {
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
  },
  itemName: {
    gap: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  address: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
  },
  walletIcon: {
    borderRadius: 12,
  },
}));
