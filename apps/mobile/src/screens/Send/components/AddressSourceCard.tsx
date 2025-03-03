import React, { useMemo } from 'react';
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
import { RcIconLockCC } from '@/assets/icons/send';
import { useWhitelist } from '@/hooks/whitelist';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import EditSVG from '@/assets2024/icons/common/edit-cc.svg';
import { useAliasNameEditModal } from '@/components2024/AliasNameEditModal/useAliasNameEditModal';
import { Cex } from '@rabby-wallet/rabby-api/dist/types';
import { getBrandColors } from '@/utils/brand';

interface IProps {
  account: KeyringAccountWithAlias;
  style?: StyleProp<ViewStyle>;
  cexDesc?: Cex;
}
const AddressSource = ({ account, style, cexDesc }: IProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { whitelist } = useWhitelist();
  const editAliasName = useAliasNameEditModal();

  const inWhiteList = useMemo(() => {
    return whitelist.some(item => isSameAddress(item, account.address));
  }, [account.address, whitelist]);

  const brandColors = useMemo(
    () => getBrandColors(cexDesc?.id || account.brandName),
    [account.brandName, cexDesc?.id],
  );

  return (
    <Card style={StyleSheet.flatten([styles.card, style])}>
      <InnerAddressItem style={styles.rootItem} account={account}>
        {({ WalletIcon, WalletName }) => (
          <View style={styles.item}>
            <View style={styles.iconWrapper}>
              {cexDesc?.logo_url ? (
                <Image
                  source={{ uri: cexDesc?.logo_url }}
                  style={styles.walletIcon}
                  width={46}
                  height={46}
                />
              ) : (
                <WalletIcon style={styles.walletIcon} width={46} height={46} />
              )}
              {inWhiteList && (
                <RcIconLockCC
                  style={styles.lockIcon}
                  color={colors2024['neutral-body']}
                  width={22}
                  height={22}
                />
              )}
            </View>
            <View style={styles.itemInfo}>
              <View style={styles.itemName}>
                <Text
                  style={[
                    styles.itemType,
                    {
                      color: brandColors.brandColor,
                      backgroundColor: brandColors.brandBg,
                    },
                  ]}>
                  {cexDesc?.name
                    ? `${cexDesc.name} Deposit Address`
                    : account.type}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.editAliasWrapper}
                onPress={() => {
                  editAliasName.show(account);
                }}>
                <WalletName style={styles.itemNameText} />
                <EditSVG
                  color={colors2024['neutral-foot']}
                  width={14}
                  height={14}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </InnerAddressItem>
    </Card>
  );
};

export default AddressSource;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  root: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors2024['neutral-bg-3'],
  },
  rootPressing: {
    borderColor: colors2024['brand-light-2'],
  },
  shadowView: {
    borderRadius: 20,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 0,
    borderRadius: 20,
    padding: 16,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  rootItem: {
    flexDirection: 'row',
    flex: 1,
    flexGrow: 1,
    marginRight: 20,
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
    gap: 6,
    flexGrow: 1,
    flex: 1,
  },
  editAliasWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemNameText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  itemNameTextHasPinned: {
    paddingRight: 52,
  },
  itemNamePinned: {
    marginLeft: -52,
  },
  itemType: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  itemBalanceText: {
    fontSize: 17,
    lineHeight: 22,
    color: colors2024['neutral-secondary'],
    fontWeight: '500',
  },
  itemName: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  address: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  arrow: {
    width: 30,
    height: 30,
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPressing: {
    backgroundColor: colors2024['brand-light-1'],
  },
  arrowPressing: {
    backgroundColor: colors2024['brand-light-1'],
  },
  walletIcon: {
    borderRadius: 12,
  },
}));
