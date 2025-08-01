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
  Image,
  Pressable,
} from 'react-native';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { RcIconLockCC } from '@/assets/icons/send';
import { useWhitelist } from '@/hooks/whitelist';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { AddrDescResponse } from '@rabby-wallet/rabby-api/dist/types';
import { getBrandColors } from '@/utils/brand';
import { useTranslation } from 'react-i18next';
import { ellipsisAddress } from '@/utils/address';
import { useAliasNameEditModal } from '@/components2024/AliasNameEditModal/useAliasNameEditModal';

import {
  BRAND_ALIAS_TYPE_TEXT,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils/dist/types';
import { Skeleton } from '@rneui/themed';
import { AddressItemShadowView } from '@/screens/Address/components/AddressItemShadowView';
import EditSVG from '@/assets2024/icons/common/edit-cc.svg';

interface IProps {
  account: KeyringAccountWithAlias;
  style?: StyleProp<ViewStyle>;
  loading?: boolean;
  addressDesc?: AddrDescResponse['desc'];
  editingAlias?: string;
  setEditingAlias?: (alias: string) => void;
  allowEditAlias?: boolean;
}
const AddressSource = ({
  account,
  style,
  addressDesc,
  loading,
  editingAlias,
  setEditingAlias,
  allowEditAlias,
}: IProps) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });
  const { whitelist } = useWhitelist();
  const { t } = useTranslation();
  const editAliasName = useAliasNameEditModal();
  const inWhiteList = useMemo(() => {
    return whitelist.some(item => isSameAddress(item, account.address));
  }, [account.address, whitelist]);
  const cexDesc = addressDesc?.cex;
  const brandColors = useMemo(
    () =>
      getBrandColors(cexDesc?.is_deposit ? cexDesc?.id : account.type, isLight),
    [account.type, cexDesc?.id, cexDesc?.is_deposit, isLight],
  );

  if (loading) {
    return (
      <Card style={StyleSheet.flatten([styles.card, style])}>
        <Skeleton style={styles.loadingSquare} width={46} height={46} />
        <View style={styles.loaderList}>
          <Skeleton style={styles.loading} height={20} />
          <Skeleton style={styles.loading} width={53} height={20} />
        </View>
      </Card>
    );
  }
  return (
    <AddressItemShadowView style={[styles.shadowView]}>
      <Card style={StyleSheet.flatten([styles.card, style])}>
        <InnerAddressItem style={styles.rootItem} account={account}>
          {({ WalletIcon }) => (
            <View style={styles.item}>
              <View style={styles.iconWrapper}>
                {cexDesc?.is_deposit && cexDesc?.logo_url ? (
                  <Image
                    source={{ uri: cexDesc?.logo_url }}
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
                <View style={styles.itemNameWrapper}>
                  <Text style={styles.itemNameText}>
                    {editingAlias ||
                      account.aliasName ||
                      ellipsisAddress(account.address, 6)}
                  </Text>
                  {allowEditAlias && (
                    <Pressable
                      onPress={() => {
                        editAliasName.show(
                          {
                            ...account,
                            aliasName: editingAlias || account.aliasName,
                          },
                          undefined,
                          alias => {
                            setEditingAlias?.(alias);
                          },
                        );
                      }}
                      style={styles.editButton}>
                      <EditSVG
                        color={colors2024['neutral-body']}
                        width={11}
                        height={11}
                      />
                    </Pressable>
                  )}
                </View>
                {((cexDesc?.is_deposit && cexDesc?.id) ||
                  account.type !== KEYRING_TYPE.WatchAddressKeyring) && (
                  <View style={styles.itemName}>
                    <Text
                      style={[
                        styles.itemType,
                        {
                          color: brandColors.brandColor,
                          backgroundColor: brandColors.brandBg,
                        },
                      ]}>
                      {cexDesc?.is_deposit && cexDesc?.name
                        ? `${cexDesc.name} ${t(
                            'page.confirmAddress.dexNameTail',
                          )}`
                        : `${
                            BRAND_ALIAS_TYPE_TEXT[account.type] ||
                            account.brandName
                          } ${t('page.confirmAddress.brandNameTail')}`}
                    </Text>
                  </View>
                )}
                {/* <Text style={styles.balanceText}>
                  {formatUsdValue(account.balance || 0)}
                </Text> */}
              </View>
            </View>
          )}
        </InnerAddressItem>
      </Card>
    </AddressItemShadowView>
  );
};

export default AddressSource;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  shadowView: {
    // borderRadius: 20,
    borderWidth: 0,
    backgroundColor: colors2024['neutral-bg-1'],
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
    justifyContent: 'center',
    flex: 1,
  },
  editAliasWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemNameText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  itemType: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
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
  walletIcon: {
    borderRadius: 12,
  },
  itemNameWrapper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  balanceText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  loaderList: {
    gap: 4,
    flex: 1,
    marginLeft: 11,
  },
  loading: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 8,
  },
  loadingSquare: {
    backgroundColor: colors2024['neutral-bg-4'],
    borderRadius: 12,
  },
  editButton: {
    padding: 4.5,
    marginLeft: 6,
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 30,
  },
}));
